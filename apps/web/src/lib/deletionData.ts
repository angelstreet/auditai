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

/** Does any link, survey or mascot in this organisation carry this respondent code? */
export const respondentExists = async (tenantId: TenantId, pseudonym: string): Promise<boolean> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM invitations WHERE tenant_id = $1 AND respondent_pseudonym = $2
       UNION ALL
       SELECT 1 FROM respondent_badges WHERE tenant_id = $1 AND respondent_pseudonym = $2
       LIMIT 1`,
      [tenantId, pseudonym],
    );
    return rows.length > 0;
  });

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

export interface ErasurePreview {
  readonly links: number;
  readonly surveys: number;
  readonly answers: number;
  readonly mascots: number;
}

/**
 * What erasing this respondent code would remove, counted without changing anything (TASK-U). All
 * zero means the code is unknown. Same scope as `erase_respondent_pseudonym`, shown in plain kinds.
 */
export const previewErasure = async (
  tenantId: TenantId,
  pseudonym: string,
): Promise<ErasurePreview> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      links: string;
      surveys: string;
      answers: string;
      mascots: string;
    }>(
      `WITH inv AS (
         SELECT id FROM invitations WHERE tenant_id = $1 AND respondent_pseudonym = $2
       ), sub AS (
         SELECT id FROM submissions WHERE tenant_id = $1 AND invitation_id IN (SELECT id FROM inv)
       )
       SELECT (SELECT count(*) FROM inv)::text AS links,
              (SELECT count(*) FROM sub)::text AS surveys,
              (SELECT count(*) FROM answers WHERE tenant_id = $1
                  AND submission_id IN (SELECT id FROM sub))::text AS answers,
              (SELECT count(*) FROM respondent_badges
                WHERE tenant_id = $1 AND respondent_pseudonym = $2)::text AS mascots`,
      [tenantId, pseudonym],
    );
    const r = rows[0];
    return {
      links: Number(r?.links ?? 0),
      surveys: Number(r?.surveys ?? 0),
      answers: Number(r?.answers ?? 0),
      mascots: Number(r?.mascots ?? 0),
    };
  });

export interface BatchOption {
  readonly id: string;
  readonly createdAt: string;
  readonly count: number;
}

export interface CodeRow {
  readonly code: string;
  readonly teamName: string;
  readonly status: string;
  readonly createdAt: string;
}

export const CODE_SEARCH_LIMIT = 100;

/** Batches of links, newest first, so the auditor can pick one by date. */
export const listLinkBatches = async (tenantId: TenantId): Promise<BatchOption[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ batch_id: string; created: Date | string; n: string }>(
      `SELECT batch_id, min(created_at) AS created, count(*)::text AS n
         FROM invitations WHERE tenant_id = $1 AND batch_id IS NOT NULL
        GROUP BY batch_id ORDER BY min(created_at) DESC LIMIT 50`,
      [tenantId],
    );
    return rows.map((r) => ({
      id: r.batch_id,
      createdAt: new Date(r.created).toISOString(),
      count: Number(r.n),
    }));
  });

/**
 * Find respondent codes by batch and/or creation date. Returns codes, team, status and date only:
 * never a delivery address or anything that says who the person is. The page is staff-only.
 */
export const findRespondentCodes = async (
  tenantId: TenantId,
  filter: { batchId?: string; from?: string; to?: string },
): Promise<{ rows: CodeRow[]; truncated: boolean }> =>
  withTenant(tenantId, async (client) => {
    const params: unknown[] = [tenantId];
    const where = ['i.tenant_id = $1'];
    if (filter.batchId) {
      params.push(filter.batchId);
      where.push(`i.batch_id = $${params.length}`);
    }
    if (filter.from) {
      params.push(filter.from);
      where.push(`i.created_at >= $${params.length}::date`);
    }
    if (filter.to) {
      params.push(filter.to);
      where.push(`i.created_at < ($${params.length}::date + 1)`);
    }
    const { rows } = await client.query<{
      respondent_pseudonym: string;
      team_name: string;
      status: string;
      created_at: Date | string;
    }>(
      `SELECT i.respondent_pseudonym, t.name AS team_name, i.status, i.created_at
         FROM invitations i JOIN teams t ON t.id = i.team_id
        WHERE ${where.join(' AND ')}
        ORDER BY i.created_at DESC, i.respondent_pseudonym
        LIMIT ${CODE_SEARCH_LIMIT + 1}`,
      params,
    );
    return {
      rows: rows.slice(0, CODE_SEARCH_LIMIT).map((r) => ({
        code: r.respondent_pseudonym,
        teamName: r.team_name,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      truncated: rows.length > CODE_SEARCH_LIMIT,
    };
  });
