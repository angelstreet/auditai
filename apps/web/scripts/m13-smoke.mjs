#!/usr/bin/env node
/**
 * End-to-end smoke for the M13 cross-team synergy detector (slice B).
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the runner output. The script:
 *
 *   1. Resets all `synergies` rows for the synthetic tenant A so the smoke is idempotent.
 *   2. Creates a SECOND engagement (status='closed') inside tenant A so we have two
 *      engagements to compare; the existing M6 admin-engagements test still passes because
 *      this engagement is cleaned up at the end of the script.
 *   3. Inserts two submissions + answers + analyses, one per engagement, with overlapping
 *      themes (axis='literacy', label='Source-checking practice') so the worker has a
 *      cross-engagement group to detect.
 *   4. Approves both analyses (`UPDATE analyses SET approved_at = now()`).
 *   5. Spawns the AI worker smoke (`pnpm --filter @auditai/ai run synergy-smoke`) and
 *      parses its output.
 *   6. Asserts a `synergies` row exists with both engagement ids in `source_engagement_ids`.
 *   7. Asserts a matching `audit_log` row exists with action='synergy.detect'.
 *   8. Re-runs the worker and asserts the row is reused (no duplicate synergies).
 *   9. Cleans up the second engagement (cascades through analyses -> answers) and the
 *      test-created audit_log + synergies so subsequent runs are idempotent.
 *
 * Exits 0 on success, non-zero on the first failure.
 */
import { default as pg } from 'pg';
import { spawnSync } from 'node:child_process';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';
const auditorId = process.env['SMOKE_AUDITOR_ID'] ?? '99999999-9999-4999-8999-999999999999';
const existingEngagementId = 'a5555555-4555-4555-8555-555555555555';
const secondEngagementId = 'a5555666-4555-4555-8555-666666666666';
const templateId = 'a3333333-3333-4333-8333-333333333333';
const questionnaireVersionId = 'a4444444-4444-4444-8444-444444444444';
const analysisIdA1 = 'c3333333-4333-4333-8333-aaaaaaaaaa01';
const analysisIdA2 = 'c3333333-4333-4333-8333-aaaaaaaaaa02';
const submissionIdA1 = 'a8888888-4555-4555-8555-bbbbbbbbbb01';
const submissionIdA2 = 'a8888888-4555-4555-8555-bbbbbbbbbb02';
const invitationIdA2 = 'a6666666-6666-4666-8666-777777777777';
const pseudonymA2 = 'synthetic-employee-m13';
const SHARED_LABEL = 'Source-checking practice';

const ok = (m) => process.stdout.write(`\u2713 ${m}\n`);
const fail = (m) => {
  process.stderr.write(`\u2717 ${m}\n`);
  process.exit(1);
};

