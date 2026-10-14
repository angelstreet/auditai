import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', '..', 'infra', 'db', 'migrations');

/**
 * Connect to the test Postgres instance using DATABASE_URL. Throws if unset \u2014 the test should fail
 * fast when the CI service container is missing.
 */
export const connect = (): pg.Client => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set; tests/db cannot run');
  }
  return new pg.Client({ connectionString: url });
};

/**
 * Apply the SQL migrations in numeric order. Re-runs are idempotent because the runner writes
 * filenames into `app_schema_migrations` after each successful apply.
 */
export const applyMigrations = async (client: pg.Client): Promise<void> => {
  await client.query(
    'CREATE TABLE IF NOT EXISTS app_schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const { rows } = await client.query('SELECT filename FROM app_schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO app_schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(
        `migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
};

/**
 * Drop and recreate the public schema so each test gets a clean slate. Used by the isolation test
 * before it sets up its own synthetic tenants.
 */
export const resetDatabase = async (client: pg.Client): Promise<void> => {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO PUBLIC');
};

/**
 * Run a function in a transaction with `app.tenant_id` set to the given value. Used by the
 * isolation test to imitate an API call that has already authenticated and authorised a tenant.
 */
export const withTenant = async <T>(
  client: pg.Client,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> => {
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
  try {
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
};

/**
 * Same as `withTenant` but also flips `app.is_service_account` so INSERT/UPDATE against the
 * `tenants` table itself succeeds (the seed runs that way).
 */
export const withServiceAccount = async <T>(
  client: pg.Client,
  fn: () => Promise<T>,
): Promise<T> => {
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.is_service_account = 'on'`);
  try {
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
};
