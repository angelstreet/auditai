import pg from 'pg';
import type { TenantId } from '@auditai/contracts';

/**
 * Retention worker (M15, FR-09, PRD §15, §25.4).
 *
 * For each tenant, finds every `respondent_badges` row whose
 * `retention_at` is in the past and:
 *   * inserts one `deletion_events` row scoped `retention_expired`;
 *   * inserts one `audit_log` row (`badge.erase`);
 *   * deletes the badge in the same transaction.
 *
 * Idempotent: re-running the worker after a partial run only
 * processes rows that are still past their `retention_at`.
 *
 * Pure SQL upsert: no blob storage, no per-tenant page.
 */

export interface RetentionWorkerOptions {
  readonly databaseUrl?: string;
  readonly client?: pg.Client;
}

export interface RetentionWorkerResult {
  readonly tenantsScanned: number;
  readonly purged: number;
}

const SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000000';

const purgeTenant = async (client: pg.ClientBase, tenantId: TenantId): Promise<number> => {
  // 1. List rows past their retention boundary.
  const candidates = await client.query<{ id: string; respondent_pseudonym: string }>(
    `SELECT id, respondent_pseudonym
       FROM respondent_badges
      WHERE tenant_id = $1
        AND retention_at IS NOT NULL
        AND retention_at <= now()`,
    [tenantId],
  );
  let purged = 0;
  for (const c of candidates.rows) {
    // 2. Write the audit_log entry first so the deletion_events row can FK it.
    const audit = await client.query<{ id: string }>(
      `INSERT INTO audit_log (
          tenant_id, actor_user_id, action, target_kind, target_id, payload_json
        ) VALUES ($1, $2, 'badge.erase', 'respondent_badge', $3, $4::jsonb)
        RETURNING id`,
      [
        tenantId,
        SYSTEM_ACTOR,
        c.id,
        JSON.stringify({ pseudonym: c.respondent_pseudonym, scope: 'retention_expired' }),
      ],
    );
    // 3. Record the deletion_events row.
    await client.query(
      `INSERT INTO deletion_events (
          tenant_id, requested_by, scope, respondent_pseudonym,
          target_kind, target_id, audit_log_id, created_at
        ) VALUES ($1, $2, 'retention_expired', $3, 'respondent_badge', $4, $5, now())`,
      [tenantId, SYSTEM_ACTOR, c.respondent_pseudonym, c.id, audit.rows[0]?.id ?? null],
    );
    // 4. Delete the badge row.
    await client.query(`DELETE FROM respondent_badges WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      c.id,
    ]);
    purged += 1;
  }
  return purged;
};

export const runRetentionWorker = async (
  options: RetentionWorkerOptions = {},
): Promise<RetentionWorkerResult> => {
  const ownsClient = !options.client;
  const client = options.client ?? new pg.Client({ connectionString: options.databaseUrl });
  if (ownsClient) await client.connect();
  try {
    if (ownsClient) {
      await client.query('SET ROLE auditai_app');
    }
    await client.query(`SET LOCAL app.is_service_account = 'on'`);
    const tenants = await client.query<{ id: string }>(`SELECT id FROM tenants`);
    let purged = 0;
    for (const t of tenants.rows) {
      await client.query('BEGIN');
      try {
        purged += await purgeTenant(client, t.id as TenantId);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    return { tenantsScanned: tenants.rows.length, purged };
  } finally {
    if (ownsClient) await client.end();
  }
};
