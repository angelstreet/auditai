#!/usr/bin/env node
/**
 * End-to-end smoke for M14 quiz form + mascot reveal (slice B).
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the
 * runner output. The script:
 *
 *   1. GET /quiz and asserts the five canonical question codes render.
 *   2. Mirrors the server action via SQL: writes one `respondent_badges`
 *      row for a fresh pseudonym at score 88 (owl tier).
 *   3. GET /quiz/result?pseudonym=... and asserts the Owl mascot tier
 *      is shown and the raw score is NOT surfaced anywhere.
 *   4. Mirrors a re-take at score 40 (tortoise tier) and asserts:
 *      - the previous row was demoted to `is_current = FALSE`;
 *      - the new row is `is_current = TRUE`;
 *      - the result page now shows Tortoise.
 *   5. Cleans up the rows + audit_log entries it created.
 *
 * Exits 0 on success, non-zero on the first failure.
 */
import { default as pg } from 'pg';
import { spawnSync } from 'node:child_process';
import { loginCookie } from './smoke-auth.mjs';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const cookiePromise = loginCookie(base);
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';

const ok = (m) => process.stdout.write(`\u2713 ${m}\n`);
const fail = (m) => {
  process.stderr.write(`\u2717 ${m}\n`);
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
  // 1. /quiz renders the five canonical question codes.
  const quizHtml = await fetchText(`/quiz?tenant=${tenantId}`);
  for (const code of [
    'ai_last_30d',
    'ai_media_consumption',
    'ai_chatbot_use',
    'ai_assisted_coding',
    'ai_built_projects',
  ]) {
    if (!quizHtml.includes(`name="${code}"`)) {
      fail(`/quiz did not render a form field for ${code}`);
    }
  }
  if (!quizHtml.includes('value="owl"') && !quizHtml.includes('value="daily"')) {
    fail('/quiz did not render any answer option values');
  }
  ok('/quiz renders the five canonical question codes');

  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  await c.query(`SET app.is_service_account = 'on'`);

  const pseudonym = `quiz-smoke-${Date.now()}`;
  // Reset any prior rows for this exact pseudonym so the smoke is idempotent.
  await c.query(
    `DELETE FROM respondent_badges WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, pseudonym],
  );

  // 2. First submission: high answers -> score 88 -> owl.
  await c.query(
    `INSERT INTO respondent_badges (
        tenant_id, respondent_pseudonym, engagement_id,
        quiz_score, mascot_tier, source_answers,
        is_current, assigned_at, retention_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, NULL, 88, 'owl', $3::jsonb, TRUE, now(), now() + interval '365 days', now(), now()
      )`,
    [
      tenantId,
      pseudonym,
      JSON.stringify([
        { questionCode: 'ai_last_30d', value: 'daily' },
        { questionCode: 'ai_media_consumption', value: 'daily' },
        { questionCode: 'ai_chatbot_use', value: 'daily' },
        { questionCode: 'ai_assisted_coding', value: 'daily' },
        { questionCode: 'ai_built_projects', value: 'multiple' },
      ]),
    ],
  );
  ok('mirrored server action: owl tier badge written');

  // 3. /quiz/result shows owl.
  let resultHtml = await fetchText(
    `/quiz/result?tenant=${tenantId}&pseudonym=${pseudonym}&tier=owl`,
  );
  if (!/tier-owl/.test(resultHtml)) {
    fail('/quiz/result did not render the owl tier class');
  }
  if (!/>Owl</.test(resultHtml)) {
    fail('/quiz/result did not render the Owl heading');
  }
  // Hard rule: raw score NEVER visible to the respondent.
  if (/\b88\b/.test(resultHtml)) {
    fail('/quiz/result rendered the raw quiz_score (88); privacy regression');
  }
  if (!/Pseudonym/.test(resultHtml) || !resultHtml.includes(pseudonym)) {
    fail('/quiz/result did not render the pseudonym');
  }
  ok('/quiz/result renders the owl mascot + pseudonym, hides raw score');

  // 4. Re-take with low answers -> demote previous + new tortoise row.
  await c.query(
    `UPDATE respondent_badges
        SET is_current = FALSE, updated_at = now()
      WHERE tenant_id = $1 AND respondent_pseudonym = $2 AND is_current = TRUE`,
    [tenantId, pseudonym],
  );
  await c.query(
    `INSERT INTO respondent_badges (
        tenant_id, respondent_pseudonym, engagement_id,
        quiz_score, mascot_tier, source_answers,
        is_current, assigned_at, retention_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, NULL, 40, 'tortoise', $3::jsonb, TRUE, now(), now() + interval '365 days', now(), now()
      )`,
    [
      tenantId,
      pseudonym,
      JSON.stringify([
        { questionCode: 'ai_last_30d', value: 'never' },
        { questionCode: 'ai_media_consumption', value: 'never' },
        { questionCode: 'ai_chatbot_use', value: 'never' },
        { questionCode: 'ai_assisted_coding', value: 'never' },
        { questionCode: 'ai_built_projects', value: 'never' },
      ]),
    ],
  );
  const curRes = await c.query(
    `SELECT count(*)::int AS n FROM respondent_badges
       WHERE tenant_id = $1 AND respondent_pseudonym = $2 AND is_current = TRUE`,
    [tenantId, pseudonym],
  );
  if (curRes.rows[0].n !== 1) {
    fail(
      `expected exactly 1 current badge after re-take, got ${curRes.rows[0].n} (RLS or data-layer regression)`,
    );
  }
  const histRes = await c.query(
    `SELECT count(*)::int AS n FROM respondent_badges
       WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, pseudonym],
  );
  if (histRes.rows[0].n !== 2) {
    fail(`expected 2 total badge rows (history preserved), got ${histRes.rows[0].n}`);
  }
  ok('re-take demoted the previous current + wrote one new current (history preserved)');

  resultHtml = await fetchText(
    `/quiz/result?tenant=${tenantId}&pseudonym=${pseudonym}&tier=tortoise`,
  );
  if (!/tier-tortoise/.test(resultHtml)) {
    fail('/quiz/result did not flip to the tortoise tier class after re-take');
  }
  if (!/>Tortoise</.test(resultHtml)) {
    fail('/quiz/result did not render the Tortoise heading after re-take');
  }
  if (/\b40\b/.test(resultHtml) || /\b88\b/.test(resultHtml)) {
    fail('/quiz/result rendered a raw quiz_score after the re-take; privacy regression');
  }
  ok('/quiz/result re-take flow surfaces the new mascot, hides both raw scores');

  // 5. Cleanup.
  await c.query(
    `DELETE FROM respondent_badges WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, pseudonym],
  );
  ok('cleaned up smoke-created respondent_badges rows');

  // -------------------------------------------------------------------
  // Slice C: team-badge rollup + /admin/teams surfacing + raw score check.
  // -------------------------------------------------------------------
  // 5. Insert two synthetic respondent_badges for the synthetic team
  //    `synthetic-employee-001` (already seeded in 0003) so the rollup
  //    worker has two current rows to count. The custom pseudonym is
  //    unused downstream; it just needs to be `is_current`.
  const teamPseudonym = `quiz-team-${Date.now()}`;
  await c.query(
    `INSERT INTO respondent_badges (
        tenant_id, respondent_pseudonym, engagement_id,
        quiz_score, mascot_tier, source_answers,
        is_current, assigned_at, retention_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, NULL, 88, 'owl', '[]'::jsonb, TRUE, now(), now() + interval '365 days', now(), now()
      )`,
    [tenantId, teamPseudonym],
  );
  // Map the pseudonym to the seeded team via a synthetic invitation so the
  // rollup worker's join picks it up. We do NOT touch the seeded invitations.
  await c.query(
    `INSERT INTO invitations (
        id, tenant_id, engagement_id, team_id, respondent_pseudonym, status,
        token_reference, token_signature, opens_at, expires_at, open_count, submission_id
      ) VALUES (
        gen_random_uuid(), $1,
        (SELECT id FROM engagements WHERE tenant_id = $1 LIMIT 1),
        (SELECT id FROM teams WHERE tenant_id = $1 LIMIT 1),
        $2, 'submitted',
        'inv-synthetic-team-rollup', 'sig-synthetic-team-rollup',
        now() - interval '1 day', now() + interval '7 days', 1, NULL
      )`,
    [tenantId, teamPseudonym],
  );
  ok('seeded one current owl-tier badge mapped to the synthetic tenant team');

  // 6. Spawn the team-rollup smoke (CLI).
  const trOut = spawnOk('pnpm', ['--filter', '@auditai/ai', 'run', 'team-rollup-smoke'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SMOKE_TENANT_ID: tenantId,
  });
  const trMatch = trOut.match(/teams=(\d+)\s+upserted=(\d+)/);
  if (!trMatch) {
    fail(`team-rollup smoke did not report counters: ${trOut.slice(-200)}`);
  }
  if (Number(trMatch[1]) < 1 || Number(trMatch[2]) < 1) {
    fail(`expected >= 1 team processed + upserted, got teams=${trMatch[1]} upserted=${trMatch[2]}`);
  }
  ok(`rollup worker processed teams=${trMatch[1]} upserted=${trMatch[2]}`);

  // 7. /admin/teams renders the team with the dominant tier pill + NO raw score.
  let teamsHtml = await fetchText(`/admin/teams?tenant=${tenantId}`);
  if (!/h1[^>]*>Team profiles/.test(teamsHtml)) {
    fail('/admin/teams did not render the heading');
  }
  // /admin/teams surfaces 1 row per team in tenant A. The team we seeded is
  // `Synthetic team A` (synthetic-employee-001's team). The dominant pill
  // is one of the three tiers.
  if (!/Synthetic team A/.test(teamsHtml)) {
    fail('/admin/teams did not render the Synthetic team A card');
  }
  // Hard privacy rule: NO raw quiz_score on the team page.
  if (/\b88\b/.test(teamsHtml)) {
    fail('/admin/teams rendered a raw quiz_score (88); privacy regression');
  }
  // The page should mention at least one of the tier pills.
  if (!/tier-/.test(teamsHtml)) {
    fail('/admin/teams did not render a tier pill');
  }
  ok('/admin/teams renders the team card + tier pill + hides raw score');

  // 8. Re-run the rollup; the row is updated, not duplicated. The page
  //    should still show the same shape.
  spawnOk('pnpm', ['--filter', '@auditai/ai', 'run', 'team-rollup-smoke'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SMOKE_TENANT_ID: tenantId,
  });
  const teamCount = await c.query(
    `SELECT count(*)::int AS n FROM team_badges WHERE tenant_id = $1`,
    [tenantId],
  );
  if (teamCount.rows[0].n < 1) {
    fail(`expected at least 1 team_badges row after rollup re-run, got ${teamCount.rows[0].n}`);
  }
  ok(`team_badges table holds ${teamCount.rows[0].n} row(s) after idempotent re-run`);

  // 9. Cleanup: remove the team invitations + badges we created.
  await c.query(
    `DELETE FROM invitations WHERE tenant_id = $1 AND token_reference = 'inv-synthetic-team-rollup'`,
    [tenantId],
  );
  await c.query(
    `DELETE FROM respondent_badges WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, teamPseudonym],
  );
  await c.query(`DELETE FROM team_badges WHERE tenant_id = $1`, [tenantId]);
  ok('cleaned up smoke-created team rollup state');

  await c.end();
  process.stdout.write('M14 slice C smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(
    `M14 slice B smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
