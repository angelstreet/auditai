/**
 * Model-backed synthesis (TASK-H, PRD §10, ADR 0029).
 *
 * Steps, in order, each one able to stop the run (fail closed):
 *
 * 1. tenant check: every answer and question item belongs to the submission's tenant;
 * 2. route check: the provider's route is on the allowlist;
 * 3. sensitivity: the rule-based classifier, raised to `sensitive` when redaction found PII;
 * 4. redaction: personal data replaced with placeholders before anything leaves the process;
 * 5. cost ceiling: token estimate and caps checked before the call;
 * 6. model call: one structured call; invalid output gets one retry, then the run fails;
 * 7. grounding: `verifyOutput` drops every claim whose citation or numbers do not check out;
 * 8. restore: placeholders put back for this tenant only, and the draft is returned.
 *
 * The result is always a draft (`approved_at` NULL); the auditor approves it in the UI.
 */
import { classifySensitivity, labelFor } from '../pipeline.js';
import type {
  AnalysisClaim,
  AnalysisPayload,
  AnswerRow,
  PipelineInput,
  QuestionItemRow,
} from '../pipeline.js';
import { assertApproved, type AiConfig } from './config.js';
import { checkBudget, costOf, estimateTokens, findRate } from './costs.js';
import { noopLogger, type AiLogger } from './log.js';
import { buildPrompt, modelOutputSchema, parseModelJson, PROMPT_VERSION } from './prompt.js';
import type { ModelOutput, PromptAnswer } from './prompt.js';
import type { ModelProvider } from './providers.js';
import { Redactor } from './redaction.js';
import { verifyOutput } from './verify.js';

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

export class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

export interface AnalysisMeta {
  readonly routeId: string;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly region: string;
  readonly promptVersion: string;
  readonly inputRecordIds: ReadonlyArray<string>;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: number;
  readonly currency: string;
  readonly rateEffectiveFrom: string;
  readonly generatedAt: string;
  readonly durationMs: number;
  readonly attempts: number;
}

export interface LlmPipelineDeps {
  readonly provider: ModelProvider;
  readonly config: AiConfig;
  /** The tenant's own list of names to redact. */
  readonly tenantNames?: ReadonlyArray<string>;
  /** Cost already recorded for the tenant this calendar month. */
  readonly tenantMonthSpend?: number;
  readonly now?: () => Date;
  readonly log?: AiLogger;
}

export interface LlmPipelineResult {
  readonly payload: AnalysisPayload;
  readonly meta: AnalysisMeta;
  /** Items the model proposed, all kinds (for the eval). */
  readonly proposed: number;
}

/** Text of one answer as the respondent saw it: option labels for choices, raw text otherwise. */
export const answerText = (item: QuestionItemRow, value: unknown): string => {
  if (Array.isArray(value)) return value.map((v) => labelFor(item, v)).join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return labelFor(item, value);
};

/** Refuse input that mixes tenants or submissions, or lacks the ids to prove it does not. */
export const assertSingleTenant = (input: PipelineInput): void => {
  const tenant = input.submission.tenant_id;
  for (const a of input.answers) {
    if (a.tenant_id !== tenant || a.submission_id !== input.submission.id) {
      throw new TenantIsolationError(`answer ${a.id} is not from this tenant's submission`);
    }
    const item = input.questionItems.get(a.question_item_id);
    if (!item || item.tenant_id !== tenant) {
      throw new TenantIsolationError(`question item for answer ${a.id} is not from this tenant`);
    }
  }
};

