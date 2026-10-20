#!/usr/bin/env node
/**
 * Remove personal names from existing accounts (TASK-X, ADR 0044). Dry run unless --apply.
 *
 *   pnpm identity:strip-names [--apply] [--expect-host <db host>]
 *
 * Prints counts only, never a name or an address. Connection: DATABASE_URL_UNPOOLED, else DATABASE_URL.
 */
import pg from 'pg';
import { resolveTargetUrl } from './auditor-lib.mjs';
import { stripIdentities } from './identity-lib.mjs';

const main = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const hostIdx = args.indexOf('--expect-host');
  const url = resolveTargetUrl(process.env, hostIdx >= 0 ? args[hostIdx + 1] : undefined);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const r = await stripIdentities(client, { apply });
    process.stdout.write(
      `${apply ? 'applied' : 'dry run (nothing changed; use --apply)'}: ` +
        `${r.namesCleared} display names cleared, ${r.addressesRewritten} placeholder addresses rewritten\n`,
    );
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  process.stderr.write(`identity: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
