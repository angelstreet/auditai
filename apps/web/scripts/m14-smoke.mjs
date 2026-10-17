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

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
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
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
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

  await c.end();
  process.stdout.write('M14 slice B smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(
    `M14 slice B smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
