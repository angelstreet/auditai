/**
 * AI worker (M9).
 *
 * Reads a `submissions` row joined with its `answers` and `question_items`,
 * runs the rule-based pipeline, and inserts an `analyses` row.
 *
 * The worker is invoked by the CLI in `scripts/smoke.ts` and is the place
 * where a real LLM-backed implementation will plug in (ADR 0007). For now
 * it is fully deterministic and requires no external API key.
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

export interface WorkerOptions {
  /** Postgres connection string. Falls back to process.env.DATABASE_URL. */
  readonly databaseUrl?: string;
  /** Identifier of the model route, stored on the analyses row. */
  readonly modelRoute?: string;
  /** pg client (for tests). */
  readonly client?: pg.Client;
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

  const ansRes = await client.query<AnswerRow>(
    `SELECT id, question_item_id, value_json, sequence
       FROM answers WHERE submission_id = $1 ORDER BY sequence ASC`,
    [submissionId],
  );
  const itemIds = Array.from(new Set(ansRes.rows.map((a) => a.question_item_id)));
  const items = new Map<string, QuestionItemRow>();
  if (itemIds.length > 0) {
    const itemRes = await client.query<QuestionItemRow>(
      `SELECT id, axis, code, kind, locale, prompt, options_json, scoring_json, sensitivity
         FROM question_items WHERE id = ANY ($1::uuid[])`,
      [itemIds],
    );
    for (const row of itemRes.rows) items.set(row.id, row);
  }
  return { submission: sub, answers: ansRes.rows, questionItems: items };
};

export const processSubmission = async (
  submissionId: string,
  options: WorkerOptions = {},
): Promise<AnalysisPayload | null> => {
  const url = options.databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required to run the AI worker');
  }
  const modelRoute = options.modelRoute ?? DEFAULT_MODEL_ROUTE;
  const ownsClient = !options.client;
  const client = options.client ?? new pg.Client({ connectionString: url });
  if (ownsClient) await client.connect();
  try {
    await client.query('SET ROLE auditai_app');
    await client.query(`SET app.is_service_account = 'on'`);

    const input = await loadPipelineInput(client, submissionId);
    if (!input) return null;
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
