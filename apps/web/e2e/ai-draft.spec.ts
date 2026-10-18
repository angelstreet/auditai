import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * TASK-H / ADR 0029: a model-drafted analysis is shown to the auditor as an "AI draft" with its
 * provider, model and prompt version, in EN and FR, and stays unapproved until a human acts.
 * The row has the shape the worker writes on the mock route (synthetic data only).
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const ENG_A = 'a5555555-4555-4555-8555-555555555555';
const SUB = 'a8888888-4555-4555-8555-aaaaaaaaaa05';
const ANALYSIS = 'c7777777-7777-4777-8777-777777777701';

const databaseUrl = (): string =>
  process.env['DATABASE_URL'] ??
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

const payload = {
  version: 2,
  aiDraft: true,
  sensitivity: 'internal',
  themes: [
    {
      id: 'repetitive-work',
      label: 'Repetitive work',
      axis: 'practice',
      summary: 'Repetitive work: raised by the respondent.',
      evidence: [
        {
          claim: 'Copies order lines by hand',
          sourceKind: 'answer',
          sourceId: 'a9999999-4555-4555-8555-aaaaaaaaaa1f',
          quote: 'by hand',
        },
      ],
    },
  ],
  contradictions: [],
  interviewPrompts: [],
  evidence: [],
  facts: [],
  opportunities: [
    {
      id: 'o1',
      title: 'Simplify: repetitive work',
      description: 'Idea to check in an interview; volumes stay self-reported.',
      themeId: 'repetitive-work',
      evidence: [],
    },
  ],
  unsupported: [{ kind: 'opportunity', id: 'o9', reason: 'number not found in cited quotes' }],
};

test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO analyses (id, tenant_id, engagement_id, submission_id, version, sensitivity,
         theme_count, prompt_count, payload_json, evidence_json, model_route, model_provider,
         model_name, model_version, model_region, prompt_version, unsupported_json,
         input_tokens, output_tokens, cost_amount, cost_currency, generated_at)
       VALUES ($1, $2, $3, $4, 1, 'internal', 1, 0, $5, '[]', 'mock/fixture-v1', 'mock',
         'fixture-v1', 'fixture-v1', 'local', 'synthesis-v1', $6, 120, 80, 0.000280, 'EUR', now())
       ON CONFLICT (submission_id, version) DO UPDATE SET
         payload_json = EXCLUDED.payload_json, model_provider = EXCLUDED.model_provider,
         model_name = EXCLUDED.model_name, prompt_version = EXCLUDED.prompt_version,
         unsupported_json = EXCLUDED.unsupported_json, approved_at = NULL, approved_by = NULL`,
      [
        ANALYSIS,
        TENANT_A,
        ENG_A,
        SUB,
        JSON.stringify(payload),
        JSON.stringify(payload.unsupported),
      ],
    );
  } finally {
    await client.end();
  }
});

const analysisUrl = async (): Promise<string> => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      'SELECT id FROM analyses WHERE submission_id = $1 AND version = 1',
      [SUB],
    );
    return `/admin/engagements/${ENG_A}/analyses/${rows[0]?.id}?tenant=${TENANT_A}`;
  } finally {
    await client.end();
  }
};

for (const [locale, draft, model] of [
  ['en', 'AI draft', /Drafted by mock · model fixture-v1 · region local · prompt synthesis-v1/],
  [
    'fr',
    'Brouillon IA',
    /Rédigé par mock · modèle fixture-v1 · région local · prompt synthesis-v1/,
  ],
] as const) {
  test(`auditor sees an unapproved AI draft with provider and model (${locale})`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);
    await signInAsAuditorA(page);
    await page.goto(await analysisUrl());
    await expect(page.getByTestId('ai-draft')).toHaveText(draft);
    await expect(page.getByTestId('ai-model')).toContainText(model);
    await expect(page.getByText('Simplify: repetitive work')).toBeVisible();
    await expect(
      page.getByRole('button', { name: locale === 'en' ? /approve/i : /valider/i }),
    ).toBeVisible();
  });
}
