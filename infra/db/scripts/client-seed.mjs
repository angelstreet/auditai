#!/usr/bin/env node
/**
 * Seed a first client (TASK-P, ADR 0035). Idempotent and safe on the live database; never a
 * migration. Every name comes from flags, so no client name lives in this public repository.
 *
 *   pnpm seed:client --tenant-name "<Client>" --engagement-name "Pilote <Client>" \
 *     --team-name "<Team>" --referent-name "<First Last>" --owner-email <owner sign-in> \
 *     [--slug <slug>] [--locale fr|en] [--referent-email <address>] [--expect-host <db host>]
 *
 * Without --referent-email the referent gets firstname-lastname@<slug>.invalid and no password:
 * the account exists for "view as" but cannot sign in (RUNBOOK: "Give a referent a real login").
 */
import pg from 'pg';
import { resolveTargetUrl } from './auditor-lib.mjs';
import { seedClient } from './client-seed-lib.mjs';

const FLAGS = {
  'tenant-name': 'tenantName',
  'engagement-name': 'engagementName',
  'team-name': 'teamName',
  'referent-name': 'referentName',
  'referent-email': 'referentEmail',
  'owner-email': 'ownerEmail',
  slug: 'slug',
  locale: 'locale',
  country: 'country',
  'expect-host': 'expectHost',
};

const parseArgs = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const key = a.startsWith('--') ? FLAGS[a.slice(2)] : undefined;
    if (!key) throw new Error(`unknown argument: ${a}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${a} needs a value`);
    out[key] = value;
    i += 1;
  }
  return out;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tenantName) throw new Error('refusing to run without an explicit --tenant-name');
  const client = new pg.Client({
    connectionString: resolveTargetUrl(process.env, args.expectHost),
  });
  await client.connect();
  try {
    const out = await seedClient(client, args);
    process.stdout.write(
      `${JSON.stringify(
        {
          tenantId: out.tenantId,
          engagementId: out.engagementId,
          teamId: out.teamId,
          referentId: out.referentId,
          referentEmail: out.referentEmail,
          created: out.created,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  process.stderr.write(`seed:client: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
