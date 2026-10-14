#!/usr/bin/env node
/**
 * Apply the SQL migrations under infra/db/migrations in numeric order.
 *
 *   DATABASE_URL=postgres://user:pass@host:5432/db node infra/db/scripts/migrate.mjs
 *
 * Uses an in-database `app_schema_migrations` table to track applied files. Each migration runs
 * inside a single client connection (sequential). On any error, the script exits non-zero *after*
 * rolling back the failed migration; earlier migrations remain applied.
 *
 * Idempotent: re-running is safe.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

const MIGRATION_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS app_schema_migrations (
  filename     TEXT PRIMARY KEY,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(MIGRATION_TABLE_DDL);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await client.query('SELECT filename FROM app_schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      process.stdout.write(`= ${file} (already applied)\n`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`+ ${file}\n`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO app_schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      process.stderr.write(`! ${file} failed: ${err.message ?? err}\n`);
      process.exitCode = 1;
      throw err;
    }
  }

  process.stdout.write('migrations: done\n');
} finally {
  await client.end();
}
