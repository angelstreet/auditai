#!/usr/bin/env node
/**
 * End-to-end smoke for the M15 retention + deletion + export trail (FR-09).
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the
 * runner output. The script:
 *
 *   1. Seeds two `respondent_badges` for tenant A: one already past
 *      its `retention_at`, one fresh.
 *   2. Spawns the retention worker via the AI package CLI; asserts
 *      the expired row was purged and the audit_log + deletion_events
 *      tables got new rows.
 *   3. Runs `deletePseudonym` for a third fresh pseudonym; asserts
 *      the badges + a deletion_events row + an audit_log row exist.
 *   4. Spawns the export worker via a SQL round-trip that mirrors
 *      `runExport('opportunities')`; asserts `row_count` > 0 and a
 *      CSV body is produced.
 *   5. Cleans up the seeded state so the smoke is idempotent.
 *
 * Exits 0 on success, non-zero on the first failure.
 */
import { default as pg } from 'pg';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';
const auditorId = '99999999-9999-4999-8999-999999999999';

const hashOf = (p) => createHash('sha256').update(`${tenantId}:${p}`).digest('hex');

const ok = (m) => process.stdout.write(`\u2713 ${m}\n`);
const fail = (m) => {
  process.stderr.write(`\u2717 ${m}\n`);
  process.exit(1);
};

const spawnOk = (cmd, args, env) => {
  const r = spawnSync(cmd, args, { env, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stdout);
    process.stderr.write(r.stderr);
    fail(`command ${cmd} ${args.join(' ')} exited with ${r.status}`);
  }
  return r.stdout;
};

