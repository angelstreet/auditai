import type { Synergy, SynergyId, SynergyStatus, TenantId, UserId } from '@auditai/contracts';
import { synergyStatusTransitionSchema } from '@auditai/contracts';
import { withTenant } from './db';

/**
 * Synergy data layer (M13 slice C, FR-14, PRD §10, §25.4).
 *
 * `listSynergies(tenantId)` returns every detected/surfaced/dismissed/archived
 * row for the actor's tenant. `transitionSynergy(synergyId, nextStatus, actor)`
 * validates the transition via `synergyStatusTransitionSchema` and writes one
 * `audit_log` row with the right action verb. The whole update + audit-log
 * pair runs in a single `withTenant` transaction so partial failures leave no
 * loose ends.
 */

interface SynergyRow {
  id: string;
  tenant_id: string;
  axis: string;
  theme_label: string;
  synergy_key: string;
  source_analysis_ids: string[];
  source_engagement_ids: string[];
  occurrence_count: number;
  proposed_followup_prompt: string;
  status: SynergyStatus;
  detected_at: string;
  surfaced_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: SynergyRow): Synergy => ({
  id: r.id as SynergyId,
  tenantId: r.tenant_id as Synergy['tenantId'],
  axis: r.axis as Synergy['axis'],
  themeLabel: r.theme_label,
  synergyKey: r.synergy_key as Synergy['synergyKey'],
  sourceAnalysisIds: r.source_analysis_ids as Synergy['sourceAnalysisIds'],
  sourceEngagementIds: r.source_engagement_ids as Synergy['sourceEngagementIds'],
  occurrenceCount: r.occurrence_count,
  proposedFollowupPrompt: r.proposed_followup_prompt,
  status: r.status,
  detectedAt: r.detected_at,
  surfacedAt: r.surfaced_at,
  dismissedAt: r.dismissed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const listSynergies = async (tenantId: TenantId): Promise<ReadonlyArray<Synergy>> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<SynergyRow>(
      `SELECT id, tenant_id, axis, theme_label, synergy_key,
              source_analysis_ids, source_engagement_ids, occurrence_count,
              proposed_followup_prompt, status,
              detected_at, surfaced_at, dismissed_at,
              created_at, updated_at
         FROM synergies
        WHERE tenant_id = $1
        ORDER BY detected_at DESC`,
      [tenantId],
    );
    return rows.map(fromRow);
  });
};

/**
 * The auditor action: transition a single synergy's status, auditing every move.
 * Throws when the transition is illegal (the schema + a final check both validate).
 */
export const transitionSynergy = async (
  tenantId: TenantId,
  synergyId: SynergyId,
  nextStatus: SynergyStatus,
  actorUserId: UserId,
): Promise<Synergy> => {
  return withTenant(tenantId, async (client) => {
    const readRes = await client.query<SynergyRow>(
      `SELECT id, tenant_id, axis, theme_label, synergy_key,
              source_analysis_ids, source_engagement_ids, occurrence_count,
              proposed_followup_prompt, status,
              detected_at, surfaced_at, dismissed_at,
              created_at, updated_at
         FROM synergies
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, synergyId],
    );
    const current = readRes.rows[0];
    if (!current) {
      throw new Error(`synergy ${synergyId} not found in tenant ${tenantId}`);
    }
    const parsed = synergyStatusTransitionSchema.safeParse({
      from: current.status,
      to: nextStatus,
    });
    if (!parsed.success) {
      throw new Error(
        `illegal synergy transition ${current.status} -> ${nextStatus}: ${parsed.error.issues
          .map((i) => i.message)
          .join('; ')}`,
      );
    }
    const surfacingColumn = nextStatus === 'surfaced' ? ', surfaced_at = now()' : '';
    const dismissingColumn = nextStatus === 'dismissed' ? ', dismissed_at = now()' : '';
    const actionVerb: 'synergy.surface' | 'synergy.dismiss' | 'synergy.archive' =
      nextStatus === 'surfaced'
        ? 'synergy.surface'
        : nextStatus === 'dismissed'
          ? 'synergy.dismiss'
          : 'synergy.archive';
    const upd = await client.query<SynergyRow>(
      `UPDATE synergies
          SET status = $1 ${surfacingColumn} ${dismissingColumn}, updated_at = now()
        WHERE tenant_id = $2 AND id = $3
       RETURNING id, tenant_id, axis, theme_label, synergy_key,
                 source_analysis_ids, source_engagement_ids, occurrence_count,
                 proposed_followup_prompt, status,
                 detected_at, surfaced_at, dismissed_at,
                 created_at, updated_at`,
      [nextStatus, tenantId, synergyId],
    );
    if (upd.rows.length === 0) {
      throw new Error(`synergy ${synergyId} update did not return a row`);
    }
    const updated = upd.rows[0] as SynergyRow;
    await client.query(
      `INSERT INTO audit_log (
          tenant_id, actor_user_id, action, target_kind, target_id, payload_json
        ) VALUES ($1, $2, $3, 'synergy', $4, $5::jsonb)`,
      [
        tenantId,
        actorUserId,
        actionVerb,
        synergyId,
        JSON.stringify({ from: current.status, to: nextStatus }),
      ],
    );
    return fromRow(updated);
  });
};
