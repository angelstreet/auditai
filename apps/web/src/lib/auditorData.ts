import type {
  AnalysisId,
  AuditLog,
  AuditLogId,
  EngagementId,
  TenantId,
  UserId,
} from '@auditai/contracts';
import { approvalResultSchema, auditLogSchema } from '@auditai/contracts';
import { withServiceAccount, withTenant } from './db';

export { approvalResultSchema, auditLogSchema };

/**
 * Auditor data layer (M10, FR-08, PRD §10, §25.4).
 *
 * The auditor UI reads the `analyses` rows that the M9 worker writes, joins back to the source
 * `submissions` + `answers` for the evidence list, and surfaces the human-approval action. The
 * approve action is a server action that runs in the per-tenant transaction (`withTenant`),
 * sets `approved_at` + `approved_by`, and writes a row to `audit_log`. The RLS policies from
 * migration 0006 ensure the action is gated to the auditor's tenant.
 *
 * Reads run as a service account because the auditor may need to see analyses across teams in
 * the same tenant; the page itself renders only the rows for the requested engagement.
 *
 * The actor identity is supplied by the caller (the smoke uses the seeded auditor UUID; the
 * real product will inject the authenticated user from the session — Gate C, not in M10).
 */

export interface AnalysisListRow {
  readonly analysisId: AnalysisId;
  readonly submissionId: string;
  readonly engagementId: EngagementId;
  readonly sensitivity: 'public' | 'internal' | 'sensitive';
  readonly themeCount: number;
  readonly promptCount: number;
  readonly modelRoute: string;
  readonly approvedAt: string | null;
  readonly approvedBy: UserId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly respondentPseudonym: string;
  readonly invitationStatus: string;
  readonly submittedAt: string | null;
}

export interface AnalysisDetail extends AnalysisListRow {
  readonly tenantId: TenantId;
  readonly payload: unknown;
  readonly evidence: ReadonlyArray<{
    readonly claim: string;
    readonly sourceKind: 'answer' | 'question_item';
    readonly sourceId: string;
    readonly quote: string;
  }>;
}

export const listAnalysesForEngagement = async (
  tenantId: TenantId,
  engagementId: EngagementId,
): Promise<AnalysisListRow[]> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      analysis_id: string;
      submission_id: string;
      engagement_id: string;
      sensitivity: 'public' | 'internal' | 'sensitive';
      theme_count: number;
      prompt_count: number;
      model_route: string;
      approved_at: string | null;
      approved_by: string | null;
      created_at: string;
      updated_at: string;
      pseudonym: string;
      invitation_status: string;
      submitted_at: string | null;
    }>(
      `SELECT a.id                AS analysis_id,
              a.submission_id     AS submission_id,
              a.engagement_id     AS engagement_id,
              a.sensitivity       AS sensitivity,
              a.theme_count       AS theme_count,
              a.prompt_count      AS prompt_count,
              a.model_route       AS model_route,
              a.approved_at       AS approved_at,
              a.approved_by       AS approved_by,
              a.created_at        AS created_at,
              a.updated_at        AS updated_at,
              i.respondent_pseudonym AS pseudonym,
              i.status            AS invitation_status,
              s.submitted_at      AS submitted_at
         FROM analyses a
         JOIN submissions  s ON s.id = a.submission_id
         JOIN invitations  i ON i.id = s.invitation_id
        WHERE a.tenant_id = $1
          AND a.engagement_id = $2
        ORDER BY a.created_at DESC`,
      [tenantId, engagementId],
    );
    return rows.map((row) => ({
      analysisId: row.analysis_id as AnalysisId,
      submissionId: row.submission_id,
      engagementId: row.engagement_id as EngagementId,
      sensitivity: row.sensitivity,
      themeCount: row.theme_count,
      promptCount: row.prompt_count,
      modelRoute: row.model_route,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by ? (row.approved_by as UserId) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      respondentPseudonym: row.pseudonym,
      invitationStatus: row.invitation_status,
      submittedAt: row.submitted_at,
    }));
  });
};

export const getAnalysis = async (
  tenantId: TenantId,
  analysisId: AnalysisId,
): Promise<AnalysisDetail | null> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      analysis_id: string;
      submission_id: string;
      engagement_id: string;
      tenant_id: string;
      sensitivity: 'public' | 'internal' | 'sensitive';
      theme_count: number;
      prompt_count: number;
      model_route: string;
      approved_at: string | null;
      approved_by: string | null;
      created_at: string;
      updated_at: string;
      pseudonym: string;
      invitation_status: string;
      submitted_at: string | null;
      payload_json: unknown;
      evidence_json: ReadonlyArray<{
        claim: string;
        sourceKind: 'answer' | 'question_item';
        sourceId: string;
        quote: string;
      }>;
    }>(
      `SELECT a.id, a.submission_id, a.engagement_id, a.tenant_id, a.sensitivity,
              a.theme_count, a.prompt_count, a.model_route, a.approved_at, a.approved_by,
              a.created_at, a.updated_at, a.payload_json, a.evidence_json,
              i.respondent_pseudonym AS pseudonym, i.status AS invitation_status,
              s.submitted_at
         FROM analyses a
         JOIN submissions s ON s.id = a.submission_id
         JOIN invitations i ON i.id = s.invitation_id
        WHERE a.tenant_id = $1 AND a.id = $2`,
      [tenantId, analysisId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      analysisId: row.analysis_id as AnalysisId,
      submissionId: row.submission_id,
      engagementId: row.engagement_id as EngagementId,
      tenantId: row.tenant_id as TenantId,
      sensitivity: row.sensitivity,
      themeCount: row.theme_count,
      promptCount: row.prompt_count,
      modelRoute: row.model_route,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by ? (row.approved_by as UserId) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      respondentPseudonym: row.pseudonym,
      invitationStatus: row.invitation_status,
      submittedAt: row.submitted_at,
      payload: row.payload_json,
      evidence: row.evidence_json,
    };
  });
};

