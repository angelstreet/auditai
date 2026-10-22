import {
  createProvider,
  parseAiConfig,
  processSubmission,
  resolveRoute,
  type AiConfig,
} from '@evolai/ai';
import type { EngagementId, TenantId, UserId } from '@evolai/contracts';
import bundledConfig from '../../../../services/ai/config/ai.config.json';
import { withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * "Run analysis" (TASK-AA, ADR 0048): runs the AI worker's pipeline for one engagement on the
 * submitted answers that have no analysis yet. The pipeline itself is unchanged: free text was
 * anonymised on ingestion, names are redacted before any model call, the route must be on the
 * allowlist, and every analysis stays unapproved until an auditor approves it. Nothing here is
 * client-facing. Idempotent: an answer set with an analysis is never analysed again.
 */

/** Most answer sets in one click, and the time after which no new one is started. */
export const MAX_PER_RUN = 25;
export const TIME_BUDGET_MS = 40_000;

export type RunOutcome =
  | {
      ok: true;
      analysed: number;
      themes: number;
      remaining: number;
      total: number;
      route: string;
      ruleBased: boolean;
    }
  | { ok: false; code: 'not_found' | 'no_route' | 'failed' }
  | { ok: false; code: 'too_few'; have: number };

export interface RunDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly config?: AiConfig;
  readonly now?: () => number;
  readonly analyseOne?: typeof processSubmission;
}

export const runAnalysis = async (
  tenantId: TenantId,
  engagementId: EngagementId,
  actor: UserId,
  deps: RunDeps = {},
): Promise<RunOutcome> => {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const analyseOne = deps.analyseOne ?? processSubmission;

  const state = await withTenant(tenantId, async (client) => {
    const eng = await client.query('SELECT 1 FROM engagements WHERE id = $1 AND tenant_id = $2', [
      engagementId,
      tenantId,
    ]);
    if (eng.rowCount === 0) return null;
    const { rows } = await client.query<{ id: string; analysed: boolean }>(
      `SELECT s.id, (a.id IS NOT NULL) AS analysed
         FROM submissions s
         LEFT JOIN analyses a ON a.submission_id = s.id AND a.version = 1
        WHERE s.tenant_id = $1 AND s.engagement_id = $2 AND s.status = 'submitted'
        ORDER BY s.submitted_at ASC, s.id ASC`,
      [tenantId, engagementId],
    );
    return rows;
  });
  if (!state) return { ok: false, code: 'not_found' };
  if (state.length < MIN_GROUP_SIZE) return { ok: false, code: 'too_few', have: state.length };

  // Fail closed: a route that is not on the allowlist, or has no key, never reaches a model.
  let config: AiConfig;
  let provider: ReturnType<typeof createProvider>;
  let route: ReturnType<typeof resolveRoute>;
  try {
    config = deps.config ?? parseAiConfig(bundledConfig);
    route = resolveRoute(config, env);
    provider = createProvider(config, route);
  } catch {
    return { ok: false, code: 'no_route' };
  }
  const ruleBased = route.provider === 'rule-based';

  const pending = state.filter((s) => !s.analysed).map((s) => s.id);
  const start = now();
  const themes = new Set<string>();
  let analysed = 0;
  let failed = 0;
  let attempted = 0;
  for (const id of pending) {
    if (attempted >= MAX_PER_RUN || (attempted > 0 && now() - start > TIME_BUDGET_MS)) break;
    attempted += 1;
    try {
      const payload = await withTenant(tenantId, (client) =>
        analyseOne(id, {
          client,
          scopedClient: true,
          config,
          env,
          ...(provider ? { provider } : {}),
        }),
      );
      if (payload) {
        analysed += 1;
        for (const th of payload.themes) themes.add(`${th.axis}|${th.label}`);
      } else {
        failed += 1;
      }
    } catch (err) {
      failed += 1;
      // The message may quote an answer; log the kind of failure only.
      console.error('analysis failed for one answer set', err instanceof Error ? err.name : 'error');
    }
  }
  const remaining = pending.length - attempted;

  if (pending.length > 0 && analysed === 0 && failed > 0) return { ok: false, code: 'failed' };

  if (attempted > 0) {
    // Who, when, which route and counts. Never an answer, a theme text or a respondent code.
    await withTenant(tenantId, (client) =>
      client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, 'analysis.run', 'engagement', $3, $4)`,
        [
          tenantId,
          actor,
          engagementId,
          JSON.stringify({ route: route.id, analysed, failed, remaining, themes: themes.size }),
        ],
      ),
    );
  }
  return {
    ok: true,
    analysed,
    themes: themes.size,
    remaining,
    total: state.length,
    route: route.id,
    ruleBased,
  };
};
