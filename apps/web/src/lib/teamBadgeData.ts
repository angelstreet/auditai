import type { MascotTier, TeamBadge, TenantId } from '@evolai/contracts';
import { withServiceAccount, withTenant } from './db';

/**
 * Team-badge data layer (M14 slice C, FR-08, PRD §6, §9, §15).
 *
 * Reads only ever expose the dominant mascot tier + the per-tier counts
 * (no raw quiz_score surfaces to the team profile). Writes come from
 * the rollup worker in services/ai.
 */

interface TeamBadgeRow {
  id: string;
  tenant_id: string;
  team_id: string;
  dominant_tier: MascotTier;
  member_count: number;
  tortoise_count: number;
  fox_count: number;
  owl_count: number;
  computed_at: string;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: TeamBadgeRow): TeamBadge => ({
  id: r.id,
  tenantId: r.tenant_id as TeamBadge['tenantId'],
  teamId: r.team_id,
  dominantTier: r.dominant_tier,
  memberCount: r.member_count,
  tortoiseCount: r.tortoise_count,
  foxCount: r.fox_count,
  owlCount: r.owl_count,
  computedAt: r.computed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const listTeamBadges = async (tenantId: TenantId): Promise<ReadonlyArray<TeamBadge>> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TeamBadgeRow>(
      `SELECT id, tenant_id, team_id, dominant_tier, member_count,
              tortoise_count, fox_count, owl_count,
              computed_at, created_at, updated_at
         FROM team_badges
        WHERE tenant_id = $1
        ORDER BY dominant_tier ASC, computed_at DESC`,
      [tenantId],
    );
    return rows.map(fromRow);
  });
};

export const listTeamsInTenant = async (
  tenantId: TenantId,
): Promise<ReadonlyArray<{ id: string; name: string }>> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM teams WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return rows.map((r) => ({ id: r.id, name: r.name }));
  });
};

/**
 * Cross-tenant teams (used by /board + smoke). Service-account read so the
 * board can aggregate when the actor is on multiple tenants.
 */
export const listAllTeamsAcrossTenants = async (): Promise<
  ReadonlyArray<{ id: string; tenantId: TenantId; name: string }>
> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ id: string; tenant_id: string; name: string }>(
      `SELECT id, tenant_id, name FROM teams ORDER BY tenant_id, name`,
    );
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id as TenantId,
      name: r.name,
    }));
  });
};
