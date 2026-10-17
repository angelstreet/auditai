#!/usr/bin/env node
/**
 * End-to-end smoke for the M10 auditor review surface.
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the one the runner printed.
 * Walks:
 *   1. Run the AI worker (idempotent) to ensure every submitted survey has an analysis row.
 *   2. HTTP GET the analyses list page and assert the heading + engagement id render.
 *   3. HTTP GET the detail page and assert the pseudonym + Themes + Evidence sections render.
 *   4. Approve the analysis directly via SQL (mirrors the server action: UPDATE analyses +
 *      INSERT INTO audit_log in the same transaction).
 *   5. Assert the audit_log row was written with action = 'analysis.approve'.
 *   6. Re-fetch the detail page and assert the "Approved" line is now visible.
 *
 * Exits 0 on success, non-zero on the first failure.
 *
 * Pure Node (no TS imports) so the script runs the same way as the M7 local-smoke.mjs.
 */

import { default as pg } from 'pg';
import { loginCookie } from './smoke-auth.mjs';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const cookiePromise = loginCookie(base);
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';
const engagementId = process.env['SMOKE_ENGAGEMENT_ID'] ?? 'a5555555-4555-4555-8555-555555555555';
const auditorId = process.env['SMOKE_AUDITOR_ID'] ?? '99999999-9999-4999-8999-999999999999';

const ok = (msg) => process.stdout.write(`\u2713 ${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`\u2717 ${msg}\n`);
  process.exit(1);
};

const fetchText = async (path) => {
  const res = await fetch(`${base}${path}`, { headers: { cookie: await cookiePromise } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
};

const main = async () => {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();

  // 1. Run the AI worker so the analyses table is populated for tenant A.
  //    We shell out to the AI package's smoke; it is idempotent and prints the result.
  const { spawnSync } = await import('node:child_process');
  const workerRun = spawnSync('pnpm', ['--filter', '@auditai/ai', 'run', 'smoke'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
  if (workerRun.status !== 0) {
    process.stderr.write(workerRun.stdout);
    process.stderr.write(workerRun.stderr);
    fail(`AI worker smoke exited with ${workerRun.status}`);
  }
  process.stdout.write(workerRun.stdout);
  ok('AI worker smoke ran');

  // 2. HTTP GET the list page and check it renders rows.
  const listHtml = await fetchText(
    `/admin/engagements/${engagementId}/analyses?tenant=${tenantId}`,
  );
  // The heading is "Analyses \u2014 Synthetic Co A" in JSX; React serialises the em-dash
  // in the RSC payload as the 6-byte escape `\u2014` (the raw em-dash is the same in the DOM).
  if (!/h1[^>]*>Analyses/.test(listHtml)) {
    fail('list page did not render the "Analyses" heading');
  }
  if (!listHtml.includes(engagementId)) {
    fail(`list page did not reference engagement id ${engagementId}`);
  }
  ok('list page renders the analyses heading + engagement id');

  // 3. Pick an analysis id from the database.
  await c.query(`SET app.is_service_account = 'on'`);
  const r = await c.query(
    `SELECT a.id, i.respondent_pseudonym AS pseudonym
       FROM analyses a
       JOIN submissions s ON s.id = a.submission_id
       JOIN invitations i ON i.id = s.invitation_id
      WHERE a.tenant_id = $1 AND a.engagement_id = $2
      ORDER BY a.created_at ASC
      LIMIT 1`,
    [tenantId, engagementId],
  );
  const analysisId = r.rows[0]?.id;
  const pseudonym = r.rows[0]?.pseudonym;
  if (!analysisId || !pseudonym) {
    fail(`no analysis found for tenant=${tenantId} engagement=${engagementId}`);
  }
  ok(`picked analysis ${analysisId} (pseudonym ${pseudonym})`);

  const detailHtml = await fetchText(
    `/admin/engagements/${engagementId}/analyses/${analysisId}?tenant=${tenantId}`,
  );
  if (!detailHtml.includes(pseudonym)) {
    fail(`detail page did not render pseudonym ${pseudonym}`);
  }
  if (!/h2[^>]*>Themes/.test(detailHtml)) {
    fail('detail page did not render the "Themes" section');
  }
  if (!/h2[^>]*>Evidence/.test(detailHtml)) {
    fail('detail page did not render the "Evidence" section');
  }
  ok('detail page renders pseudonym, themes, evidence');

  // 4. Approve the analysis via SQL (same transaction shape the server action uses).
  await c.query('BEGIN');
  try {
    const upd = await c.query(
      `UPDATE analyses
          SET approved_at = now(),
              approved_by = $2,
              updated_at  = now()
        WHERE id = $1 AND tenant_id = $3
        RETURNING engagement_id, model_route`,
      [analysisId, auditorId, tenantId],
    );
    if (upd.rowCount === 0) {
      await c.query('ROLLBACK');
      fail('analyses UPDATE did not match any row');
    }
    const { engagement_id: updEng, model_route: route } = upd.rows[0];
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'analysis.approve', 'analysis', $3, $4)
       RETURNING id`,
      [
        tenantId,
        auditorId,
        analysisId,
        JSON.stringify({ engagementId: updEng, modelRoute: route, source: 'm10-smoke' }),
      ],
    );
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
  ok('approve transaction committed');

  // 5. Assert the audit_log row exists.
  const audit = await c.query(
    `SELECT action, target_id, actor_user_id
       FROM audit_log
      WHERE tenant_id = $1
        AND action = 'analysis.approve'
        AND target_id = $2
        AND actor_user_id = $3
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId, analysisId, auditorId],
  );
  if (audit.rowCount === 0) {
    fail('no audit_log row found for the approve action');
  }
  ok(`audit_log row found: action=${audit.rows[0].action} target=${audit.rows[0].target_id}`);

  // 6. Assert the analysis row was updated.
  const upd = await c.query(`SELECT approved_at, approved_by FROM analyses WHERE id = $1`, [
    analysisId,
  ]);
  if (!upd.rows[0]?.approved_at || upd.rows[0]?.approved_by !== auditorId) {
    fail(
      `analysis row was not updated (approved_at=${upd.rows[0]?.approved_at} approved_by=${upd.rows[0]?.approved_by})`,
    );
  }
  ok(`analysis approved_at=${upd.rows[0].approved_at}`);

  // 7. Re-fetch the detail page and assert the "Approved" line is now visible.
  const detailAfter = await fetchText(
    `/admin/engagements/${engagementId}/analyses/${analysisId}?tenant=${tenantId}`,
  );
  if (!/Approved/.test(detailAfter) || !detailAfter.includes(auditorId)) {
    fail('detail page after approve did not render the Approved line with the auditor id');
  }
  ok('detail page after approve renders the Approved line');

  await c.end();
  process.stdout.write('M10 smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(`M10 smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
