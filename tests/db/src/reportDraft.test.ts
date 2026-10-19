import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  MockProvider,
  parseAiConfig,
  ReportDraftError,
  runReportDraftJob,
  type AiConfig,
} from '@evolai/ai';
import { applyMigrations, connect, withServiceAccount } from './db.js';

/**
 * TASK-V (ADR 0043): the report summary draft job on the mock route. It reads only the tenant's
 * own approved findings and accepted steps, stores the draft and an audit row (no text in it),
 * and refuses a published report, a non-staff actor, and another tenant's engagement.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ENG_A = 'a5555555-4555-4555-8555-555555555555';
const ENG_B = 'b5555555-4555-4555-8555-555555555555';
const TEAM_A = 'a2222222-2222-4222-8222-222222222222';
const QV_A = 'a4444444-4444-4444-8444-444444444444';
const AUDITOR_A = '99999999-9999-4999-8999-999999999999';
const AUDITOR_B = '99999999-9999-4999-8999-aaaaaaaaaaaa';

const config: AiConfig = parseAiConfig({
  approvedRoutes: [{ provider: 'mock', model: 'fixture-v1', region: 'local', baseUrl: null }],
  caps: {
    currency: 'EUR',
    maxInputTokensPerAnalysis: 24000,
    maxOutputTokensPerAnalysis: 4000,
    maxCostPerAnalysis: 0.5,
    maxCostPerTenantMonth: 50,
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
let client: pg.Client;
let reportA = '';

beforeAll(async () => {
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS report_draft_test');
  await admin.query('CREATE DATABASE report_draft_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/report_draft_test';
  client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await applyMigrations(client);
  await client.query('SET ROLE auditai_app');
  await withServiceAccount(client, async () => {
    let first = '';
    for (let i = 0; i < 6; i += 1) {
      const inv = await client.query<{ id: string }>(
        `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status,
                                  token_reference, token_signature, opens_at, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'submitted', $5, 'sig', now(), now() + interval '1 day')
         RETURNING id`,
        [TENANT_A, ENG_A, TEAM_A, `draft-${i}`, `draft-ref-${i}`],
      );
      const sub = await client.query<{ id: string }>(
        `INSERT INTO submissions (id, tenant_id, engagement_id, questionnaire_version_id, invitation_id,
                                  status, locale, started_at, submitted_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'submitted', 'en', now(), now()) RETURNING id`,
        [TENANT_A, ENG_A, QV_A, inv.rows[0]?.id],
      );
      const a = await client.query<{ id: string }>(
        `INSERT INTO analyses (tenant_id, engagement_id, submission_id, sensitivity, payload_json,
                               model_route, approved_at, approved_by)
         VALUES ($1, $2, $3, 'internal', $4, 'rule-based/v1', now(), $5) RETURNING id`,
        [
          TENANT_A,
          ENG_A,
          sub.rows[0]?.id,
          JSON.stringify({
            themes: [{ id: 't', label: 'Weekly report by hand', axis: 'practice' }],
          }),
          AUDITOR_A,
        ],
      );
      if (i === 0) first = a.rows[0]?.id as string;
    }
    const opp = await client.query<{ id: string }>(
      `INSERT INTO opportunities (tenant_id, engagement_id, analysis_id, status, title, created_by)
       VALUES ($1, $2, $3, 'approved', 'Automate the weekly report', $4) RETURNING id`,
      [TENANT_A, ENG_A, first, AUDITOR_A],
    );
    for (const [tenant, eng, actor] of [
      [TENANT_A, ENG_A, AUDITOR_A],
      [TENANT_B, ENG_B, AUDITOR_B],
    ] as const) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO audit_reports (tenant_id, engagement_id, locale, title, catalogue_version, created_by)
         VALUES ($1, $2, 'en', 'Demo report', 'v', $3) RETURNING id`,
        [tenant, eng, actor],
      );
      if (tenant === TENANT_A) reportA = r.rows[0]?.id as string;
    }
    await client.query(
      `INSERT INTO report_steps (tenant_id, report_id, opportunity_id, catalogue_id, source, status,
                                 category, title, effort, impact, risk, horizon)
       VALUES ($1, $2, $3, 'automate.scheduled_report', 'rule', 'accepted', 'automate',
               'A report that builds itself', 'medium', 'high', 'low', 'd60')`,
      [TENANT_A, reportA, opp.rows[0]?.id],
    );
  });
});

afterAll(async () => {
  await client.end();
  await admin.query('DROP DATABASE IF EXISTS report_draft_test');
  await admin.end();
});

const run = (tenantId: string, engagementId: string, actorUserId: string) =>
  runReportDraftJob({
    client,
    tenantId,
    engagementId,
    actorUserId,
    config,
    provider: new MockProvider(config),
    log: () => undefined,
  });

describe('report summary draft job', () => {
  it('stores a cited draft and an audit row without the text', async () => {
    const d = await run(TENANT_A, ENG_A, AUDITOR_A);
    expect(d.text).toContain('6 people raise: Weekly report by hand.');
    expect(d.text).toContain('Automate the weekly report');
    const rows = await withServiceAccount(client, async () => ({
      report: (
        await client.query('SELECT ai_draft_json FROM audit_reports WHERE id = $1', [reportA])
      ).rows[0],
      audit: (
        await client.query(
          `SELECT payload_json FROM audit_log WHERE action = 'report.ai_draft' AND target_id = $1`,
          [reportA],
        )
      ).rows,
    }));
    expect(rows.report?.ai_draft_json).toMatchObject({
      route: 'mock/fixture-v1',
      promptVersion: 'report-summary-v1',
      citations: ['practice|weekly report by hand'],
    });
    expect(rows.audit).toHaveLength(1);
    expect(JSON.stringify(rows.audit[0]?.payload_json)).not.toContain('Weekly report');
  });

  it('refuses an actor who is not staff of the tenant (another tenant’s auditor)', async () => {
    await expect(run(TENANT_A, ENG_A, AUDITOR_B)).rejects.toMatchObject({ code: 'not_staff' });
  });

  it('cannot reach another tenant’s engagement', async () => {
    await expect(run(TENANT_A, ENG_B, AUDITOR_A)).rejects.toBeInstanceOf(ReportDraftError);
  });

  it('fails closed when the other tenant has no approved finding', async () => {
    await expect(run(TENANT_B, ENG_B, AUDITOR_B)).rejects.toThrow(/no approved finding/);
  });

  it('refuses a published report', async () => {
    await withServiceAccount(client, () =>
      client.query(`UPDATE audit_reports SET status = 'published' WHERE id = $1`, [reportA]),
    );
    await expect(run(TENANT_A, ENG_A, AUDITOR_A)).rejects.toMatchObject({ code: 'locked' });
  });
});