const issuePaths = (err: unknown): string => {
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray(err.issues)) {
    return (err.issues as Array<{ path: Array<string | number>; code: string }>)
      .slice(0, 10)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.code}`)
      .join('; ');
  }
  return 'not valid JSON';
};

export const runLlmPipeline = async (
  input: PipelineInput,
  deps: LlmPipelineDeps,
): Promise<LlmPipelineResult> => {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? noopLogger;
  const started = now();
  const { provider, config } = deps;
  const tenantId = input.submission.tenant_id;
  const ctx = { tenantId, submissionId: input.submission.id, route: provider.route.id };

  assertSingleTenant(input);
  assertApproved(config, provider.route);

  const answered: Array<{ answer: AnswerRow; item: QuestionItemRow }> = input.answers.flatMap(
    (a) => {
      const item = input.questionItems.get(a.question_item_id);
      return item ? [{ answer: a, item }] : [];
    },
  );

  const redactor = new Redactor(tenantId, deps.tenantNames ?? []);
  const promptAnswers: PromptAnswer[] = answered.map(({ answer, item }) => ({
    id: answer.id,
    axis: item.axis,
    question: item.prompt,
    answer: redactor.redact(answerText(item, answer.value_json)),
  }));
  const sources = new Map(promptAnswers.map((p) => [p.id, p.answer]));
  const baseSensitivity = classifySensitivity(answered.map((x) => x.item));
  const sensitivity = redactor.replacedCount > 0 ? 'sensitive' : baseSensitivity;

  const prompt = buildPrompt(input.submission.locale, promptAnswers);
  const maxOutputTokens = config.caps.maxOutputTokensPerAnalysis;
  const rate = findRate(config, provider.route, started);
  checkBudget({
    config,
    rate,
    estimatedInputTokens: estimateTokens(prompt.system + prompt.user),
    maxOutputTokens,
    calls: 2,
    tenantMonthSpend: deps.tenantMonthSpend ?? 0,
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let modelVersion = provider.route.model;
  let output: ModelOutput | null = null;
  let lastError = '';
  let attempts = 0;
  for (attempts = 1; attempts <= 2 && output === null; attempts += 1) {
    const user =
      attempts === 1
        ? prompt.user
        : `${prompt.user}\n\nYour previous answer was rejected (${lastError}). Answer again with only the JSON object.`;
    log({ event: 'ai.call', ...ctx, attempt: attempts });
    const res = await provider.complete({ system: prompt.system, user, maxOutputTokens });
    inputTokens += res.inputTokens;
    outputTokens += res.outputTokens;
    modelVersion = res.modelVersion;
    try {
      output = modelOutputSchema.parse(parseModelJson(res.text));
    } catch (err) {
      lastError = issuePaths(err);
      log({ event: 'ai.invalid-output', ...ctx, attempt: attempts, reason: lastError });
    }
  }
  attempts -= 1;
  if (!output) {
    log({ event: 'ai.failed-closed', ...ctx, reason: 'invalid output twice' });
    throw new OutputValidationError(`model output failed validation twice (${lastError})`);
  }

  const verified = verifyOutput(output, sources);
  const restore = (s: string): string => redactor.restore(s, tenantId);

  const factById = new Map(verified.facts.map((f) => [f.id, f]));
  const claimsFor = (ids: ReadonlyArray<string>): AnalysisClaim[] =>
    ids.flatMap((id) => {
      const f = factById.get(id);
      return f
        ? [
            {
              claim: restore(f.statement),
              sourceKind: 'answer' as const,
              sourceId: f.sourceId,
              quote: restore(f.quote),
            },
          ]
        : [];
    });
  const themeOfFact = (factId: string): string =>
    verified.themes.find((t) => t.factIds.includes(factId))?.id ?? factId;

  const facts = verified.facts.map((f) => ({
    id: f.id,
    statement: restore(f.statement),
    sourceKind: 'answer' as const,
    sourceId: f.sourceId,
    quote: restore(f.quote),
    number: f.number,
  }));
  const themes = verified.themes.map((t) => ({
    id: t.id,
    label: restore(t.label),
    axis: t.axis,
    summary: restore(t.summary),
    evidence: claimsFor(t.factIds),
  }));
  const evidence: AnalysisClaim[] = facts.map((f) => ({
    claim: f.statement,
    sourceKind: f.sourceKind,
    sourceId: f.sourceId,
    quote: f.quote,
  }));

  const payload: AnalysisPayload = {
    version: 2,
    aiDraft: true,
    sensitivity,
    themes,
    contradictions: verified.contradictions.map((c) => ({
      themeA: themeOfFact(c.factA),
      themeB: themeOfFact(c.factB),
      explanation: restore(c.explanation),
    })),
    interviewPrompts: verified.interviewQuestions.map((q) => ({
      id: q.id,
      prompt: restore(q.question),
      rationale: restore(q.rationale),
      themeId: q.themeId,
    })),
    evidence,
    facts,
    opportunities: verified.opportunities.map((o) => ({
      id: o.id,
      title: restore(o.title),
      description: restore(o.description),
      themeId: o.themeId,
      evidence: claimsFor(o.factIds),
    })),
    unsupported: verified.unsupported,
  };

  const finished = now();
  log({
    event: 'ai.done',
    ...ctx,
    attempt: attempts,
    inputTokens,
    outputTokens,
    kept: verified.proposed - verified.unsupported.length,
    dropped: verified.unsupported.length,
  });
  return {
    payload,
    proposed: verified.proposed,
    meta: {
      routeId: provider.route.id,
      provider: provider.route.provider,
      model: provider.route.model,
      modelVersion,
      region: provider.route.region,
      promptVersion: PROMPT_VERSION,
      inputRecordIds: [
        ...answered.map((x) => x.answer.id),
        ...Array.from(new Set(answered.map((x) => x.item.id))),
      ],
      inputTokens,
      outputTokens,
      cost: costOf(rate, inputTokens, outputTokens),
      currency: rate.currency,
      rateEffectiveFrom: rate.effectiveFrom,
      generatedAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
      attempts,
    },
  };
};
