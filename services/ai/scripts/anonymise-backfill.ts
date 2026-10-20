/**
 * `pnpm anonymise:backfill [--apply]` (TASK-W, ADR 0044). Dry run unless `--apply`.
 * Connection string: DATABASE_URL_UNPOOLED, else DATABASE_URL. Prints counts per tenant only.
 */
import { runAnonymiseBackfill } from '../src/anonymiseBackfill.js';

const main = async (): Promise<void> => {
  const url = process.env['DATABASE_URL_UNPOOLED'] || process.env['DATABASE_URL'];
  if (!url) {
    process.stderr.write('DATABASE_URL (or DATABASE_URL_UNPOOLED) is required\n');
    process.exit(2);
  }
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const unknown = args.filter((a) => a !== '--apply');
  if (unknown.length > 0) {
    process.stderr.write('usage: pnpm anonymise:backfill [--apply]\n');
    process.exit(2);
  }
  const apply = args.includes('--apply');
  const report = await runAnonymiseBackfill({ databaseUrl: url, apply });
  process.stdout.write(
    `anonymise backfill: ${apply ? 'APPLIED' : 'dry run (add --apply to write)'}\n`,
  );
  for (const t of report.tenants) {
    process.stdout.write(`tenant ${t.tenantId} scanned=${t.scanned} changed=${t.changed}\n`);
  }
  const total = report.tenants.reduce((n, t) => n + t.changed, 0);
  process.stdout.write(`total changed=${total}\n`);
};

main().catch((err) => {
  process.stderr.write(
    `anonymise-backfill failed: ${err instanceof Error ? err.message : 'error'}\n`,
  );
  process.exit(1);
});
