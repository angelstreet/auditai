#!/usr/bin/env node
/**
 * Smoke for TASK-N (FR-03): bulk invitations, tracking, reminders, revoke/extend/regenerate.
 *
 * Assumes `pnpm local:up` is running. Uses only synthetic data, signs in as the seeded auditor,
 * drives the session-authenticated JSON API and the cron route, and removes what it created.
 *
 *   1. create 6 invitations for the seeded engagement (no names, no addresses in the response);
 *   2. progress counts rise by 6; opening one link moves "opened" by one;
 *   3. CSV export is `link,team` only and lists the new links;
 *   4. a reminder is due once an invitation is old enough, is consumed by "mark as resent" and is
 *      then no longer due (idempotent);
 *   5. regenerate kills the old link; revoke blocks the new one; extend works;
 *   6. the cron route refuses a missing/wrong bearer and runs with the right one;
 *   7. another tenant's session is refused.
 */
import pg from 'pg';
import { SYNTHETIC_USERS, loginCookie } from './smoke-auth.mjs';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}
const cronSecret = process.env['CRON_SECRET'] ?? 'local-stack-synthetic-cron-secret';
const { tenantId } = SYNTHETIC_USERS.a;
const engagementId = 'a5555555-4555-4555-8555-555555555555';
const teamId = 'a2222222-2222-4222-8222-222222222222';

const ok = (m) => process.stdout.write(`✓ ${m}\n`);
let cleanupClient = null;
const fail = async (m) => {
  process.stderr.write(`✗ ${m}\n`);
  await cleanup().catch(() => undefined);
  process.exit(1);
};
const check = async (cond, m) => (cond ? ok(m) : fail(m));

const cleanup = async () => {
  if (!cleanupClient) return;
  await cleanupClient.query(
    `DELETE FROM invitations WHERE tenant_id = $1 AND created_by IS NOT NULL
        AND respondent_pseudonym LIKE 'p-%'`,
    [tenantId],
  );
  await cleanupClient.query(`DELETE FROM audit_log WHERE false`).catch(() => undefined);
};

