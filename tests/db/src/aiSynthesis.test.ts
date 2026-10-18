import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  CostCeilingError,
  MockProvider,
  parseAiConfig,
  processSubmission,
  RouteNotApprovedError,
  type AiConfig,
} from '@evolai/ai';
import { applyMigrations, connect, withTenant } from './db.js';

/**
 * Model-backed synthesis against a real database (TASK-H, ADR 0029), on the mock provider.
 * Runs in its own database so it cannot race the isolation suite.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const SUB_A1 = 'a8888888-4555-4555-8555-aaaaaaaaaa01';
const SUB_A2 = 'a8888888-4555-4555-8555-aaaaaaaaaa02';

const config = (maxCostPerTenantMonth = 50): AiConfig =>
  parseAiConfig({
    approvedRoutes: [{ provider: 'mock', model: 'fixture-v1', region: 'local', baseUrl: null }],
    caps: {
      currency: 'EUR',
      maxInputTokensPerAnalysis: 24000,
      maxOutputTokensPerAnalysis: 4000,
      maxCostPerAnalysis: 0.5,
      maxCostPerTenantMonth,
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

let admin: pg.Client;
let db: pg.Client;

beforeAll(async () => {
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS ai_synthesis_test');
  await admin.query('CREATE DATABASE ai_synthesis_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/ai_synthesis_test';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await applyMigrations(db);
  await db.query('SET ROLE auditai_app');
});

afterAll(async () => {
  await db.end();
  await admin.query('DROP DATABASE IF EXISTS ai_synthesis_test');
  await admin.end();
});

describe('AI synthesis storage (TASK-H)', () => {
  it('keeps redaction terms per tenant under RLS', async () => {
    await db.query('BEGIN');
    await db.query(`SET LOCAL app.is_service_account = 'on'`);
    await db.query(
      `INSERT INTO ai_redaction_terms (tenant_id, term) VALUES ($1, 'Zorblat'), ($2, 'Quenneville')`,
      [TENANT_A, TENANT_B],
    );
    await db.query('COMMIT');
    const seen = await withTenant(db, TENANT_A, async () => {
      const r = await db.query<{ term: string }>('SELECT term FROM ai_redaction_terms');
      return r.rows.map((x) => x.term);
    });
    expect(seen).toEqual(['Zorblat']);
  });

  it('writes a draft with provider, model, prompt version, inputs, tokens and cost', async () => {
    const provider = new MockProvider(config());
    const payload = await processSubmission(SUB_A1, {
      client: db,
      databaseUrl: 'unused',
      provider,
      config: config(),
      log: () => undefined,
    });
    expect(payload?.aiDraft).toBe(true);
    const sent = provider.requests.map((r) => r.user).join('\n');
    expect(sent).not.toContain('Quenneville');

    const row = (
      await db.query<{
        model_route: string;
        model_provider: string;
        model_name: string;
        model_region: string;
        prompt_version: string;
        input_record_ids: string[];
        input_tokens: number;
        cost_amount: string;
        cost_currency: string;
        approved_at: string | null;
        generated_at: string | null;
      }>(`SELECT * FROM analyses WHERE submission_id = $1`, [SUB_A1])
    ).rows[0];
    expect(row).toMatchObject({
      model_route: 'mock/fixture-v1',
      model_provider: 'mock',
      model_name: 'fixture-v1',
      model_region: 'local',
      prompt_version: 'synthesis-v1',
      cost_currency: 'EUR',
      approved_at: null,
    });
    expect(row?.input_tokens).toBeGreaterThan(0);
    expect(Number(row?.cost_amount)).toBeGreaterThan(0);
    expect(row?.generated_at).not.toBeNull();

    const own = await db.query<{ id: string }>(
      `SELECT id FROM answers WHERE tenant_id = $1 UNION SELECT id FROM question_items WHERE tenant_id = $1`,
      [TENANT_A],
    );
    const ownIds = new Set(own.rows.map((r) => r.id));
    expect(row?.input_record_ids.length).toBeGreaterThan(0);
    for (const id of row?.input_record_ids ?? []) expect(ownIds.has(id)).toBe(true);
  });

  it('fails closed on a route that is not approved, and writes nothing', async () => {
    await expect(
      processSubmission(SUB_A2, {
        client: db,
        databaseUrl: 'unused',
        config: config(),
        env: { EVOLAI_AI_PROVIDER: 'rule-based' },
      }),
    ).rejects.toBeInstanceOf(RouteNotApprovedError);
    const r = await db.query('SELECT 1 FROM analyses WHERE submission_id = $1', [SUB_A2]);
    expect(r.rowCount).toBe(0);
  });

  it('refuses when the tenant monthly cap is already used', async () => {
    await expect(
      processSubmission(SUB_A2, {
        client: db,
        databaseUrl: 'unused',
        provider: new MockProvider(config(0.000001)),
        config: config(0.000001),
        log: () => undefined,
      }),
    ).rejects.toBeInstanceOf(CostCeilingError);
  });
});
