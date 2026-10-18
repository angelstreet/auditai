/**
 * Smoke for the M13 cross-team synergy detector (slice B).
 *
 * Reads `SMOKE_TENANT_ID` (defaults to the tenant-A UUID), runs
 * `detectCrossTeamSynergies`, and prints `detected=N reused=M`. The script
 * is idempotent: re-running it after the synergies are written simply
 * bumps the `reused` counter.
 *
 * Pair with `apps/web/scripts/m13-smoke.mjs` for the end-to-end walk
 * (synthetic approved analyses + worker + audit_log assertions).
 */
import pg from 'pg';
import { detectCrossTeamSynergies } from '../src/index.js';

/**
 * The seeded synthetic auditor of the tenant (migrations 0006 and 0015). This smoke runs without a
 * browser, so it cannot sign in itself; `m13-smoke` passes the id of the session it signed in with
 * as `SMOKE_AUDITOR_ID`, so the audit rows carry the same real user id the app would record.
 */
const seededAuditorId = async (url: string, tenantId: string): Promise<string> => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query<{ user_id: string }>(
      `SELECT user_id FROM memberships
        WHERE tenant_id = $1 AND role = 'auditor'
        ORDER BY user_id LIMIT 1`,
      [tenantId],
    );
    if (res.rowCount === 0) throw new Error(`no auditor membership in tenant ${tenantId}`);
    return res.rows[0]!.user_id;
  } finally {
    await client.end();
  }
};

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(2);
  }
  const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';
  const actorUserId = process.env['SMOKE_AUDITOR_ID'] ?? (await seededAuditorId(url, tenantId));
  const result = await detectCrossTeamSynergies(tenantId, {
    databaseUrl: url,
    actorUserId,
  });
  process.stdout.write(
    `Synergy detector: tenant=${tenantId} detected=${result.detected} reused=${result.reused} prompts=${result.proposedFollowupPrompts.length}\n`,
  );
};

main().catch((err) => {
  process.stderr.write(`Synergy smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
