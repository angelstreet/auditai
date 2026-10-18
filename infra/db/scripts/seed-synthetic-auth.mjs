#!/usr/bin/env node
/**
 * Give the two seeded synthetic auditors their obviously-fake passwords (TASK-K, ADR 0032).
 *
 * Migration 0017 clears these hashes on every database, so a deployment never keeps credentials
 * that are written in this public repo. The local runner, the smokes, Playwright and CI call
 * this after the migrations. It refuses to run when NODE_ENV=production.
 *
 *   DATABASE_URL=postgres://... node infra/db/scripts/seed-synthetic-auth.mjs
 */
import pg from 'pg';

/** Password of tenant A's synthetic auditor: `synthetic-password-a`. */
export const SYNTHETIC_HASHES = {
  '99999999-9999-4999-8999-999999999999':
    'scrypt$16384$8$1$EE2HkJ5iyovtU16T/qQTJA==$REq3Dv6X1i7O5o7zTcJw7JsQT3xraXgoj034a7JdeEA=',
  // Password of tenant B's synthetic auditor: `synthetic-password-b`.
  '99999999-9999-4999-8999-aaaaaaaaaaaa':
    'scrypt$16384$8$1$mFGj0KboTyb0ZuJO4rGNxQ==$M1tu1/IGuAuuJAxSor9ldbTaDjLWsHlmVBbv30/0X4I=',
};

export const seedSyntheticAuth = async (client, env = process.env) => {
  if (env['NODE_ENV'] === 'production') {
    throw new Error('seed-synthetic-auth refuses to run when NODE_ENV=production');
  }
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    for (const [id, hash] of Object.entries(SYNTHETIC_HASHES)) {
      await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, hash]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env['NODE_ENV'] === 'production') {
    process.stderr.write('seed-synthetic-auth refuses to run when NODE_ENV=production\n');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();
  try {
    await seedSyntheticAuth(client);
    process.stdout.write('synthetic auditor passwords seeded (local only)\n');
  } finally {
    await client.end();
  }
}
