/**
 * AI worker (M9).
 *
 * Reads a `submissions` row joined with its `answers` and `question_items`,
 * runs the rule-based pipeline, and inserts an `analyses` row.
 *
 * The worker is invoked by the CLI in `scripts/smoke.ts`. The route comes from
 * `EVOLAI_AI_*` env vars checked against the allowlist (ADR 0029): with none set it
 * runs the deterministic rule-based pipeline and needs no key; with an approved model
 * route it runs the model-backed pipeline in `llm/llmPipeline.ts`, which fails closed.
 */
import pg from 'pg';
import {
  runPipeline,
  type AnalysisPayload,
  type AnswerRow,
  type PipelineInput,
  type QuestionItemRow,
  type SubmissionRow,
} from './pipeline.js';
import { loadAiConfig, resolveRoute, type AiConfig } from './llm/config.js';
import { runLlmPipeline, type LlmPipelineResult } from './llm/llmPipeline.js';
import { stderrLogger, type AiLogger } from './llm/log.js';
import { createProvider, type ModelProvider } from './llm/providers.js';

export interface WorkerOptions {
  /** Postgres connection string. Falls back to process.env.DATABASE_URL. */
  readonly databaseUrl?: string;
  /** Identifier of the model route, stored on the analyses row. */
  readonly modelRoute?: string;
  /** pg client (for tests). */
  readonly client?: pg.Client;
  /** Env to resolve the AI route from. Defaults to process.env. */
  readonly env?: NodeJS.ProcessEnv;
  /** AI config (allowlist, caps, rates). Defaults to `loadAiConfig(env)`. */
  readonly config?: AiConfig;
  /** Model provider (for tests). Overrides the route from env. */
  readonly provider?: ModelProvider;
  readonly log?: AiLogger;
}

const DEFAULT_MODEL_ROUTE = 'rule-based/v1';

const loadPipelineInput = async (
  client: pg.Client,
  submissionId: string,
): Promise<PipelineInput | null> => {
  const subRes = await client.query<SubmissionRow>(
    `SELECT id, tenant_id, engagement_id, invitation_id, status, locale,
            started_at, submitted_at
       FROM submissions WHERE id = $1`,
    [submissionId],
  );
  const sub = subRes.rows[0];
  if (!sub) return null;

  // Only this tenant's rows are loaded; the LLM path re-checks every row before a model call.
  const ansRes = await client.query<AnswerRow>(
    `SELECT id, tenant_id, submission_id, question_item_id, value_json, sequence
       FROM answers WHERE submission_id = $1 AND tenant_id = $2 ORDER BY sequence ASC`,
    [submissionId, sub.tenant_id],
  );
  const itemIds = Array.from(new Set(ansRes.rows.map((a) => a.question_item_id)));
  const items = new Map<string, QuestionItemRow>();
  if (itemIds.length > 0) {
    const itemRes = await client.query<QuestionItemRow>(
      `SELECT id, tenant_id, axis, code, kind, locale, prompt, options_json, scoring_json, sensitivity
         FROM question_items WHERE id = ANY ($1::uuid[]) AND tenant_id = $2`,
      [itemIds, sub.tenant_id],
    );
    for (const row of itemRes.rows) items.set(row.id, row);
  }
  return { submission: sub, answers: ansRes.rows, questionItems: items };
};

const loadRedactionTerms = async (client: pg.Client, tenantId: string): Promise<string[]> => {
  const r = await client.query<{ term: string }>(
    'SELECT term FROM ai_redaction_terms WHERE tenant_id = $1',
    [tenantId],
  );
  return r.rows.map((x) => x.term);
};

const loadMonthSpend = async (client: pg.Client, tenantId: string): Promise<number> => {
  const r = await client.query<{ spend: string }>(
    `SELECT COALESCE(SUM(cost_amount), 0)::text AS spend
       FROM analyses
      WHERE tenant_id = $1 AND generated_at >= date_trunc('month', now())`,
    [tenantId],
  );
  return Number(r.rows[0]?.spend ?? 0);
};

