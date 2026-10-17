import type { DeletionEvent, DeletionScope, TenantId, UserId } from '@auditai/contracts';
import { withTenant } from './db';

/**
 * Deletion data layer (M15, FR-09, PRD §15, §25.4).
 *
 * The right-to-erasure flow runs `deletePseudonym` which:
 *   1. lists the `respondent_badges` rows for that pseudonym in the tenant;
 *   2. inserts one `deletion_events` row per badge removed;
 *   3. inserts one `audit_log` row per deletion;
 *   4. `DELETE`s the rows in the same transaction.
 *
 * Audit log writes keep the append-only invariant intact; the
 * `deletion_events` table is the dedicated trail.
 */

interface DeletionEventRow {
  id: string;
  tenant_id: string;
  requested_by: string;
  scope: DeletionScope;
  respondent_pseudonym: string | null;
  target_kind:
    | 'respondent_badge'
    | 'synergy'
    | 'opportunity'
    | 'analysis'
    | 'audit_log'
    | 'export_request';
  target_id: string | null;
  audit_log_id: string | null;
  created_at: string;
}

const fromRow = (r: DeletionEventRow): DeletionEvent => ({
  id: r.id,
  tenantId: r.tenant_id as TenantId,
  requestedBy: r.requested_by as UserId,
  scope: r.scope,
  respondentPseudonym: r.respondent_pseudonym,
  targetKind: r.target_kind,
  targetId: r.target_id,
  auditLogId: r.audit_log_id,
  createdAt: r.created_at,
});

export interface PseudonymDeletionResult {
  readonly events: ReadonlyArray<DeletionEvent>;
  readonly removedRowCount: number;
}

export const deletePseudonym = async (
  tenantId: TenantId,
  pseudonym: string,
  actorUserId: UserId,
): Promise<PseudonymDeletionResult> => {
  return withTenant(tenantId, async (client) => {
    const badges = await client.query<{ id: string }>(
      `SELECT id FROM respondent_badges
        WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
      [tenantId, pseudonym],
    );
    const events: DeletionEvent[] = [];
    for (const b of badges.rows) {
      const audit = await client.query<{ id: string }>(
        `INSERT INTO audit_log (
            tenant_id, actor_user_id, action, target_kind, target_id, payload_json
          ) VALUES ($1, $2, 'badge.erase', 'respondent_badge', $3, $4::jsonb)
          RETURNING id`,
        [tenantId, actorUserId, b.id, JSON.stringify({ pseudonym, scope: 'respondent_pseudonym' })],
      );
      const ev = await client.query<DeletionEventRow>(
        `INSERT INTO deletion_events (
            tenant_id, requested_by, scope, respondent_pseudonym, target_kind, target_id, audit_log_id, created_at
          ) VALUES ($1, $2, 'respondent_pseudonym', $3, 'respondent_badge', $4, $5, now())
          RETURNING id, tenant_id, requested_by, scope, respondent_pseudonym, target_kind, target_id, audit_log_id, created_at`,
        [tenantId, actorUserId, pseudonym, b.id, audit.rows[0]?.id ?? null],
      );
      const inserted = ev.rows[0];
      if (inserted) events.push(fromRow(inserted));
    }
    const del = await client.query<{ n: number }>(
      `WITH d AS (
          DELETE FROM respondent_badges
           WHERE tenant_id = $1 AND respondent_pseudonym = $2
           RETURNING 1
        )
        SELECT count(*)::int AS n FROM d`,
      [tenantId, pseudonym],
    );
    return { events, removedRowCount: del.rows[0]?.n ?? 0 };
  });
};

export const listDeletionEvents = async (
  tenantId: TenantId,
): Promise<ReadonlyArray<DeletionEvent>> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<DeletionEventRow>(
      `SELECT id, tenant_id, requested_by, scope, respondent_pseudonym,
              target_kind, target_id, audit_log_id, created_at
         FROM deletion_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows.map(fromRow);
  });
};
