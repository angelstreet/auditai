/**
 * Synthetic fixtures for the AI tests and the eval (TASK-H). Every name, address and number
 * here is invented.
 */
import type { PipelineInput, QuestionItemRow } from '../pipeline.js';
import { parseAiConfig, type AiConfig } from './config.js';

export const TENANT_A = '00000000-0000-4000-8000-0000000000aa';
export const TENANT_B = '00000000-0000-4000-8000-0000000000bb';

export const testConfig = (overrides: Partial<AiConfig['caps']> = {}): AiConfig =>
  parseAiConfig({
    approvedRoutes: [
      { provider: 'rule-based', model: 'v1', region: 'local', baseUrl: null },
      { provider: 'mock', model: 'fixture-v1', region: 'local', baseUrl: null },
    ],
    caps: {
      currency: 'EUR',
      maxInputTokensPerAnalysis: 24000,
      maxOutputTokensPerAnalysis: 4000,
      maxCostPerAnalysis: 0.5,
      maxCostPerTenantMonth: 50,
      ...overrides,
    },
    rates: [
      {
        provider: 'mock',
        model: 'fixture-v1',
        effectiveFrom: '2026-01-01T00:00:00Z',
        currency: 'EUR',
        inputPerMillionTokens: 1,
        outputPerMillionTokens: 2,
      },
    ],
  });

export interface FixtureAnswer {
  readonly id: string;
  readonly axis: string;
  readonly question: string;
  readonly text: string;
}

/** A submission whose answers are all free text, as a `PipelineInput`. */
export const textSubmission = (
  answers: ReadonlyArray<FixtureAnswer>,
  opts: { tenantId?: string; locale?: 'fr' | 'en'; submissionId?: string } = {},
): PipelineInput => {
  const tenantId = opts.tenantId ?? TENANT_A;
  const submissionId = opts.submissionId ?? '00000000-0000-4000-8000-000000000001';
  const items = new Map<string, QuestionItemRow>();
  for (const a of answers) {
    items.set(`q-${a.id}`, {
      id: `q-${a.id}`,
      tenant_id: tenantId,
      axis: a.axis,
      code: `q-${a.id}`,
      kind: 'short_text',
      locale: opts.locale ?? 'en',
      prompt: a.question,
      options_json: [],
      scoring_json: { weight: 1, reverse: false },
      sensitivity: 'internal',
    });
  }
  return {
    submission: {
      id: submissionId,
      tenant_id: tenantId,
      engagement_id: '00000000-0000-4000-8000-0000000000e1',
      invitation_id: '00000000-0000-4000-8000-0000000000c1',
      status: 'submitted',
      locale: opts.locale ?? 'en',
      started_at: '2026-10-15T00:00:00Z',
      submitted_at: '2026-10-15T00:05:00Z',
    },
    answers: answers.map((a, i) => ({
      id: a.id,
      tenant_id: tenantId,
      submission_id: submissionId,
      question_item_id: `q-${a.id}`,
      value_json: a.text,
      sequence: i,
    })),
    questionItems: items,
  };
};
