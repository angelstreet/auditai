#!/usr/bin/env node
/**
 * Synthetic first client for local runs, Playwright and CI (TASK-P, ADR 0035). Same code path as
 * `pnpm seed:client`, with obviously fake names, plus two synthetic sign-ins whose passwords are
 * written here, so it refuses to run when NODE_ENV=production:
 *
 *   synthetic-owner@synthetic.invalid     / synthetic-password-owner     platform owner + auditor
 *   synthetic-referent@synthetic.invalid  / synthetic-password-referent  team referent
 *
 * The owner is a member of the synthetic client tenant only, so the existing tenant A/B suites
 * are unaffected.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { emailHash, hashPassword } from './auditor-lib.mjs';
import { seedClient } from './client-seed-lib.mjs';

export const SYNTHETIC_CLIENT = {
  tenantName: 'Synthetic client C',
  slug: 'synthetic-client-c',
  engagementName: 'Synthetic pilot C',
  teamName: 'Synthetic pilot team',
  referentName: 'Sam Synthetic',
  referentEmail: 'synthetic-referent@synthetic.invalid',
  ownerEmail: 'synthetic-owner@synthetic.invalid',
  locale: 'fr',
};
export const SYNTHETIC_PASSWORDS = {
  owner: 'synthetic-password-owner',
  referent: 'synthetic-password-referent',
};

export const seedSyntheticClient = async (client, env = process.env) => {
  if (env['NODE_ENV'] === 'production') {
    throw new Error('seed-synthetic-client refuses to run when NODE_ENV=production');
  }
  const ownerHash = await hashPassword(SYNTHETIC_PASSWORDS.owner);
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    await client.query(
      `INSERT INTO users (id, email_hash, display_name, password_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email_hash) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [randomUUID(), emailHash(SYNTHETIC_CLIENT.ownerEmail), 'Synthetic Owner', ownerHash],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  const out = await seedClient(client, SYNTHETIC_CLIENT);
  const referentHash = await hashPassword(SYNTHETIC_PASSWORDS.referent);
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [
      out.referentId,
      referentHash,
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  return out;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env['NODE_ENV'] === 'production') {
    process.stderr.write('seed-synthetic-client refuses to run when NODE_ENV=production\n');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();
  try {
    await seedSyntheticClient(client);
    process.stdout.write('synthetic client C seeded (local only)\n');
  } finally {
    await client.end();
  }
}