/** Write a model-drafted analysis. `approved_at` stays NULL: an auditor must approve it. */
const writeLlmAnalysis = async (
  client: pg.Client,
  input: PipelineInput,
  { payload, meta }: LlmPipelineResult,
): Promise<void> => {
  await client.query(
    `INSERT INTO analyses (
       tenant_id, engagement_id, submission_id, version, sensitivity,
       theme_count, prompt_count, payload_json, evidence_json, model_route,
       model_provider, model_name, model_version, model_region, prompt_version,
       input_record_ids, unsupported_json, input_tokens, output_tokens, cost_amount,
       cost_currency, rate_effective_from, generated_at, duration_ms
     ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
               $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT (submission_id, version) DO UPDATE SET
       sensitivity = EXCLUDED.sensitivity,
       theme_count = EXCLUDED.theme_count,
       prompt_count = EXCLUDED.prompt_count,
       payload_json = EXCLUDED.payload_json,
       evidence_json = EXCLUDED.evidence_json,
       model_route = EXCLUDED.model_route,
       model_provider = EXCLUDED.model_provider,
       model_name = EXCLUDED.model_name,
       model_version = EXCLUDED.model_version,
       model_region = EXCLUDED.model_region,
       prompt_version = EXCLUDED.prompt_version,
       input_record_ids = EXCLUDED.input_record_ids,
       unsupported_json = EXCLUDED.unsupported_json,
       input_tokens = EXCLUDED.input_tokens,
       output_tokens = EXCLUDED.output_tokens,
       cost_amount = EXCLUDED.cost_amount,
       cost_currency = EXCLUDED.cost_currency,
       rate_effective_from = EXCLUDED.rate_effective_from,
       generated_at = EXCLUDED.generated_at,
       duration_ms = EXCLUDED.duration_ms,
       approved_at = NULL,
       approved_by = NULL,
       updated_at = now()`,
    [
      input.submission.tenant_id,
      input.submission.engagement_id,
      input.submission.id,
      payload.sensitivity,
      payload.themes.length,
      payload.interviewPrompts.length,
      JSON.stringify(payload),
      JSON.stringify(payload.evidence),
      meta.routeId,
      meta.provider,
      meta.model,
      meta.modelVersion,
      meta.region,
      meta.promptVersion,
      JSON.stringify(meta.inputRecordIds),
      JSON.stringify(payload.unsupported ?? []),
      meta.inputTokens,
      meta.outputTokens,
      meta.cost,
      meta.currency,
      meta.rateEffectiveFrom,
      meta.generatedAt,
      meta.durationMs,
    ],
  );
};

export const processSubmission = async (
  submissionId: string,
  options: WorkerOptions = {},
): Promise<AnalysisPayload | null> => {
  const url = options.databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required to run the AI worker');
  }
  const env = options.env ?? process.env;
  let provider = options.provider ?? null;
  let config = options.config ?? null;
  if (!provider) {
    config = config ?? loadAiConfig(env);
    provider = createProvider(config, resolveRoute(config, env));
  }
  const modelRoute = provider ? provider.route.id : (options.modelRoute ?? DEFAULT_MODEL_ROUTE);
  const ownsClient = !options.client;
  const client = options.client ?? new pg.Client({ connectionString: url });
  if (ownsClient) await client.connect();
  try {
    await client.query('SET ROLE auditai_app');
    await client.query(`SET app.is_service_account = 'on'`);

    const input = await loadPipelineInput(client, submissionId);
    if (!input) return null;
    if (provider) {
      const result = await runLlmPipeline(input, {
        provider,
        config: config ?? loadAiConfig(env),
        tenantNames: await loadRedactionTerms(client, input.submission.tenant_id),
        tenantMonthSpend: await loadMonthSpend(client, input.submission.tenant_id),
        log: options.log ?? stderrLogger,
      });
      await writeLlmAnalysis(client, input, result);
      return result.payload;
    }
    const payload = runPipeline(input);

    await client.query(
      `INSERT INTO analyses (
         tenant_id, engagement_id, submission_id, version, sensitivity,
         theme_count, prompt_count, payload_json, evidence_json, model_route
       ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (submission_id, version) DO UPDATE SET
         sensitivity = EXCLUDED.sensitivity,
         theme_count = EXCLUDED.theme_count,
         prompt_count = EXCLUDED.prompt_count,
         payload_json = EXCLUDED.payload_json,
         evidence_json = EXCLUDED.evidence_json,
         model_route = EXCLUDED.model_route,
         updated_at = now()`,
      [
        input.submission.tenant_id,
        input.submission.engagement_id,
        input.submission.id,
        payload.sensitivity,
        payload.themes.length,
        payload.interviewPrompts.length,
        JSON.stringify(payload),
        JSON.stringify(payload.evidence),
        modelRoute,
      ],
    );
    return payload;
  } finally {
    if (ownsClient) await client.end();
  }
};

export const processAllSubmitted = async (
  options: WorkerOptions = {},
): Promise<{ processed: number; failures: number }> => {
  const url = options.databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required to run the AI worker');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let processed = 0;
  let failures = 0;
  try {
    await client.query('SET ROLE auditai_app');
    await client.query(`SET app.is_service_account = 'on'`);
    const r = await client.query<{ id: string }>(
      `SELECT s.id
         FROM submissions s
         LEFT JOIN analyses a ON a.submission_id = s.id AND a.version = 1
        WHERE s.status = 'submitted' AND a.id IS NULL`,
    );
    for (const row of r.rows) {
      try {
        const out = await processSubmission(row.id, { ...options, client });
        if (out) processed += 1;
        else failures += 1;
      } catch (err) {
        failures += 1;
        process.stderr.write(
          `processSubmission(${row.id}) failed: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
  } finally {
    await client.end();
  }
  return { processed, failures };
};

/** The default worker used by the CLI. */
export const defaultWorker = { processSubmission, processAllSubmitted };
