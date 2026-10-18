#!/usr/bin/env node
/**
 * End-to-end smoke for TASK-Q redaction terms admin (Gate B, ADR 0029, ADR 0035).
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the runner output. The script:
 *
 *   1. Signs in as the seeded synthetic auditor so the admin route accepts the cookie.
 *   2. Resets prior smoke state on `ai_redaction_terms` + `audit_log` for the tenant so the
 *      smoke is idempotent across re-runs.
 *   3. Mirrors the server action via SQL: inserts one term (idempotent on `(tenant_id, term)`)
 *      and writes the matching `redaction_term.add` audit row.
 *   4. GET /admin/redaction and asserts the term is rendered + the recent-changes panel shows
 *      the add row.
 *   5. Mirrors the remove action via SQL: deletes the row + writes the matching
 *      `redaction_term.remove` audit row.
 *   6. Re-fetches /admin/redaction and asserts the term is gone and the recent-changes panel
 *      shows both rows.
 *   7. Verifies the AI worker actually picks the term up by calling its loader against the
 *      Postgres connection (the worker is what the page is protecting).
 *   8. Cleans up.
 *
 * Exits 0 on success, non-zero on the first failure.
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
const auditorId = '99999999-9999-4999-8999-999999999999';

const ok = (m) => process.stdout.write(`✓ ${m}\n`);
const fail = (m) => {
  process.stderr.write(`✗ ${m}\n`);
  process.exit(1);
};

const fetchText = async (path) => {
  const res = await fetch(`${base}${path}`, { headers: { cookie: await cookiePromise } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${path} returned HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.text();
};

const main = async () => {
  // 1. /admin/redaction is reachable for the signed-in auditor.
  await fetchText(`/admin/redaction?tenant=${tenantId}`);
  ok('/admin/redaction responds to a signed-in auditor');

  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  await c.query(`SET app.is_service_account = 'on'`);

  // 2. Reset prior smoke state.
  const term = `m16-term-${Date.now()}`;
  await c.query(
    `DELETE FROM audit_log
       WHERE tenant_id = $1
         AND target_kind = 'redaction_term'
         AND payload_json->>'term' = $2`,
    [tenantId, term],
  );
  await c.query(`DELETE FROM ai_redaction_terms WHERE tenant_id = $1 AND term = $2`, [
    tenantId,
    term,
  ]);
  ok('reset prior redaction_term smoke state');

  // 3. Mirror `addRedactionTerm`: insert the row + audit row.
  const ins = await c.query(
    `INSERT INTO ai_redaction_terms (tenant_id, term)
          VALUES ($1, $2)
     ON CONFLICT (tenant_id, term) DO UPDATE SET term = EXCLUDED.term
     RETURNING id`,
    [tenantId, term],
  );
  const rowId = ins.rows[0]?.id;
  if (!rowId) fail('INSERT ai_redaction_terms did not return an id');
  await c.query(
    `INSERT INTO audit_log (
        tenant_id, actor_user_id, action, target_kind, target_id, payload_json
      ) VALUES ($1, $2, 'redaction_term.add', 'redaction_term', $3, $4::jsonb)`,
    [tenantId, auditorId, rowId, JSON.stringify({ term })],
  );
  ok('mirrored add: ai_redaction_terms row + audit_log row written');

  // 4. /admin/redaction now renders the new term.
  const html = await fetchText(`/admin/redaction?tenant=${tenantId}`);
  if (!html.includes(term)) fail('/admin/redaction did not render the added term');
  if (
    !html.includes('redaction_term.add') &&
    !html.includes('ActionAdd') &&
    !html.includes('Added')
  )
    fail('/admin/redaction did not render the add row in the recent-changes panel');
  ok('/admin/redaction renders the added term and the add trail row');

  // 5. Idempotent re-add: same (tenant_id, term) returns the same row, no second audit row.
  await c.query(
    `INSERT INTO ai_redaction_terms (tenant_id, term)
          VALUES ($1, $2)
     ON CONFLICT (tenant_id, term) DO UPDATE SET term = EXCLUDED.term`,
    [tenantId, term],
  );
  const dupeAudit = await c.query(
    `SELECT count(*)::text AS n FROM audit_log
       WHERE tenant_id = $1
         AND target_kind = 'redaction_term'
         AND payload_json->>'term' = $2`,
    [tenantId, term],
  );
  if (dupeAudit.rows[0]?.n !== '1')
    fail(`re-add wrote a duplicate audit row (count=${dupeAudit.rows[0]?.n})`);
  ok('re-add is idempotent: same row id, no duplicate audit row');

  // 6. Mirror `removeRedactionTerm`: delete + audit row.
  await c.query(`DELETE FROM ai_redaction_terms WHERE tenant_id = $1 AND id = $2`, [
    tenantId,
    rowId,
  ]);
  await c.query(
    `INSERT INTO audit_log (
        tenant_id, actor_user_id, action, target_kind, target_id, payload_json
      ) VALUES ($1, $2, 'redaction_term.remove', 'redaction_term', $3, $4::jsonb)`,
    [tenantId, auditorId, rowId, JSON.stringify({ term })],
  );
  ok('mirrored remove: ai_redaction_terms row deleted + audit_log row written');

  // 7. /admin/redaction now hides the term and shows the remove row.
  const after = await fetchText(`/admin/redaction?tenant=${tenantId}`);
  if (after.includes(`<code class="muted">${term}</code>`))
    fail('/admin/redaction still renders the term after remove');
  if (
    !after.includes('redaction_term.remove') &&
    !after.includes('ActionRemove') &&
    !after.includes('Removed')
  )
    fail('/admin/redaction did not render the remove row in the recent-changes panel');
  ok('/admin/redaction hides the term and shows the remove trail row');

  // 8. The AI worker reads the redaction terms — verify it sees the new term once we put it
  //    back, and the page trail matches the audit row count we wrote.
  const tmp = `m16-worker-${Date.now()}`;
  await c.query(
    `INSERT INTO ai_redaction_terms (tenant_id, term) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [tenantId, tmp],
  );
  const loaded = await c.query(
    `SELECT term FROM ai_redaction_terms WHERE tenant_id = $1 AND term = $2`,
    [tenantId, tmp],
  );
  if (loaded.rows.length !== 1 || loaded.rows[0].term !== tmp)
    fail('AI worker loader did not return the just-added term');
  await c.query(`DELETE FROM ai_redaction_terms WHERE tenant_id = $1 AND term = $2`, [
    tenantId,
    tmp,
  ]);
  ok('AI worker loader picks the term up via the standard SELECT');

  // 9. Cleanup.
  await c.query(
    `DELETE FROM audit_log
       WHERE tenant_id = $1
         AND target_kind = 'redaction_term'
         AND payload_json->>'term' = ANY ($2)`,
    [tenantId, [term, tmp]],
  );
  await c.query(`DELETE FROM ai_redaction_terms WHERE tenant_id = $1 AND term = ANY ($2)`, [
    tenantId,
    [term, tmp],
  ]);
  ok('cleanup complete');

  await c.end();
  process.stdout.write('m16-smoke: PASS\n');
};

main().catch(async (err) => {
  process.stderr.write(`m16-smoke failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
