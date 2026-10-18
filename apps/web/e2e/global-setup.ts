import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Playwright global setup (M8).
 *
 * Boots an embedded PostgreSQL 17 in a fresh tmp dir, applies the M4 migrations,
 * writes the seeded `DATABASE_URL` to `apps/web/.playwright-database-url` so the
 * `webServer` block (and the test files) can pick it up, and tears the stack down
 * after the test run via `globalTeardown.ts`.
 *
 * The user/role/database name match the M4 migration's `0004_app_role.sql`:
 *   user:     auditai / password: auditai / db: evolai_test
 *
 * If `DATABASE_URL` is already set in the environment, we trust the caller (CI
 * service container or a developer-supplied local Postgres) and skip the boot.
 * This is the same convention `tests/db/src/global-setup.ts` uses.
 */

const PG_USER = 'auditai';
const PG_PASSWORD = 'auditai';
const PG_DATABASE = 'evolai_test';
const PREFERRED_PORT = 54330;
const STATE_FILE = join(process.cwd(), '.playwright-database-url');

const waitFor = async (
  predicate: () => Promise<boolean>,
  label: string,
  timeoutMs = 60_000,
  intervalMs = 250,
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timeout waiting for ${label} after ${timeoutMs} ms`);
};

const tcpProbe = (port: number) =>
  new Promise<boolean>((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(ok);
    };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), 1_000);
  });

const findFreePort = async (preferred: number): Promise<number> => {
  if (await tcpProbe(preferred)) {
    // preferred port is in use by something else \u2014 pick the next free
    return new Promise((resolve, reject) => {
      const server = require('node:net').createServer();
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as { port: number }).port;
        server.close(() => resolve(port));
      });
      server.once('error', reject);
    });
  }
  return preferred;
};

export default async function globalSetup(): Promise<void> {
  if (process.env['DATABASE_URL']) {
    process.stderr.write(
      `[playwright] using external DATABASE_URL=${process.env['DATABASE_URL']}\n`,
    );
    return;
  }

  const dataDir = mkdtempSync(join(tmpdir(), 'evolai-pw-pg-'));
  const port = await findFreePort(PREFERRED_PORT);
  process.stderr.write(`[playwright] booting embedded postgres on 127.0.0.1:${port}\n`);

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(PG_DATABASE);
  } catch (err) {
    if (!/already exists/i.test(err instanceof Error ? err.message : String(err))) {
      throw err;
    }
  }

  await waitFor(async () => tcpProbe(port), `postgres TCP port ${port}`);

  const dbUrl = `postgres://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${port}/${PG_DATABASE}`;
  process.env['DATABASE_URL'] = dbUrl;
  // Hand the URL to the webServer + tests via a state file
  require('node:fs').writeFileSync(
    STATE_FILE,
    JSON.stringify({ databaseUrl: dbUrl, dataDir, port }, null, 2),
  );
  process.stderr.write(`[playwright] database ready, DATABASE_URL=${dbUrl}\n`);

  // Apply migrations + seed
  const repoRoot = join(process.cwd(), '..', '..');
  await new Promise<void>((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      [join(repoRoot, 'infra', 'db', 'scripts', 'migrate.mjs')],
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'inherit',
      },
    );
    runner.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`migrate exited with code ${code}`)),
    );
    runner.once('error', reject);
  });
  process.stderr.write(`[playwright] migrations applied\n`);
}
