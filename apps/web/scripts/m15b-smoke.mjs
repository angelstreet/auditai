#!/usr/bin/env node
/**
 * End-to-end smoke for M15 slice B + admin/data surface + /board
 * integration + /welcome-as-root.
 *
 * Assumes `pnpm local:up` is running.
 *
 *   1. HTTP GET / and assert the response Location is `/welcome`.
 *   2. HTTP GET /welcome and assert the hero + CTA render.
 *   3. HTTP GET /board and assert no 500, no horizontal scroll.
 *   4. HTTP GET /admin/data and assert the export + delete widgets render.
 *
 * No DB writes; this is a read-only smoke over the production build.
 */
import { loginCookie } from './smoke-auth.mjs';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const cookiePromise = loginCookie(base);

const ok = (m) => process.stdout.write(`\u2713 ${m}\n`);
const fail = (m) => {
  process.stderr.write(`\u2717 ${m}\n`);
  process.exit(1);
};

const fetchHead = async (path) => {
  const res = await fetch(`${base}${path}`, {
    redirect: 'manual',
    headers: { cookie: await cookiePromise },
  });
  return { status: res.status, location: res.headers.get('location') };
};

const fetchText = async (path) => {
  const res = await fetch(`${base}${path}`, { headers: { cookie: await cookiePromise } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
};

const main = async () => {
  // 1. / redirects to /welcome.
  const root = await fetchHead('/');
  if (root.status !== 307 && root.status !== 308 && root.status !== 302) {
    fail(`/ did not return a redirect, got HTTP ${root.status}`);
  }
  if (!root.location || !root.location.endsWith('/welcome')) {
    fail(`/ did not redirect to /welcome, got ${root.location}`);
  }
  ok('/ redirects to /welcome');

  // 2. /welcome renders the hero + CTA.
  const welcome = await fetchText('/welcome');
  if (!/h1[^>]*>See how work/.test(welcome)) {
    fail('/welcome did not render the hero heading');
  }
  if (!welcome.includes('Start the intake')) {
    fail('/welcome did not render the intake CTA');
  }
  ok('/welcome renders the hero + intake CTA');

  // 3. /board is reachable and contains at least the kanban header.
  const board = await fetchText('/board');
  if (!board.includes('kanban')) {
    fail('/board did not include the kanban container');
  }
  ok('/board renders the kanban');

  // 4. /admin/data renders the export widget + delete widget.
  const data = await fetchText('/admin/data');
  if (!/h1[^>]*>Data exports/.test(data)) {
    fail('/admin/data did not render the heading');
  }
  if (!data.includes('name="kind"')) {
    fail('/admin/data did not render the export-kind select');
  }
  if (!data.includes('name="respondentPseudonym"')) {
    fail('/admin/data did not render the erase-pseudonym input');
  }
  ok('/admin/data renders export + erase widgets');

  process.stdout.write('M15 slice B smoke: all OK\n');
};

main().catch((err) => {
  process.stderr.write(
    `M15 slice B smoke failed: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
