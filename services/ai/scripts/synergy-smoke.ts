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
import { detectCrossTeamSynergies } from '../src/index.js';

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(2);
  }
  const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';
  const actorUserId = process.env['SMOKE_AUDITOR_ID'] ?? null;
  const result = await detectCrossTeamSynergies(tenantId, {
    databaseUrl: url,
    actorUserId: actorUserId ?? undefined,
  });
  process.stdout.write(
    `Synergy detector: tenant=${tenantId} detected=${result.detected} reused=${result.reused} prompts=${result.proposedFollowupPrompts.length}\n`,
  );
};

main().catch((err) => {
  process.stderr.write(`Synergy smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
