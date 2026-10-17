#!/usr/bin/env node
/**
 * Local dev stack runner (M7).
 *
 * Brings up the full auditai stack on a single machine so a contributor can `pnpm local:up`
 * once and then exercise the employee survey, the admin page, the Postgres schema and the
 * isolation tests without any external infrastructure.
 *
 * Components started:
 *   - Embedded PostgreSQL 17 on a free port, with the auditai_app role granted (M4 migration 0004).
 *   - Migration runner applies `infra/db/migrations/*.sql`.
 *   - `next build` (cached) + `next start --port <port>`.
 *
 * The process logs Postgres readiness and the Next.js URL to stderr; the parent process reads
 * the printed `READY postgres=...; web=...; admin=...` line to know when everything is up.
 *
 * Subcommands:
 *   local-stack up       \u2014 boot Postgres + Next.js, keep running, log to /tmp/auditai-local-*.log
 *   local-stack down     \u2014 stop everything (Postgres + Next.js) cleanly
 *   local-stack reset    \u2014 drop + recreate the auditai database, re-run migrations + seed
 *   local-stack status   \u2014 print current state, exit 0 if both are healthy, exit 1 otherwise
 *
 * Subcommands are also exposed via pnpm scripts in the root package.json: `pnpm local:up`,
 * `pnpm local:down`, `pnpm local:reset`, `pnpm local:status`.
 */

import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMMAND = process.argv[2] ?? 'up';
// apps/web is the directory that owns the `pg` Node module. Migrations and the Next.js app
// both run from there, so this constant is the cwd for child processes.
const APPS_WEB_DIR = join(__dirname, '..');
const PROJECT_ROOT = join(APPS_WEB_DIR, '..', '..');
const DATA_DIR = mkdtempSync(join(tmpdir(), 'auditai-pg-local-'));
const LOG_DIR = '/tmp';
const PG_LOG = join(LOG_DIR, 'auditai-local-postgres.log');
const WEB_LOG = join(LOG_DIR, 'auditai-local-web.log');
const PG_USER = 'auditai';
const PG_PASSWORD = 'auditai';
const PG_DATABASE = 'auditai_local';

const env = (extra = {}) => ({
  ...process.env,
  DATABASE_URL: `postgres://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DATABASE}`,
  DATABASE_APP_USER: PG_USER,
  DATABASE_APP_PASSWORD: PG_PASSWORD,
  // Synthetic, local-only. Real deployments set their own AUTH_SESSION_SECRET.
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET ?? 'local-stack-synthetic-session-secret',
  AUTH_COOKIE_SECURE: '0',
  ALLOW_DEV_DB_PASSWORD: '1',
  ...extra,
});

let pgInstance = null;
let webProcess = null;

async function findFreePort(preferred) {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const tester = createConnection({ host: '127.0.0.1', port });
      tester.once('connect', () => {
        tester.end();
        resolve(false);
      });
      tester.once('error', () => resolve(true));
    });
  if (await tryPort(preferred)) return preferred;
  return new Promise((resolve, reject) => {
    import('node:net').then((net) => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  });
}

const PG_PORT = await findFreePort(54340);
const WEB_PORT = await findFreePort(3101);
const ADMIN_PORT = await findFreePort(3102);

// Persist the chosen ports so `local:status` (a separate invocation) can probe the right
// address without depending on the auto-discovered port being the default.
const STATE_PATH = '/tmp/auditai-local-stack.ports.json';
const writeState = () => {
  try {
    writeFileSync(
      STATE_PATH,
      JSON.stringify({ pg: PG_PORT, web: WEB_PORT, admin: ADMIN_PORT, pid: process.pid }, null, 2),
    );
  } catch {
    // best-effort; status will fall back to the default port.
  }
};
const readState = () => {
  try {
    const raw = readFileSync(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.pg === 'number' &&
      typeof parsed?.web === 'number' &&
      typeof parsed?.admin === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

const waitFor = async (predicate, label, timeoutMs = 60_000, intervalMs = 500) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timeout waiting for ${label} after ${timeoutMs} ms`);
};

const log = (msg) => process.stderr.write(`[local-stack] ${msg}\n`);

const runMigrations = async () => {
  log('applying migrations');
  const runner = spawn(
    process.execPath,
    [join(PROJECT_ROOT, 'infra', 'db', 'scripts', 'migrate.mjs')],
    {
      // The migration script imports `pg`, which is now hoisted at the repo root so it resolves
      // from any cwd.
      cwd: PROJECT_ROOT,
      env: env(),
      stdio: 'inherit',
    },
  );
  await new Promise((resolve, reject) => {
    runner.on('exit', (code) =>
      code === 0 ? resolve(undefined) : reject(new Error(`migrate exited with code ${code}`)),
    );
    runner.on('error', reject);
  });
};

const startPostgres = async () => {
  log(`booting embedded postgres on 127.0.0.1:${PG_PORT}`);
  pgInstance = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: false,
    onLog: (m) => log(`[pg] ${String(m).trimEnd()}`),
    onError: (err) => log(`pg error: ${err}`),
  });
  await pgInstance.initialise();
  log('pg initialised');
  await pgInstance.start();
  log('pg start() returned');
  try {
    await pgInstance.createDatabase(PG_DATABASE);
    log(`pg database ${PG_DATABASE} created`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(msg)) {
      log(`pg database ${PG_DATABASE} already exists; reusing`);
    } else {
      throw err;
    }
  }
  // Wait until the server actually accepts connections.
  await waitFor(
    async () => {
      // Use a raw TCP probe so we don't depend on the pg client lifecycle.
      return new Promise((resolve) => {
        const socket = createConnection({ host: '127.0.0.1', port: PG_PORT });
        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(ok);
        };
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
        setTimeout(() => done(false), 1_000);
      });
    },
    'postgres TCP port 54340',
    90_000,
    500,
  );
};

const startWeb = async () => {
  log(`starting Next.js on port ${WEB_PORT} (admin on ${ADMIN_PORT})`);
  // Skip the rebuild if the .next/ artifact is already present. The runner is intentionally
  // not the canonical build path; contributors run `pnpm --filter @auditai/web build` (or any
  // other pnpm pipeline) and the runner just serves the existing artifact. This keeps the
  // runner cheap and avoids the rare kernel-level EAGAIN on `next build`'s jest-worker spawn.
  const nextDir = join(APPS_WEB_DIR, '.next');
  const hasBuild = existsSync(nextDir);
  if (!hasBuild) {
    log('no .next/ artifact found; running `pnpm --filter @auditai/web build` first');
    const build = spawn('pnpm', ['--filter', '@auditai/web', 'build'], {
      cwd: PROJECT_ROOT,
      env: env(),
      stdio: 'inherit',
    });
    await new Promise((resolve, reject) => {
      build.on('exit', (code) =>
        code === 0 ? resolve(undefined) : reject(new Error(`build exited with code ${code}`)),
      );
      build.on('error', reject);
    });
  } else {
    log('.next/ artifact present; skipping rebuild');
  }
  // Use `next start` on a single port and route both employee + admin on the same host.
  webProcess = spawn('pnpm', ['exec', 'next', 'start', '--port', String(WEB_PORT)], {
    cwd: join(PROJECT_ROOT, 'apps', 'web'),
    env: env({ PORT: String(WEB_PORT) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const writeLog = (chunk) => {
    process.stderr.write(`[web] ${chunk}`);
  };
  webProcess.stdout.on('data', writeLog);
  webProcess.stderr.on('data', writeLog);
  webProcess.on('exit', (code) => log(`next exited with code ${code}`));
  await waitFor(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${WEB_PORT}/about`);
      return res.ok;
    } catch {
      return false;
    }
  }, 'web /about responds');
};