export interface ApprovalResult {
  readonly analysisId: AnalysisId;
  readonly approvedAt: string;
  readonly approvedBy: UserId;
  readonly auditLogId: AuditLogId;
}

/**
 * Approve an analysis. Sets `approved_at` + `approved_by` on the row and writes a matching
 * `audit_log` row in the same transaction. RLS on both tables is tenant-scoped so the actor
 * must already be a member of the tenant.
 *
 * Idempotency: a second call for an already-approved analysis overwrites `approved_at` and
 * appends a new audit log row (the trail is append-only by design).
 */
export const approveAnalysis = async (
  tenantId: TenantId,
  analysisId: AnalysisId,
  actorUserId: UserId,
  payload: Record<string, unknown> = {},
): Promise<ApprovalResult | null> => {
  return withTenant(tenantId, async (client) => {
    const upd = await client.query<{ engagement_id: string; model_route: string }>(
      `UPDATE analyses
          SET approved_at = now(),
              approved_by = $2,
              updated_at  = now()
        WHERE id = $1
        RETURNING engagement_id, model_route`,
      [analysisId, actorUserId],
    );
    if (upd.rowCount === 0) return null;
    const engagementId = upd.rows[0]?.engagement_id;
    const modelRoute = upd.rows[0]?.model_route;
    const audit = await client.query<{ id: string; created_at: string }>(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'analysis.approve', 'analysis', $3, $4)
       RETURNING id, created_at`,
      [tenantId, actorUserId, analysisId, JSON.stringify({ engagementId, modelRoute, ...payload })],
    );
    const auditId = audit.rows[0]?.id;
    const createdAt = audit.rows[0]?.created_at;
    if (!auditId || !createdAt) {
      throw new Error('audit_log insert did not return an id; the transaction will roll back');
    }
    return {
      analysisId,
      approvedAt: createdAt,
      approvedBy: actorUserId,
      auditLogId: auditId as AuditLogId,
    };
  });
};

export const listAuditLogForTarget = async (
  tenantId: TenantId,
  targetKind: 'analysis' | 'opportunity',
  targetId: string,
  limit = 25,
): Promise<AuditLog[]> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      tenant_id: string;
      actor_user_id: string;
      action: AuditLog['action'];
      target_kind: AuditLog['targetKind'];
      target_id: string;
      payload_json: Record<string, unknown>;
      created_at: string;
    }>(
      `SELECT id, tenant_id, actor_user_id, action, target_kind, target_id,
              payload_json, created_at
         FROM audit_log
        WHERE tenant_id = $1 AND target_kind = $2 AND target_id = $3
        ORDER BY created_at DESC
        LIMIT $4`,
      [tenantId, targetKind, targetId, limit],
    );
    return rows.map((row) => ({
      id: row.id as AuditLogId,
      tenantId: row.tenant_id as TenantId,
      actorUserId: row.actor_user_id as UserId,
      action: row.action,
      targetKind: row.target_kind,
      targetId: row.target_id,
      payload: row.payload_json ?? {},
      createdAt: row.created_at,
    }));
  });
};

export const findAuditorForTenant = async (tenantId: TenantId): Promise<UserId | null> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM memberships
        WHERE tenant_id = $1 AND role = 'auditor' AND ends_at IS NULL
        ORDER BY starts_at ASC NULLS LAST
        LIMIT 1`,
      [tenantId],
    );
    const id = rows[0]?.user_id;
    return id ? (id as UserId) : null;
  });
};

export const engagementLabelFor = async (
  tenantId: TenantId,
  engagementId: EngagementId,
): Promise<{ organisation: string; status: string } | null> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      trading_name: string | null;
      legal_name: string;
      status: string;
    }>(
      `SELECT o.trading_name, o.legal_name, e.status
         FROM engagements e
         JOIN organisations o ON o.id = (SELECT organisation_id FROM teams t
                                          JOIN engagement_teams et ON et.team_id = t.id
                                         WHERE et.engagement_id = e.id
                                         LIMIT 1)
        WHERE e.tenant_id = $1 AND e.id = $2`,
      [tenantId, engagementId],
    );
    const row = rows[0];
    if (!row) return null;
    return { organisation: row.trading_name ?? row.legal_name, status: row.status };
  });
};
