/**
 * Scheduled entry point for the FR-09 retention worker (ADR 0020).
 *
 * One pass by default (for cron / a systemd timer / `docker compose run`). Set
 * RETENTION_INTERVAL_SECONDS to loop in-process (the compose `retention` service).
 * Reads DATABASE_URL; prints one line per pass and never logs the password.
 */
import { runRetentionWorker } from '../src/index.js';

const redact = (u: string): string => u.replace(/:[^:@/]+@/, ':***@');

const pass = async (url: string): Promise<void> => {
  const r = await runRetentionWorker({ databaseUrl: url });
  process.stdout.write(
    `${new Date().toISOString()} retention tenants=${r.tenantsScanned} purged=${r.purged} database=${redact(url)}\n`,
  );
};

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL is required\n');
    process.exit(2);
  }
  const every = Number(process.env['RETENTION_INTERVAL_SECONDS'] ?? '0');
  if (!(every > 0)) {
    await pass(url);
    return;
  }
  for (;;) {
    try {
      await pass(url);
    } catch (err) {
      process.stderr.write(
        `retention pass failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    await new Promise((res) => setTimeout(res, every * 1000));
  }
};

main().catch((err) => {
  process.stderr.write(`retention-run failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
