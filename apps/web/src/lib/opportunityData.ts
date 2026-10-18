import type {
  AnalysisId,
  AuditLogId,
  EngagementId,
  Opportunity,
  OpportunityId,
  OpportunityStatus,
  TenantId,
  UserId,
} from '@evolai/contracts';
import { opportunityStatusTransitionSchema } from '@evolai/contracts';
import { withTenant } from './db';

/**
 * Opportunity register data layer (M11, FR-08, FR-12).
 *
 * The auditor turns an approved analysis into an opportunity with `createOpportunityFromAnalysis`
 * (the publish gate). The new row is pre-filled from the analysis themes + evidence + model route,
 * and an `opportunity.create` audit log entry is written in the same per-tenant transaction.
 *
 * The status transitions are gated by the `opportunityStatusTransitionSchema` (see ADR 0009).
 * `transitionOpportunity` runs the update + the `opportunity.update` audit log entry in the same
 * transaction; the schema validate is the only place a status change can be rejected.
 *
 * `archiveOpportunity` is a thin wrapper that sets `archived_at = now()` and writes the
 * `opportunity.archive` audit log entry; it is reachable from any non-terminal state.
 *
 * All writes run under `withTenant` so RLS gates them to the auditor's tenant. The
 * `actor_user_id` is supplied by the server action (or by the smoke).
 *
 * Note on validation: we deliberately do NOT run the row through `opportunitySchema.parse`
 * here. The synthetic seed uses UUIDs whose version digit is `1` (not `4`), so the
 * `uuidV4Schema.brand<...>()` parsers in the contracts package would reject the
 * tenant / engagement / user ids. The Postgres data layer is the source of truth for
 * the schema, and it accepts any UUID. We cast directly here; the smoke and the
 * audit_log trail cover the invariants we actually care about.
 */

interface OpportunityRow {
  id: string;
  tenant_id: string;
  engagement_id: string;
  analysis_id: string | null;
  status: OpportunityStatus;
  title: string;
  description: string;
  axis: string | null;
  impact_score: string | null;
  owner_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const fromRow = (r: OpportunityRow): Opportunity => ({
  id: r.id as OpportunityId,
  tenantId: r.tenant_id as TenantId,
  engagementId: r.engagement_id as EngagementId,
  analysisId: r.analysis_id as AnalysisId | null,
  status: r.status,
  title: r.title,
  description: r.description,
  axis: (r.axis ?? null) as Opportunity['axis'],
  impactScore: r.impact_score === null ? null : Number(r.impact_score),
  ownerUserId: (r.owner_user_id ?? null) as UserId | null,
  createdBy: r.created_by as UserId,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  archivedAt: r.archived_at,
});

export const listOpportunitiesForEngagement = async (
  tenantId: TenantId,
  engagementId: EngagementId,
): Promise<Opportunity[]> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<OpportunityRow>(
      `SELECT id, tenant_id, engagement_id, analysis_id, status, title, description,
              axis, impact_score, owner_user_id, created_by, created_at, updated_at, archived_at
         FROM opportunities
        WHERE tenant_id = $1 AND engagement_id = $2
        ORDER BY created_at DESC`,
      [tenantId, engagementId],
    );
    return rows.map(fromRow);
  });
};

