import { createHash } from 'node:crypto';
import pg from 'pg';
import type { TenantId } from '@evolai/contracts';
import type { AnalysisPayload } from './pipeline.js';

/**
 * Cross-team synergy detector (M13 slice B, FR-14, PRD §10).
 *
 * Reads every approved analysis for the given tenant, groups the
 * `analysis.themes` by `(axis, themeLabel.lower())`, and writes one row
 * per group that crosses at least two engagements to the `synergies`
 * table. Each detection also writes one `audit_log` row with
 * action `synergy.detect` and target_kind `synergy`, so the trail stays
 * append-only and reproducible.
 *
 * The work is idempotent: the unique index `(tenant_id, synergy_key)`
 * collapses repeats. Re-running the worker after a new analysis lands
 * appends the new source ids to the JSONB arrays and recomputes
 * `source_engagement_ids` + `occurrence_count` deterministically.
 */

export interface SynergyDetectionOptions {
  readonly databaseUrl?: string;
  readonly client?: pg.Client;
  /** When true, prevents any UPDATE/INSERT. Defaults to false. */
  readonly dryRun?: boolean;
  /** The actor user id recorded in audit_log for every detected synergy. */
  readonly actorUserId?: string;
}

export interface SynergyDetectionResult {
  readonly detected: number;
  readonly reused: number;
  readonly proposedFollowupPrompts: ReadonlyArray<string>;
}

interface ApprovedAnalysisRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly engagement_id: string;
  readonly payload_json: AnalysisPayload;
}

interface ExistingSynergyRow {
  readonly id: string;
  readonly source_analysis_ids: ReadonlyArray<string>;
}

const synthPromptFor = (axis: string, label: string): string =>
  `Across the engagements we reviewed, the "${label}" pattern comes back on the ${axis} axis. ` +
  `Where in the workflow does your team currently handle this — and where does it still slip? ` +
  `(synergy surfaced by the cross-team detector for the next interview round)`;

const synergyKeyFor = (axis: string, themeLabel: string): string => {
  const seed = `${axis}|${themeLabel.toLowerCase().trim()}`;
  return createHash('sha1').update(seed).digest('hex');
};

const mergeJsonbStringArray = (
  current: ReadonlyArray<string>,
  incoming: ReadonlyArray<string>,
): { merged: string[]; added: string[] } => {
  const seen = new Set(current);
  const added: string[] = [];
  for (const id of incoming) {
    if (!seen.has(id)) {
      seen.add(id);
      added.push(id);
    }
  }
  return { merged: Array.from(seen), added };
};

export const detectCrossTeamSynergies = async (
  tenantId: TenantId,
  options: SynergyDetectionOptions = {},
): Promise<SynergyDetectionResult> => {
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

    // 1. Pull every approved analysis for the tenant.
    const analysesRes = await client.query<ApprovedAnalysisRow>(
      `SELECT id, tenant_id, engagement_id, payload_json
         FROM analyses
        WHERE tenant_id = $1
          AND approved_at IS NOT NULL
          AND payload_json ? 'themes'`,
      [tenantId],
    );

    // 2. Group themes by (axis, label.lower()).
    type Group = {
      axis: string;
      label: string;
      key: string;
      sourceAnalysisIds: string[];
      sourceEngagementIds: Set<string>;
    };
    const groups = new Map<string, Group>();
    for (const row of analysesRes.rows) {
      const themes = row.payload_json.themes ?? [];
      for (const theme of themes) {
        if (!theme.axis || !theme.label) continue;
        const key = synergyKeyFor(theme.axis, theme.label);
        const existing = groups.get(key);
        if (existing) {
          if (!existing.sourceAnalysisIds.includes(row.id)) {
            existing.sourceAnalysisIds.push(row.id);
          }
          existing.sourceEngagementIds.add(row.engagement_id);
        } else {
          groups.set(key, {
            axis: theme.axis,
            label: theme.label,
            key,
            sourceAnalysisIds: [row.id],
            sourceEngagementIds: new Set([row.engagement_id]),
          });
        }
      }
    }

    // 3. Filter to groups that cross at least two engagements.
    const cross = Array.from(groups.values()).filter(
      (g) => g.sourceEngagementIds.size >= 2 && g.sourceAnalysisIds.length >= 2,
    );

    let detected = 0;
    let reused = 0;
    const proposed: string[] = [];
    const actorUserId = options.actorUserId ?? null;

    for (const g of cross) {
      const engagementIds = Array.from(g.sourceEngagementIds);
      const proposedFollowupPrompt = synthPromptFor(g.axis, g.label);
      if (options.dryRun) {
        proposed.push(proposedFollowupPrompt);
        continue;
      }
      // 3a. Pull the existing synergy row (if any) so we can merge source ids idempotently.
      const existing = await client.query<ExistingSynergyRow>(
        `SELECT id, source_analysis_ids
           FROM synergies
          WHERE tenant_id = $1 AND synergy_key = $2`,
        [tenantId, g.key],
      );
      const existingIds = existing.rows[0]?.source_analysis_ids?.map((x) => String(x)) ?? [];
      const { merged } = mergeJsonbStringArray(existingIds, g.sourceAnalysisIds);
      const occurrenceCount = new Set(engagementIds).size;

      // 3b. Upsert into synergies.
      const upsert = await client.query<{ id: string; created: boolean }>(
        `INSERT INTO synergies (
            tenant_id, axis, theme_label, synergy_key,
            source_analysis_ids, source_engagement_ids,
            occurrence_count, proposed_followup_prompt,
            status, detected_at, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8,
            'detected', now(), now(), now()
          )
          ON CONFLICT (tenant_id, synergy_key) DO UPDATE
            SET source_analysis_ids = EXCLUDED.source_analysis_ids,
                source_engagement_ids = EXCLUDED.source_engagement_ids,
                occurrence_count = EXCLUDED.occurrence_count,
                proposed_followup_prompt = EXCLUDED.proposed_followup_prompt,
                updated_at = now()
          RETURNING id, (xmax = 0) AS created`,
        [
          tenantId,
          g.axis,
          g.label,
          g.key,
          JSON.stringify(merged),
          JSON.stringify(engagementIds),
          occurrenceCount,
          proposedFollowupPrompt,
        ],
      );
      const row = upsert.rows[0];
      if (!row) continue;
      const synergyId = row.id;
      const isNew = row.created;
      if (isNew) detected += 1;
      else reused += 1;
      proposed.push(proposedFollowupPrompt);

      // 3c. Audit-log the detection. The action is purely additive; a re-detect
      //     writes a new audit row that points at the same synergy, so the
      //     trail documents the run that last touched it.
      if (actorUserId !== null) {
        await client.query(
          `INSERT INTO audit_log (
              tenant_id, actor_user_id, action, target_kind, target_id, payload_json
            ) VALUES ($1, $2, 'synergy.detect', 'synergy', $3, $4::jsonb)`,
          [
            tenantId,
            actorUserId,
            synergyId,
            JSON.stringify({
              themeLabel: g.label,
              axis: g.axis,
              engagementCount: occurrenceCount,
              createdNow: isNew,
            }),
          ],
        );
      }
    }

    return { detected, reused, proposedFollowupPrompts: proposed };
  } finally {
    if (ownsClient) await client.end();
  }
};
