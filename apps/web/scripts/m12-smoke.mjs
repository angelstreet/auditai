#!/usr/bin/env node
/**
 * End-to-end smoke for the M12 sponsor onboarding + portfolio board.
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the one the runner printed.
 * Walks:
 *   1. HTTP GET /welcome, /intake, /board and assert the headings render.
 *   2. Insert a sponsor_briefs row via SQL (mirrors the server action).
 *   3. HTTP GET /board and assert the brief card is rendered in the intake column.
 *   4. HTTP GET /intake and assert the live summary shows the brief.
 *   5. Reset the brief and assert the live summary reverts to "no brief submitted yet".
 *
 * Exits 0 on success, non-zero on the first failure. Pure Node (no TS imports).
 */

import { default as pg } from 'pg';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';

const ok = (msg) => process.stdout.write(`\u2713 ${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`\u2717 ${msg}\n`);
  process.exit(1);
};

const fetchText = async (path) => {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
};

const main = async () => {
  // 1. /welcome renders the heading.
  const welcome = await fetchText('/welcome');
  if (!/h1[^>]*>Discover how work/.test(welcome)) {
    fail('/welcome did not render the hero heading');
  }
  ok('/welcome renders the hero heading');

  // 2. /intake renders the form.
  const intake = await fetchText(`/intake?tenant=${tenantId}`);
  if (!/Sponsor intake/.test(intake)) {
    fail('/intake did not render the heading');
  }
  if (!/name="topPriorityWorkflow"/.test(intake)) {
    fail('/intake did not render the form input');
  }
  if (!/Live summary/.test(intake)) {
    fail('/intake did not render the live summary');
  }
  ok('/intake renders the form + live summary');

  // 3. /board renders the kanban.
  const board = await fetchText('/board');
  if (!/Portfolio board/.test(board)) {
    fail('/board did not render the heading');
  }
  if (!/Intake/.test(board)) {
    fail('/board did not render the Intake column');
  }
  if (!/Opportunities/.test(board)) {
    fail('/board did not render the Opportunities column');
  }
  ok('/board renders the kanban with the 5 columns');

  // 4. Insert a sponsor brief via SQL (mirrors the server action).
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  await c.query(`SET app.is_service_account = 'on'`);
  // Reset prior briefs for this tenant so the smoke is idempotent.
  await c.query(`DELETE FROM sponsor_briefs WHERE tenant_id = $1`, [tenantId]);
  const insert = await c.query(
    `INSERT INTO sponsor_briefs (
       tenant_id, sponsor_user_id,
       top_priority_workflow, departments_in_scope, data_sensitivity_boundary,
       annual_budget_eur, onsite_appetite,
       approved_model_regions, data_residency, prompt_injection_review,
       leadership_literacy, operational_adoption, policy_governance
     ) VALUES (
       $1, NULL, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12
     ) RETURNING id`,
    [
      tenantId,
      'M12 smoke: reduce source-checking time on outbound deliverables',
      JSON.stringify(['operations', 'sales']),
      JSON.stringify(['internal_only']),
      45000,
      'limited_team',
      JSON.stringify(['eu_only']),
      JSON.stringify(['eu_frankfurt']),
      'external_auditor',
      2,
      1,
      3,
    ],
  );
  const briefId = insert.rows[0]?.id;
  if (!briefId) fail('sponsor_briefs insert did not return an id');
  ok(`sponsor brief inserted ${briefId}`);

  // 5. /board shows the brief card.
  const boardAfter = await fetchText('/board');
  if (!boardAfter.includes('Synthetic tenant A sponsor brief')) {
    fail('/board did not render the new sponsor brief card after the insert');
  }
  ok('/board renders the new sponsor brief card');

  // 6. /intake live summary shows the brief fields.
  const intakeAfter = await fetchText(`/intake?tenant=${tenantId}`);
  if (!intakeAfter.includes('M12 smoke: reduce source-checking')) {
    fail('/intake live summary did not show the new top priority workflow');
  }
  if (!intakeAfter.includes('€45,000')) {
    fail('/intake live summary did not show the budget');
  }
  ok('/intake live summary shows the new brief');

  // 7. Reset and re-assert the empty state.
  await c.query(`DELETE FROM sponsor_briefs WHERE tenant_id = $1`, [tenantId]);
  const intakeReset = await fetchText(`/intake?tenant=${tenantId}`);
  if (!intakeReset.includes('No brief submitted yet')) {
    fail('/intake did not revert to the empty live summary after reset');
  }
  ok('/intake live summary reverts to the empty state after reset');

  await c.end();
  process.stdout.write('M12 smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(`M12 smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
