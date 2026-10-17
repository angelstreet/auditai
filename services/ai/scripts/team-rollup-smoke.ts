/**
 * Smoke for the M14 team-badge rollup worker.
 *
 * Runs `rollupTeamBadges` against the database in `DATABASE_URL`, prints
 * `teams=N upserted=M`, and exits non-zero if no teams were processed
 * (the synthetic seed in `0003_seed_synthetic.sql` always provides at
 * least two teams).
 */
import { rollupTeamBadges } from '../src/index.js';

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(2);
  }
  const tenantId = process.env['SMOKE_TENANT_ID'] ?? '11111111-1111-4111-8111-111111111111';
  const result = await rollupTeamBadges(tenantId, { databaseUrl: url });
  process.stdout.write(
    `Team rollup: tenant=${tenantId} teams=${result.teamsProcessed} upserted=${result.upserted}\n`,
  );
};

main().catch((err) => {
  process.stderr.write(
    `Team-rollup smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