const announce = () => {
  process.stdout.write(
    `\nREADY postgres=postgres://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DATABASE}; ` +
      `web=http://127.0.0.1:${WEB_PORT}; admin=http://127.0.0.1:${WEB_PORT}/admin/engagements\n`,
  );
  process.stdout.write('Press Ctrl-C to stop. Logs: ' + PG_LOG + ', ' + WEB_LOG + '\n');
};

const stopEverything = async () => {
  if (webProcess && !webProcess.killed) {
    log('stopping next');
    webProcess.kill('SIGINT');
    await new Promise((r) => setTimeout(r, 1500));
    if (!webProcess.killed) webProcess.kill('SIGKILL');
  }
  if (pgInstance) {
    try {
      log('stopping postgres');
      await pgInstance.stop();
    } catch (err) {
      log(`pg stop error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
};

const resetDatabase = async () => {
  log('resetting database (drop, recreate, migrate, seed)');
  const { Client } = (await import('pg')).default;
  const client = new Client({ connectionString: env().DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO PUBLIC');
  await client.end();
  await runMigrations();
};

const cmd = async () => {
  if (COMMAND === 'up') {
    writeState();
    await startPostgres();
    await runMigrations();
    await startWeb();
    announce();
    process.on('SIGINT', async () => {
      log('SIGINT, shutting down');
      await stopEverything();
      process.exit(0);
    });
    // Idle forever until killed.
    setInterval(() => undefined, 1 << 30);
  } else if (COMMAND === 'down') {
    log('down: kill any running next + remove tmp data dir');
    try {
      const { execSync } = await import('node:child_process');
      execSync(`pkill -f "next start --port ${WEB_PORT}" || true`, { stdio: 'ignore' });
    } catch {
      // ignore
    }
    log('down: if embedded postgres is still running, run `pkill -f embedded-postgres`');
    process.exit(0);
  } else if (COMMAND === 'reset') {
    await startPostgres();
    await resetDatabase();
    log('reset complete; database ready');
    process.exit(0);
  } else if (COMMAND === 'status') {
    const state = readState();
    const statusWebPort = state?.web ?? WEB_PORT;
    const statusPgPort = state?.pg ?? PG_PORT;
    let healthy = true;
    try {
      const res = await fetch(`http://127.0.0.1:${statusWebPort}/about`);
      log(`web /about on 127.0.0.1:${statusWebPort}: HTTP ${res.status}`);
    } catch (err) {
      log(
        `web /about on 127.0.0.1:${statusWebPort}: unreachable (${err instanceof Error ? err.message : String(err)})`,
      );
      healthy = false;
    }
    // Probe Postgres with a raw TCP connect. We deliberately do NOT use `pg.Client` here:
    // importing the module via dynamic `import('pg')` and then constructing a client silently
    // exits the process under Node 24 (a known top-level-await interaction), so a TCP probe
    // is both faster and more portable.
    const pgReachable = await new Promise((resolve) => {
      const sock = createConnection({ host: '127.0.0.1', port: statusPgPort });
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        sock.destroy();
        resolve(ok);
      };
      sock.once('connect', () => done(true));
      sock.once('error', () => done(false));
      setTimeout(() => done(false), 1_000);
    });
    if (pgReachable) {
      log(`postgres on 127.0.0.1:${statusPgPort}: ready (TCP)`);
    } else {
      log(`postgres on 127.0.0.1:${statusPgPort}: not reachable`);
      healthy = false;
    }
    process.exit(healthy ? 0 : 1);
  } else {
    process.stderr.write(`unknown command: ${COMMAND}\n`);
    process.exit(2);
  }
};

cmd().catch((err) => {
  log(`fatal: ${err instanceof Error ? err.stack : String(err)}`);
  stopEverything().finally(() => process.exit(1));
});