const main = async () => {
  const cookie = await loginCookie(base);
  const api = async (method, path, body, ck = cookie) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { cookie: ck, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* csv or html */
    }
    return { status: res.status, json, text };
  };
  const q = `tenant=${tenantId}&engagement=${engagementId}`;
  const progress = async () => (await api('GET', `/api/admin/invitations?${q}`)).json;
  const teamRow = (p) => p.teams.find((t) => t.teamId === teamId);

  cleanupClient = new pg.Client({ connectionString: databaseUrl });
  await cleanupClient.connect();
  // A previous aborted run must not skew the counts.
  await cleanup();

  const before = teamRow(await progress());
  const created = await api('POST', '/api/admin/invitations', {
    tenantId,
    engagementId,
    op: 'create',
    counts: { [teamId]: 6 },
    expiresInDays: 14,
  });
  await check(created.json?.ok && created.json.count === 6, 'creates 6 invitations');
  const links = created.json.links;
  await check(
    links.every(
      (l) => /\/s\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{32,}$/.test(l.link) && typeof l.team === 'string',
    ),
    'each link is a signed single-use survey link with a team label',
  );
  await check(
    !/@|name|email/i.test(JSON.stringify(Object.keys(created.json.links[0]))),
    'the create response carries no name or email field',
  );

  const afterCreate = teamRow(await progress());
  await check(afterCreate.invited === before.invited + 6, 'progress: invited grows by 6');

  const opened = await fetch(links[0].link.replace(/^https?:\/\/[^/]+/, base), {
    redirect: 'manual',
  });
  await check(opened.status === 200, 'respondent link opens');
  const afterOpen = teamRow(await progress());
  await check(afterOpen.opened === afterCreate.opened + 1, 'progress: opened grows by 1');
  await check(afterOpen.completed === afterCreate.completed, 'progress: completed unchanged');

  const csv = await api('GET', `/admin/invitations/export?${q}`);
  await check(
    csv.status === 200 && csv.text.startsWith('link,team\r\n'),
    'export is link,team only',
  );
  await check(
    links.every((l) => csv.text.includes(l.link.replace(/^https?:\/\/[^/]+/, ''))),
    'export lists the new links',
  );

  const open = (await api('GET', `/api/admin/invitations?${q}&view=open`)).json.open;
  await check(open.length >= 6 && !('status' in open[0]), 'open list has no per-invitation status');

  // Reminders: age two invitations, mark as resent, confirm it is consumed.
  const ids = open
    .filter((o) => links.some((l) => l.link.includes(o.link.split('/s/')[1])))
    .map((o) => o.id);
  await cleanupClient.query(
    `UPDATE invitations SET created_at = now() - interval '4 days' WHERE id = ANY($1::uuid[])`,
    [ids.slice(0, 2)],
  );
  const due = (await api('GET', `/api/admin/invitations?${q}&view=reminders`)).json.due;
  await check(
    due.length >= 2 && ids.slice(0, 2).every((i) => due.some((d) => d.id === i)),
    'reminder list contains the aged invitations',
  );
  const reminded = await api('POST', '/api/admin/invitations', {
    tenantId,
    engagementId,
    op: 'remind',
  });
  await check(reminded.json?.count >= 2, 'mark as resent consumes the step');
  const dueAfter = (await api('GET', `/api/admin/invitations?${q}&view=reminders`)).json.due;
  await check(
    !ids.slice(0, 2).some((i) => dueAfter.some((d) => d.id === i)),
    'reminders are idempotent',
  );

  // Regenerate, revoke, extend.
  const target = open.find((o) => o.id === ids[2]);
  const regen = await api('POST', '/api/admin/invitations', {
    tenantId,
    engagementId,
    op: 'regenerate',
    invitationId: target.id,
  });
  await check(regen.json?.ok && regen.json.link !== target.link, 'regenerate returns a new link');
  const oldRes = await fetch(target.link.replace(/^https?:\/\/[^/]+/, base));
  await check(oldRes.status === 404, 'the old link stops working');
  const newRes = await fetch(regen.json.link.replace(/^https?:\/\/[^/]+/, base));
  await check(newRes.status === 200, 'the new link works');
  const extended = await api('POST', '/api/admin/invitations', {
    tenantId,
    engagementId,
    op: 'extend',
    invitationId: target.id,
    days: 5,
  });
  await check(extended.json?.ok, 'extend works');
  const revoked = await api('POST', '/api/admin/invitations', {
    tenantId,
    engagementId,
    op: 'revoke',
    invitationId: target.id,
  });
  await check(revoked.json?.ok, 'revoke works');
  const revokedPage = await (
    await fetch(regen.json.link.replace(/^https?:\/\/[^/]+/, base))
  ).text();
  await check(!revokedPage.includes('name="answer"'), 'a revoked link shows no questions');
  const again = await api('POST', '/api/admin/invitations', {
    tenantId,
    engagementId,
    op: 'revoke',
    invitationId: target.id,
  });
  await check(again.json?.code === 'not_open', 'revoking twice is refused');

  // Cron route.
  const noAuth = await fetch(`${base}/api/cron/reminders`);
  await check(noAuth.status === 401, 'cron route refuses a request without the secret');
  const wrong = await fetch(`${base}/api/cron/reminders`, {
    headers: { authorization: 'Bearer wrong-wrong-wrong-wrong' },
  });
  await check(wrong.status === 401, 'cron route refuses a wrong secret');
  const run = await fetch(`${base}/api/cron/reminders`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const runJson = await run.json();
  await check(
    run.status === 200 && runJson.ok === true && runJson.sent === 0,
    'cron route runs (list mode sends nothing)',
  );

  // Another tenant's session cannot touch this engagement.
  const otherCookie = await loginCookie(base, SYNTHETIC_USERS.b);
  const cross = await api('GET', `/api/admin/invitations?${q}`, null, otherCookie);
  await check(cross.status === 403, 'tenant B session is refused for tenant A');
  const crossB = await api(
    'GET',
    `/api/admin/invitations?tenant=${SYNTHETIC_USERS.b.tenantId}&engagement=${engagementId}`,
    null,
    otherCookie,
  );
  await check(
    crossB.json?.teams?.length === 0,
    'tenant B sees nothing of tenant A engagement even with its own tenant id',
  );

  await cleanup();
  await cleanupClient.end();
  ok('n:smoke passed');
};

main().catch(async (err) => {
  process.stderr.write(`✗ ${err instanceof Error ? err.message : String(err)}\n`);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
