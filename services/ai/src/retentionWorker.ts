import pg from 'pg';
import type { TenantId } from '@evolai/contracts';

/**
 * Retention worker (M15, FR-09, PRD §15, §25.4; ADR 0020).
 *
 * For each tenant, finds every pseudonym whose `respondent_badges` are all past `retention_at`
 * and erases it with the same SQL function the web right-to-erasure action calls
 * (`erase_respondent_pseudonym`, migration 0014): invitations, respondents, submissions, answers,
 * analyses, badges and derived draft opportunities go, synergies are trimmed, and one
 * `deletion_events` row per kind plus one `audit_log` row are written, scope `retention_expired`.
 *
 * One transaction per tenant. Idempotent: a second run finds nothing past retention.
 * Schedule: see `scripts/retention-run.ts` and docs/ops/retention-schedule.md.
 */

export interface RetentionWorkerOptions {
  readonly databaseUrl?: string;
  readonly client?: pg.Client;
}

export interface RetentionWorkerResult {
  readonly tenantsScanned: number;
  /** Pseudonyms erased. */
  readonly purged: number;
}

export const SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000000';

const SERVICE_ON = `SELECT set_config('app.is_service_account', 'on', true)`;

const purgeTenant = async (client: pg.ClientBase, tenantId: TenantId): Promise<number> => {
  // A pseudonym is due only when every badge it holds is past retention.
  const due = await client.query<{ respondent_pseudonym: string }>(
    `SELECT respondent_pseudonym
       FROM respondent_badges
      WHERE tenant_id = $1
      GROUP BY respondent_pseudonym
     HAVING bool_and(retention_at IS NOT NULL AND retention_at <= now())`,
    [tenantId],
  );
  for (const d of due.rows) {
    await client.query(`SELECT erase_respondent_pseudonym($1, $2, $3, 'retention_expired')`, [
      tenantId,
      d.respondent_pseudonym,
      SYSTEM_ACTOR,
    ]);
  }
  return due.rows.length;
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
    await client.query('BEGIN');
    await client.query(SERVICE_ON);
    const tenants = await client.query<{ id: string }>(`SELECT id FROM tenants`);
    await client.query('COMMIT');
    let purged = 0;
    for (const t of tenants.rows) {
      await client.query('BEGIN');
      try {
        await client.query(SERVICE_ON);
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