const fetchText = async (p) => {
  const res = await fetch(`${base}${p}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${p} returned HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.text();
};

const themePayload = (axis) => ({
  version: 1,
  sensitivity: 'internal',
  themes: [
    {
      id: `theme-${axis}-0`,
      label: SHARED_LABEL,
      axis,
      summary: 'high-maturity signal(s)',
      evidence: [],
    },
  ],
  contradictions: [],
  interviewPrompts: [],
  evidence: [],
});

const spawnOk = (cmd, args, env) => {
  const r = spawnSync(cmd, args, { env, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stdout);
    process.stderr.write(r.stderr);
    fail(`command ${cmd} ${args.join(' ')} exited with ${r.status}`);
  }
  process.stdout.write(r.stdout);
  return r.stdout;
};

const main = async () => {
  // Sanity: app responds.
  await fetchText('/admin/engagements');
  ok('web responded on /admin/engagements');

  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  await c.query(`SET app.is_service_account = 'on'`);
  // Idempotency: clear previous M13 state in tenant A.
  await c.query(`DELETE FROM audit_log WHERE tenant_id = $1 AND action = 'synergy.detect'`, [
    tenantId,
  ]);
  await c.query(`DELETE FROM synergies WHERE tenant_id = $1`, [tenantId]);
  ok('reset synergies + audit_log for tenant A');

  // Make sure the second engagement + its analyses + its submissions are torn down
  // before re-creating, so the seed stays reproducible across smoke runs.
  await c.query(`DELETE FROM engagements WHERE id = $1`, [secondEngagementId]);
  ok('reset previous second engagement');

  // Recreate the second engagement inside tenant A.
  await c.query(
    `INSERT INTO engagements (
        id, tenant_id, template_id, questionnaire_version_id, status,
        opens_at, closes_at, locale, privacy_json
      ) VALUES (
        $1, $2, $3, $4, 'closed', now() - interval '30 days', now(),
        'fr', '{"minResponsesForGroupBreakdown":5,"managerSeesIndividualMaturity":false,"benchmarkCandidate":false,"noticeLocale":"fr"}'::jsonb
      )`,
    [secondEngagementId, tenantId, templateId, questionnaireVersionId],
  );
  await c.query(
    `INSERT INTO engagement_teams (engagement_id, team_id, tenant_id) VALUES ($1, $2, $3)`,
    [secondEngagementId, 'a2222222-2222-4222-8222-222222222222', tenantId],
  );
  // A submission + invitation so the analysis row can carry the FK.
  await c.query(
    `INSERT INTO invitations (
        id, tenant_id, engagement_id, team_id, respondent_pseudonym, status,
        token_reference, token_signature, opens_at, expires_at, open_count, submission_id
      ) VALUES (
        $1, $2, $3, $4, $5, 'submitted', 'inv-synthetic-m13', 'sig-synthetic-m13',
        now() - interval '2 days', now() - interval '1 day', 1, $6
      )`,
    [
      invitationIdA2,
      tenantId,
      secondEngagementId,
      'a2222222-2222-4222-8222-222222222222',
      pseudonymA2,
      submissionIdA2,
    ],
  );
  await c.query(
    `INSERT INTO submissions (
        id, tenant_id, engagement_id, questionnaire_version_id, invitation_id,
        status, locale, started_at, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, 'submitted', 'fr', now() - interval '2 days', now() - interval '2 days' + interval '4 minutes')`,
    [submissionIdA2, tenantId, secondEngagementId, questionnaireVersionId, invitationIdA2],
  );
  ok('created second engagement + submission in tenant A');

  // Insert / refresh the existing first analysis for engagement a5555... with our shared theme.
  await c.query(
    `INSERT INTO analyses (
        id, tenant_id, engagement_id, submission_id, version, sensitivity, theme_count, prompt_count,
        payload_json, evidence_json, model_route, approved_at, approved_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 1, 'internal', 1, 0, $5::jsonb, '[]'::jsonb, 'rule-based/v1', now(), $6, now(), now())
      ON CONFLICT (submission_id, version) DO UPDATE
        SET payload_json = EXCLUDED.payload_json,
            approved_at = EXCLUDED.approved_at,
            approved_by = EXCLUDED.approved_by,
            tenant_id = EXCLUDED.tenant_id,
            engagement_id = EXCLUDED.engagement_id,
            updated_at = now()`,
    [
      analysisIdA1,
      tenantId,
      existingEngagementId,
      submissionIdA1,
      JSON.stringify(themePayload('literacy')),
      auditorId,
    ],
  );
  await c.query(
    `INSERT INTO analyses (
        id, tenant_id, engagement_id, submission_id, version, sensitivity, theme_count, prompt_count,
        payload_json, evidence_json, model_route, approved_at, approved_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 1, 'internal', 1, 0, $5::jsonb, '[]'::jsonb, 'rule-based/v1', now(), $6, now(), now())
      ON CONFLICT (submission_id, version) DO UPDATE
        SET payload_json = EXCLUDED.payload_json,
            approved_at = EXCLUDED.approved_at,
            approved_by = EXCLUDED.approved_by,
            tenant_id = EXCLUDED.tenant_id,
            engagement_id = EXCLUDED.engagement_id,
            updated_at = now()`,
    [
      analysisIdA2,
      tenantId,
      secondEngagementId,
      submissionIdA2,
      JSON.stringify(themePayload('literacy')),
      auditorId,
    ],
  );
  ok('upserted two approved analyses sharing one literacy theme');

  // Run the worker via the AI package's synergy smoke CLI.
  const out1 = spawnOk('pnpm', ['--filter', '@auditai/ai', 'run', 'synergy-smoke'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SMOKE_TENANT_ID: tenantId,
    SMOKE_AUDITOR_ID: auditorId,
  });
  const firstMatch = out1.match(/detected=(\d+)\s+reused=(\d+)/);
  if (!firstMatch) {
    fail(`synergy smoke did not report counters: ${out1.slice(-200)}`);
  }
  const firstDetected = Number(firstMatch[1]);
  if (firstDetected < 1) {
    fail(`expected at least 1 detected synergy, got detected=${firstDetected}`);
  }
  ok(`worker detected=${firstDetected} reused=${firstMatch[2]} on first run`);

  // Read the synergy row + the audit log row.
  const sRes = await c.query(
    `SELECT id, source_analysis_ids, source_engagement_ids, occurrence_count, status
       FROM synergies
      WHERE tenant_id = $1`,
    [tenantId],
  );
  if (sRes.rows.length === 0) {
    fail('no synergies row found in tenant A after worker run');
  }
  const synergy = sRes.rows[0];
  const engIds = (synergy.source_engagement_ids ?? []).map((x) => String(x));
  if (!engIds.includes(existingEngagementId) || !engIds.includes(secondEngagementId)) {
    fail(
      `synergy ${synergy.id} did not link both engagements (got ${engIds.join(',')}); expected ${existingEngagementId} + ${secondEngagementId}`,
    );
  }
  if (synergy.occurrence_count < 2) {
    fail(`synergy occurrence_count=${synergy.occurrence_count}, expected >= 2`);
  }
  if (synergy.status !== 'detected') {
    fail(`synergy status=${synergy.status}, expected 'detected'`);
  }
  ok('synergies row carries both engagements + count >= 2');

  const aRes = await c.query(
    `SELECT id FROM audit_log
       WHERE tenant_id = $1 AND action = 'synergy.detect'
         AND target_kind = 'synergy' AND target_id = $2`,
    [tenantId, synergy.id],
  );
  if (aRes.rows.length === 0) {
    fail('no audit_log row for synergy.detect was written');
  }
  ok(`audit_log wrote ${aRes.rows.length} synergy.detect row(s)`);

  // Idempotency: re-running the worker should reuse the same row.
  const out2 = spawnOk('pnpm', ['--filter', '@auditai/ai', 'run', 'synergy-smoke'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SMOKE_TENANT_ID: tenantId,
    SMOKE_AUDITOR_ID: auditorId,
  });
  const secondMatch = out2.match(/detected=(\d+)\s+reused=(\d+)/);
  if (!secondMatch) fail(`synergy smoke did not report counters on re-run: ${out2.slice(-200)}`);
  const reused = Number(secondMatch[2]);
  if (reused < 1) {
    fail(`expected reused >= 1 on second run, got reused=${reused}`);
  }
  ok(`worker detected=${secondMatch[1]} reused=${reused} on second run (idempotent)`);

  // Confirm there is still exactly ONE synergy row in tenant A.
  const countRes = await c.query(`SELECT count(*)::int AS n FROM synergies WHERE tenant_id = $1`, [
    tenantId,
  ]);
  if (countRes.rows[0].n !== 1) {
    fail(`expected exactly 1 synergy row in tenant A, got ${countRes.rows[0].n}`);
  }
  ok('exactly one synergy row remains after re-run (idempotency holds)');

  // Cleanup: remove the test audit_log rows + synergies + the 2nd engagement (cascades).
  await c.query(`DELETE FROM audit_log WHERE tenant_id = $1 AND action = 'synergy.detect'`, [
    tenantId,
  ]);
  await c.query(`DELETE FROM synergies WHERE tenant_id = $1`, [tenantId]);
  // The 2nd engagement is the FK root for invitations, submissions, analyses.
  await c.query(`DELETE FROM engagements WHERE id = $1`, [secondEngagementId]);
  ok('cleaned up M13 synthetic state (synergies / audit_log / 2nd engagement)');

  await c.end();
  process.stdout.write('M13 slice B smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(`M13 smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
