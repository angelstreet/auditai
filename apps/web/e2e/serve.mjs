/**
 * Playwright webServer launcher (TASK-G).
 *
 * Playwright starts `webServer` before `globalSetup`, so a database booted in global setup is
 * never visible to the server. This script owns the whole chain instead, deterministically:
 *   1. database: use DATABASE_URL when set (CI service container), otherwise boot an embedded
 *      PostgreSQL 17 in a fresh tmp dir on a free port,
 *   2. apply the migrations and synthetic seed,
 *   3. write `.playwright-database-url` for specs that talk to the database directly,
 *   4. `next build` (skip with PW_SKIP_BUILD=1 when `.next` is current), then `next start`.
 * SIGTERM/SIGINT stop the server and the embedded database.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webDir, '..', '..');
const STATE_FILE = join(webDir, '.playwright-database-url');
const PORT = process.env['PW_PORT'] ?? '3200';

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const run = (args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { cwd: webDir, env, stdio: 'inherit' });
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited with ${code}`)),
    );
    child.once('error', reject);
  });

let pg = null;
let dataDir = null;
let server = null;
const cleanup = async () => {
  server?.kill('SIGTERM');
  try {
    await pg?.stop();
  } catch {
    // already stopped
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  rmSync(STATE_FILE, { force: true });
};
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => void cleanup().finally(() => process.exit(0)));
}

const main = async () => {
  let databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    dataDir = mkdtempSync(join(tmpdir(), 'evolai-pw-pg-'));
    const port = await freePort();
    pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'auditai',
      password: 'auditai',
      port,
      persistent: false,
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('evolai_test');
    databaseUrl = `postgres://auditai:auditai@127.0.0.1:${port}/evolai_test`;
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    // Synthetic, test-only settings (ADR 0023); never real secrets.
    AUTH_SESSION_SECRET: 'playwright-synthetic-session-secret',
    AUTH_COOKIE_SECURE: '0',
    ALLOW_DEV_DB_PASSWORD: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  };

  await run([process.execPath, join(repoRoot, 'infra', 'db', 'scripts', 'migrate.mjs')], env);
  writeFileSync(STATE_FILE, JSON.stringify({ databaseUrl }, null, 2));

  if (process.env['PW_SKIP_BUILD'] !== '1') await run(['pnpm', 'exec', 'next', 'build'], env);
  server = spawn('pnpm', ['exec', 'next', 'start', '--port', PORT], {
    cwd: webDir,
    env,
    stdio: 'inherit',
  });
  server.once('exit', (code) => void cleanup().finally(() => process.exit(code ?? 1)));
};

main().catch((err) => {
  process.stderr.write(`[playwright serve] ${err instanceof Error ? err.message : err}\n`);
  void cleanup().finally(() => process.exit(1));
});
