import type { DeletionEvent, DeletionScope, TenantId, UserId } from '@evolai/contracts';
import { withTenant } from './db';

/**
 * Deletion data layer (M15, FR-09, PRD §15, §25.4).
 *
 * The right-to-erasure flow runs `deletePseudonym`, which calls the SQL function
 * `erase_respondent_pseudonym` (migration 0014, ADR 0030) in one tenant transaction. It removes
 * the pseudonym's invitations, respondents, submissions, answers, analyses, badges and derived
 * draft opportunities, trims synergies, writes one `deletion_events` row per kind and one
 * `audit_log` row. The trails hold sha256(tenant:pseudonym), never the raw pseudonym.
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
    | 'export_request'
    | 'invitation'
    | 'respondent'
    | 'submission'
    | 'answer';
  target_id: string | null;
  audit_log_id: string | null;
  row_count: number;
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
  rowCount: r.row_count,
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
    // One SQL function owns the cascade (migration 0014, ADR 0030); the retention worker
    // calls the same function.
    const res = await client.query<{ r: Record<string, number | string> }>(
      `SELECT erase_respondent_pseudonym($1, $2, $3, 'respondent_pseudonym') AS r`,
      [tenantId, pseudonym, actorUserId],
    );
    const counts = res.rows[0]?.r ?? {};
    const hash = String(counts['pseudonym_hash'] ?? '');
    const ev = await client.query<DeletionEventRow>(
      `SELECT id, tenant_id, requested_by, scope, respondent_pseudonym,
              target_kind, target_id, audit_log_id, row_count, created_at
         FROM deletion_events
        WHERE tenant_id = $1 AND respondent_pseudonym = $2 AND created_at = now()
        ORDER BY target_kind`,
      [tenantId, hash],
    );
    const removedRowCount = Object.entries(counts)
      .filter(([k]) => k !== 'pseudonym_hash')
      .reduce((n, [, v]) => n + Number(v), 0);
    return { events: ev.rows.map(fromRow), removedRowCount };
  });
};

export const listDeletionEvents = async (
  tenantId: TenantId,
): Promise<ReadonlyArray<DeletionEvent>> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<DeletionEventRow>(
      `SELECT id, tenant_id, requested_by, scope, respondent_pseudonym,
              target_kind, target_id, audit_log_id, row_count, created_at
         FROM deletion_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows.map(fromRow);
  });
};
