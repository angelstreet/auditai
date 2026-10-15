/**
 * Smoke for the AI worker (M9).
 *
 * Runs `processAllSubmitted` against the database in `DATABASE_URL`, prints the
 * outcome, and exits non-zero only if a submission failed. The script is
 * intentionally idempotent: re-running it after a successful run will simply
 * process zero rows and exit zero.
 *
 * The script is dependency-free (no test runner) so it runs against the local
 * stack via `pnpm local:smoke` and against CI in the same way.
 */
import { processAllSubmitted } from '../src/index.js';

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(2);
  }
  const { processed, failures } = await processAllSubmitted({ databaseUrl: url });
  process.stdout.write(
    `AI worker: processed=${processed} failures=${failures} database=${url.replace(/:[^:@]+@/, ':***@')}\n`,
  );
  if (failures > 0) {
    process.exit(1);
  }
};

main().catch((err) => {
  process.stderr.write(`AI smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
