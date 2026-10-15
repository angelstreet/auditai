#!/usr/bin/env node
/**
 * WebServer launcher for Playwright (M8).
 *
 * Reads `apps/web/.playwright-database-url` (written by `e2e/global-setup.ts`) and
 * exports its `databaseUrl` plus a deterministic `SURVEY_SIGNING_SECRET` before
 * exec-ing `next start --port 3200`. This is the only reliable way to inject env
 * vars into Playwright's `webServer` because globalSetup runs in a separate
 * process whose process.env changes do not propagate.
 *
 * If the state file does not exist (e.g. when the developer runs against a CI
 * service container or a developer-supplied Postgres), we trust the environment
 * and pass it through unchanged.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// playwright.config.ts sits in apps/web/. The state file lives next to it.
const STATE = join(__dirname, '..', '.playwright-database-url');
const PORT = process.argv[2] ?? '3200';

const env = { ...process.env };
if (existsSync(STATE)) {
  try {
    const state = JSON.parse(readFileSync(STATE, 'utf-8'));
    if (state?.databaseUrl) env['DATABASE_URL'] = state.databaseUrl;
  } catch {
    // ignore
  }
}
env['SURVEY_SIGNING_SECRET'] ??= 'playwright-test-signing-secret';

const child = spawn(
  'pnpm',
  ['exec', 'next', 'start', '--port', PORT],
  { stdio: 'inherit', env },
);
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  process.stderr.write(`playwright-webserver: failed to spawn next: ${err.message}\n`);
  process.exit(1);
});
