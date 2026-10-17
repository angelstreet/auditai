/**
 * Smoke for the M15 retention worker (FR-09, PRD §15).
 *
 * Reads `DATABASE_URL`, runs `runRetentionWorker`, and prints
 * `tenants=N purged=M`. Idempotent: re-running after a fully-purged
 * tenant prints `purged=0`.
 */
import { runRetentionWorker } from '../src/index.js';

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(2);
  }
  const result = await runRetentionWorker({ databaseUrl: url });
  process.stdout.write(
    `Retention worker: tenants=${result.tenantsScanned} purged=${result.purged} database=${url.replace(/:[^:@]+@/, ':***@')}\n`,
  );
};

main().catch((err) => {
  process.stderr.write(
    `Retention smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