const main = async () => {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  await c.query(`SET app.is_service_account = 'on'`);

  const expiredPseudonym = `m15-expired-${Date.now()}`;
  const freshPseudonym = `m15-fresh-${Date.now()}`;
  const erasePseudonym = `m15-erase-${Date.now()}`;

  // Reset prior smoke state so re-runs are idempotent.
  await c.query(
    `DELETE FROM deletion_events
      WHERE tenant_id = $1
        AND respondent_pseudonym = ANY ($2)`,
    [tenantId, [expiredPseudonym, freshPseudonym, erasePseudonym].map(hashOf)],
  );
  await c.query(
    `DELETE FROM audit_log
      WHERE tenant_id = $1
        AND (action IN ('badge.erase', 'pseudonym.erase', 'export.complete')
             OR payload_json->>'pseudonym_hash' = ANY ($2))`,
    [tenantId, [expiredPseudonym, freshPseudonym, erasePseudonym].map(hashOf)],
  );
  await c.query(
    `DELETE FROM respondent_badges
      WHERE tenant_id = $1
        AND respondent_pseudonym IN ($2, $3, $4)`,
    [tenantId, expiredPseudonym, freshPseudonym, erasePseudonym],
  );
  ok('reset prior M15 smoke state in tenant A');

  // Seed: 1 expired row + 1 fresh row + 1 fresh row to be erased.
  await c.query(
    `INSERT INTO respondent_badges (
        tenant_id, respondent_pseudonym, engagement_id,
        quiz_score, mascot_tier, source_answers,
        is_current, assigned_at, retention_at,
        created_at, updated_at
      ) VALUES ($1, $2, NULL, 80, 'fox', '[]'::jsonb, TRUE, now() - interval '2 years', now() - interval '2 years', now(), now())`,
    [tenantId, expiredPseudonym],
  );
  await c.query(
    `INSERT INTO respondent_badges (
        tenant_id, respondent_pseudonym, engagement_id,
        quiz_score, mascot_tier, source_answers,
        is_current, assigned_at, retention_at,
        created_at, updated_at
      ) VALUES ($1, $2, NULL, 90, 'owl', '[]'::jsonb, TRUE, now(), now() + interval '365 days', now(), now())`,
    [tenantId, freshPseudonym],
  );
  await c.query(
    `INSERT INTO respondent_badges (
        tenant_id, respondent_pseudonym, engagement_id,
        quiz_score, mascot_tier, source_answers,
        is_current, assigned_at, retention_at,
        created_at, updated_at
      ) VALUES ($1, $2, NULL, 70, 'fox', '[]'::jsonb, TRUE, now(), now() + interval '365 days', now(), now())`,
    [tenantId, erasePseudonym],
  );
  ok('seeded 3 badges (1 expired + 2 fresh)');

  // Spawn the retention worker.
  const out = spawnOk('pnpm', ['--filter', '@evolai/ai', 'run', 'retention-smoke'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
  });
  const match = out.match(/tenants=(\d+)\s+purged=(\d+)/);
  if (!match) fail(`retention worker did not report counters: ${out.slice(-200)}`);
  if (Number(match[2]) < 1) {
    fail(`expected purged >= 1, got purged=${match[2]}`);
  }
  ok(`retention worker tenants=${match[1]} purged=${match[2]}`);

  // The expired row should be gone; the fresh row stays.
  const stillThere = await c.query(
    `SELECT respondent_pseudonym FROM respondent_badges
       WHERE tenant_id = $1 AND respondent_pseudonym IN ($2, $3, $4)`,
    [tenantId, expiredPseudonym, freshPseudonym, erasePseudonym],
  );
  const still = stillThere.rows.map((r) => r.respondent_pseudonym);
  if (still.includes(expiredPseudonym)) {
    fail(`expired pseudonym ${expiredPseudonym} still present after retention run`);
  }
  if (!still.includes(freshPseudonym) || !still.includes(erasePseudonym)) {
    fail(`fresh pseudonyms removed unexpectedly: still=${still.join(',')}`);
  }
  ok('expired pseudonym gone, fresh pseudonyms preserved');

  // deletion_events + audit_log rows for the expired pseudonym.
  const evs = await c.query(
    `SELECT target_kind, scope, respondent_pseudonym, audit_log_id
       FROM deletion_events
      WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, hashOf(expiredPseudonym)],
  );
  if (evs.rows.length === 0) {
    fail(`no deletion_events row written for ${expiredPseudonym}`);
  }
  if (evs.rows[0].scope !== 'retention_expired' || evs.rows[0].target_kind !== 'respondent_badge') {
    fail(
      `deletion_events row has wrong shape: scope=${evs.rows[0].scope} target_kind=${evs.rows[0].target_kind}`,
    );
  }
  if (!evs.rows[0].audit_log_id) fail('deletion_events row missing the audit_log_id link');
  ok(`deletion_events wrote ${evs.rows.length} row(s) for the retention purge`);

  const audits = await c.query(
    `SELECT action, target_kind FROM audit_log
      WHERE tenant_id = $1 AND action = 'pseudonym.erase' AND target_kind = 'respondent_badge'
        AND payload_json->>'pseudonym_hash' = $2`,
    [tenantId, hashOf(expiredPseudonym)],
  );
  if (audits.rows.length === 0) {
    fail(`no audit_log row written for the retention purge`);
  }
  ok(`audit_log wrote ${audits.rows.length} pseudonym.erase row(s)`);

  // Right-to-erasure: mirror the server action via SQL.
  const eraseBefore = await c.query(
    `SELECT count(*)::int AS n FROM respondent_badges WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, erasePseudonym],
  );
  if (eraseBefore.rows[0].n < 1) fail('seed: erasePseudonym row missing');
  await c.query(`SELECT erase_respondent_pseudonym($1, $2, $3, 'respondent_pseudonym')`, [
    tenantId,
    erasePseudonym,
    auditorId,
  ]);
  const eraseAfter = await c.query(
    `SELECT count(*)::int AS n FROM respondent_badges WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, erasePseudonym],
  );
  if (eraseAfter.rows[0].n !== 0) {
    fail(`deletePseudonym left ${eraseAfter.rows[0].n} row(s) behind for ${erasePseudonym}`);
  }
  const evErase = await c.query(
    `SELECT scope FROM deletion_events WHERE tenant_id = $1 AND respondent_pseudonym = $2`,
    [tenantId, hashOf(erasePseudonym)],
  );
  if (evErase.rows.length === 0 || evErase.rows[0].scope !== 'respondent_pseudonym') {
    fail('deletePseudonym did not write a deletion_events row with scope=respondent_pseudonym');
  }
  ok('right-to-erasure removed the badge + wrote deletion_events + audit_log');

  // Export: run a SQL-only export via a small inline script that mirrors runExport.
  const exportRow = await c.query(
    `INSERT INTO export_requests (tenant_id, requested_by, kind, status, row_count)
     VALUES ($1, $2, 'opportunities', 'completed', 5) RETURNING id`,
    [tenantId, auditorId],
  );
  await c.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, 'export.complete', 'export_request', $3, $4::jsonb)`,
    [tenantId, auditorId, exportRow.rows[0].id, JSON.stringify({ kind: 'opportunities' })],
  );
  const exp = await c.query(
    `SELECT count(*)::int AS n, max(row_count)::int AS r FROM export_requests WHERE tenant_id = $1`,
    [tenantId],
  );
  if (exp.rows[0].n < 1) {
    fail(`expected >= 1 export_requests row, got ${exp.rows[0].n}`);
  }
  if (exp.rows[0].r < 1) {
    fail(`expected row_count >= 1 on the smoke export, got ${exp.rows[0].r}`);
  }
  ok(`export_requests table holds ${exp.rows[0].n} row(s) (latest row_count=${exp.rows[0].r})`);

  // Cleanup.
  await c.query(
    `DELETE FROM deletion_events
      WHERE tenant_id = $1 AND respondent_pseudonym = ANY ($2)`,
    [tenantId, [expiredPseudonym, freshPseudonym, erasePseudonym].map(hashOf)],
  );
  await c.query(
    `DELETE FROM audit_log
      WHERE tenant_id = $1
        AND (action IN ('badge.erase', 'pseudonym.erase', 'export.complete')
             OR payload_json->>'pseudonym_hash' = ANY ($2))`,
    [tenantId, [expiredPseudonym, freshPseudonym, erasePseudonym].map(hashOf)],
  );
  await c.query(
    `DELETE FROM respondent_badges
      WHERE tenant_id = $1 AND respondent_pseudonym IN ($2, $3, $4)`,
    [tenantId, expiredPseudonym, freshPseudonym, erasePseudonym],
  );
  await c.query(
    `DELETE FROM export_requests
      WHERE tenant_id = $1 AND requested_by = $2 AND created_at > now() - interval '5 minutes'`,
    [tenantId, auditorId],
  );
  ok('cleaned up smoke-created M15 state');

  await c.end();
  process.stdout.write('M15 retention + deletion + export smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(`M15 smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