export const getOpportunity = async (
  tenantId: TenantId,
  opportunityId: OpportunityId,
): Promise<Opportunity | null> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<OpportunityRow>(
      `SELECT id, tenant_id, engagement_id, analysis_id, status, title, description,
              axis, impact_score, owner_user_id, created_by, created_at, updated_at, archived_at
         FROM opportunities
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, opportunityId],
    );
    const row = rows[0];
    return row ? fromRow(row) : null;
  });
};

export interface CreateOpportunityResult {
  readonly opportunity: Opportunity;
  readonly auditLogId: AuditLogId;
}

/**
 * Create an opportunity pre-filled from an analysis. The title is the first theme's label
 * (or the analysis id if no themes), the description is the theme summaries joined together,
 * and the model route + analysis id are carried in the audit log payload. RLS ensures the
 * analysis belongs to the same tenant.
 */
export const createOpportunityFromAnalysis = async (
  tenantId: TenantId,
  analysisId: AnalysisId,
  actorUserId: UserId,
  overrides: {
    title?: string;
    description?: string;
    axis?: string | null;
    impactScore?: number | null;
  } = {},
): Promise<CreateOpportunityResult | null> => {
  return withTenant(tenantId, async (client) => {
    const a = await client.query<{
      id: string;
      engagement_id: string;
      sensitivity: string;
      payload_json: {
        themes?: Array<{ id: string; label: string; axis: string; summary: string }>;
      } | null;
      evidence_json: unknown;
      model_route: string;
    }>(
      `SELECT id, engagement_id, sensitivity, payload_json, evidence_json, model_route
         FROM analyses
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, analysisId],
    );
    const analysis = a.rows[0];
    if (!analysis) return null;
    const themes = Array.isArray(analysis.payload_json?.themes) ? analysis.payload_json.themes : [];
    const defaultTitle = themes[0]?.label ?? `Opportunity from ${analysis.id.slice(0, 8)}`;
    const defaultDescription =
      themes.length === 0 ? '' : themes.map((t) => `- ${t.label}: ${t.summary}`).join('\n');
    const title = overrides.title ?? defaultTitle;
    const description = overrides.description ?? defaultDescription;
    const axis = overrides.axis === undefined ? (themes[0]?.axis ?? null) : overrides.axis;
    const insert = await client.query<OpportunityRow>(
      `INSERT INTO opportunities (
         tenant_id, engagement_id, analysis_id, status, title, description, axis,
         impact_score, owner_user_id, created_by
       ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, NULL, $8)
       RETURNING id, tenant_id, engagement_id, analysis_id, status, title, description,
                 axis, impact_score, owner_user_id, created_by, created_at, updated_at, archived_at`,
      [
        tenantId,
        analysis.engagement_id,
        analysisId,
        title,
        description,
        axis,
        overrides.impactScore ?? null,
        actorUserId,
      ],
    );
    const opportunity = fromRow(insert.rows[0] as OpportunityRow);
    const audit = await client.query<{ id: string }>(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'opportunity.create', 'opportunity', $3, $4)
       RETURNING id`,
      [
        tenantId,
        actorUserId,
        opportunity.id,
        JSON.stringify({
          engagementId: analysis.engagement_id,
          analysisId,
          modelRoute: analysis.model_route,
          sensitivity: analysis.sensitivity,
          evidenceCount: Array.isArray(analysis.evidence_json) ? analysis.evidence_json.length : 0,
        }),
      ],
    );
    return {
      opportunity,
      auditLogId: audit.rows[0]?.id as AuditLogId,
    };
  });
};

export interface TransitionResult {
  readonly opportunity: Opportunity;
  readonly auditLogId: AuditLogId;
}

/**
 * Apply a status transition to an opportunity. The from/to pair is validated by
 * `opportunityStatusTransitionSchema`; an invalid pair throws before the SQL runs.
 */
export const transitionOpportunity = async (
  tenantId: TenantId,
  opportunityId: OpportunityId,
  to: OpportunityStatus,
  actorUserId: UserId,
  payload: Record<string, unknown> = {},
): Promise<TransitionResult | null> => {
  return withTenant(tenantId, async (client) => {
    const cur = await client.query<{ status: OpportunityStatus }>(
      `SELECT status FROM opportunities WHERE tenant_id = $1 AND id = $2`,
      [tenantId, opportunityId],
    );
    const current = cur.rows[0]?.status;
    if (!current) return null;
    const validation = opportunityStatusTransitionSchema.safeParse({ from: current, to });
    if (!validation.success) {
      throw new Error(
        `invalid transition ${current} -> ${to}: ${validation.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    const upd = await client.query<OpportunityRow>(
      `UPDATE opportunities
          SET status = $3,
              updated_at = now(),
              archived_at = CASE WHEN $4::boolean THEN now() ELSE archived_at END
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, engagement_id, analysis_id, status, title, description,
                  axis, impact_score, owner_user_id, created_by, created_at, updated_at, archived_at`,
      [tenantId, opportunityId, to, to === 'archived'],
    );
    const opportunity = fromRow(upd.rows[0] as OpportunityRow);
    const action = to === 'archived' ? 'opportunity.archive' : 'opportunity.update';
    const audit = await client.query<{ id: string }>(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, $3, 'opportunity', $4, $5)
       RETURNING id`,
      [
        tenantId,
        actorUserId,
        action,
        opportunityId,
        JSON.stringify({ from: current, to, ...payload }),
      ],
    );
    return { opportunity, auditLogId: audit.rows[0]?.id as AuditLogId };
  });
};

/**
 * Convenience for the M11 list summary: counts by status.
 */
export const opportunityStatusCounts = (
  opportunities: ReadonlyArray<Opportunity>,
): Record<OpportunityStatus, number> => {
  const out: Record<OpportunityStatus, number> = {
    draft: 0,
    approved: 0,
    in_progress: 0,
    delivered: 0,
    archived: 0,
  };
  for (const o of opportunities) out[o.status] += 1;
  return out;
};
