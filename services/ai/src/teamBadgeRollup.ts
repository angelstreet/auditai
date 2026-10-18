import pg from 'pg';
import type { MascotTier, TenantId } from '@evolai/contracts';

/**
 * Team badge rollup worker (M14 slice C, FR-08, PRD §6, §9, §15).
 *
 * For every team in the tenant, counts the `is_current = TRUE`
 * `respondent_badges` rows by mascot tier, picks the modal tier (with
 * a deterministic alphabetical tie-break: fox > owl > tortoise),
 * and UPSERTs one `team_badges` row.
 *
 * No raw quiz_score ever leaves the `respondent_badges` table on the
 * read side of this worker; only the per-tier counts surface, and
 * those are bucketed before the SQL aggregate runs.
 */

export interface TeamBadgeRollupOptions {
  readonly databaseUrl?: string;
  readonly client?: pg.Client;
}

export interface TeamBadgeRollupResult {
  readonly teamsProcessed: number;
  readonly upserted: number;
}

interface TeamRollupInputRow {
  team_id: string;
  tortoise_count: number;
  fox_count: number;
  owl_count: number;
  member_count: number;
}

interface TeamRow {
  id: string;
}

const TIE_BREAK: ReadonlyArray<MascotTier> = ['fox', 'owl', 'tortoise'];

export const pickDominant = (row: {
  tortoise_count: number;
  fox_count: number;
  owl_count: number;
}): MascotTier => {
  const counts: Record<MascotTier, number> = {
    tortoise: row.tortoise_count,
    fox: row.fox_count,
    owl: row.owl_count,
  };
  const total = counts.tortoise + counts.fox + counts.owl;
  if (total === 0) return 'tortoise';
  const max = Math.max(...TIE_BREAK.map((t) => counts[t]));
  // TIE_BREAK order: fox > owl > tortoise. The first tier at the max wins.
  return TIE_BREAK.find((t) => counts[t] === max) ?? 'tortoise';
};

export const rollupTeamBadges = async (
  tenantId: TenantId,
  options: TeamBadgeRollupOptions = {},
): Promise<TeamBadgeRollupResult> => {
  const ownsClient = !options.client;
  const client = options.client ?? new pg.Client({ connectionString: options.databaseUrl });
  if (ownsClient) await client.connect();
  try {
    if (ownsClient) {
      await client.query('SET ROLE auditai_app');
    }
    // SET LOCAL is a no-op outside a transaction; a client we own runs in autocommit, so use a
    // session-level setting there (a caller-supplied client is already inside its transaction).
    await client.query(
      ownsClient ? `SET app.is_service_account = 'on'` : `SET LOCAL app.is_service_account = 'on'`,
    );

    // Pull every team in the tenant (RLS honours the role flag).
    const teamsRes = await client.query<TeamRow>(`SELECT id FROM teams WHERE tenant_id = $1`, [
      tenantId,
    ]);
    let upserted = 0;
    for (const t of teamsRes.rows) {
      // Aggregate the team's current badges by tier.
      const aggRes = await client.query<TeamRollupInputRow>(
        `SELECT
            $1::uuid AS team_id,
            count(*) FILTER (WHERE mascot_tier = 'tortoise')::int AS tortoise_count,
            count(*) FILTER (WHERE mascot_tier = 'fox')::int AS fox_count,
            count(*) FILTER (WHERE mascot_tier = 'owl')::int AS owl_count,
            count(*)::int AS member_count
           FROM respondent_badges
          WHERE tenant_id = $2 AND is_current = TRUE
            AND respondent_pseudonym IN (
              SELECT i.respondent_pseudonym
                FROM invitations i
                JOIN engagement_teams et ON et.team_id = $1 AND et.tenant_id = $2
               WHERE i.tenant_id = $2 AND i.engagement_id = et.engagement_id
            )`,
        [t.id, tenantId],
      );
      const agg = aggRes.rows[0] ?? {
        team_id: t.id,
        tortoise_count: 0,
        fox_count: 0,
        owl_count: 0,
        member_count: 0,
      };
      const dominantTier = pickDominant(agg);
      const upsert = await client.query(
        `INSERT INTO team_badges (
            tenant_id, team_id, dominant_tier, member_count,
            tortoise_count, fox_count, owl_count,
            computed_at, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, now(), now(), now()
          )
          ON CONFLICT (team_id) DO UPDATE
            SET dominant_tier = EXCLUDED.dominant_tier,
                member_count = EXCLUDED.member_count,
                tortoise_count = EXCLUDED.tortoise_count,
                fox_count = EXCLUDED.fox_count,
                owl_count = EXCLUDED.owl_count,
                computed_at = now(),
                updated_at = now()`,
        [
          tenantId,
          t.id,
          dominantTier,
          agg.member_count,
          agg.tortoise_count,
          agg.fox_count,
          agg.owl_count,
        ],
      );
      if (upsert.rows.length >= 0) {
        upserted += 1;
      }
    }
    return { teamsProcessed: teamsRes.rows.length, upserted };
  } finally {
    if (ownsClient) await client.end();
  }
};
