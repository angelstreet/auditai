import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyMigrations, connect } from './db.js';

/**
 * TASK-P (ADR 0035): the first-client seed, the view-as audit verbs (migration 0019) and the
 * isolation of the team space queries. Own database so it cannot race the other suites. Runs as
 * `auditai_app` so row-level security is in force, like the app.
 */
const scripts = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'infra',
  'db',
  'scripts',
);
const load = async (name: string) => (await import(pathToFileURL(join(scripts, name)).href)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TEAM_A = 'a2222222-2222-4222-8222-222222222222';
const ENGAGEMENT_A = 'a5555555-4555-4555-8555-555555555555';
const SYNTHETIC_A = '99999999-9999-4999-8999-999999999999';
const OWNER_EMAIL = 'synthetic-auditor-a@synthetic.invalid';
const OPTS = {
  tenantName: 'Synthétique Client D',
  engagementName: 'Pilote Synthétique D',
  teamName: 'Équipe pilote D',
  ownerEmail: OWNER_EMAIL,
};

let admin: pg.Client;
let db: pg.Client;
let seedLib: any; // eslint-disable-line @typescript-eslint/no-explicit-any
let auditorLib: any; // eslint-disable-line @typescript-eslint/no-explicit-any
let seeded: { tenantId: string; engagementId: string; teamId: string; referentId: string };

const tx = async (setup: string, sql: string, params: unknown[] = []) => {
  await db.query('BEGIN');
  try {
    await db.query(setup);
    const r = await db.query(sql, params);
    await db.query('COMMIT');
    return r;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};
const asService = (sql: string, params: unknown[] = []) =>
  tx(`SELECT set_config('app.is_service_account','on',true)`, sql, params);
const asTenant = (tenantId: string, sql: string, params: unknown[] = []) =>
  tx(`SELECT set_config('app.tenant_id','${tenantId}',true)`, sql, params);

beforeAll(async () => {
  seedLib = await load('client-seed-lib.mjs');
  auditorLib = await load('auditor-lib.mjs');
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS client_seed_test');
  await admin.query('CREATE DATABASE client_seed_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/client_seed_test';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await applyMigrations(db);
  await db.query('SET ROLE auditai_app');
});

afterAll(async () => {
  await db?.end();
  await admin?.query('DROP DATABASE IF EXISTS client_seed_test');
  await admin?.end();
});

describe('seed:client', () => {
  it('refuses without explicit names or with an unknown owner', async () => {
    await expect(seedLib.seedClient(db, { ...OPTS, tenantName: '' })).rejects.toThrow(
      /--tenant-name/,
    );
    await expect(seedLib.seedClient(db, { ...OPTS, ownerEmail: undefined })).rejects.toThrow(
      /--owner-email/,
    );
    await expect(
      seedLib.seedClient(db, { ...OPTS, ownerEmail: 'nobody@synthetic.invalid' }),
    ).rejects.toThrow(/no user/);
    const { rows } = await asService(`SELECT count(*)::int AS n FROM tenants`);
    expect(rows[0].n).toBe(2);
  });

  it('creates tenant, engagement, team, referent and owner memberships', async () => {
    const out = await seedLib.seedClient(db, OPTS);
    seeded = out;
    expect(out.created).toEqual(
      expect.arrayContaining([
        'tenant',
        'engagement',
        'team',
        'referent',
        'referent membership',
        'owner auditor membership',
        'owner platform_owner membership',
      ]),
    );
    const t = (await asService(`SELECT * FROM tenants WHERE id = $1`, [out.tenantId])).rows[0];
    expect(t.slug).toBe('synthetique-client-d');
    expect(t.display_name).toBe(OPTS.tenantName);
    const e = (
      await asService(
        `SELECT e.status, e.locale, tp.name FROM engagements e JOIN templates tp ON tp.id = e.template_id
          WHERE e.id = $1`,
        [out.engagementId],
      )
    ).rows[0];
    expect(e).toEqual({ status: 'draft', locale: 'fr', name: OPTS.engagementName });
    const items = await asService(
      `SELECT count(*)::int AS n FROM question_items WHERE tenant_id = $1`,
      [out.tenantId],
    );
    expect(items.rows[0].n).toBe(6);
    const owner = await asService(
      `SELECT role FROM memberships WHERE user_id = $1 AND tenant_id = $2 ORDER BY role`,
      [SYNTHETIC_A, out.tenantId],
    );
    expect(owner.rows.map((r) => r.role)).toEqual(['auditor', 'platform_owner']);
  });

  it('gives the referent a placeholder .invalid address and no password', async () => {
    const u = (await asService(`SELECT * FROM users WHERE id = $1`, [seeded.referentId])).rows[0];
    expect(u.display_name).toBeNull();
    expect(u.email).toBe('referent-1@synthetique-client-d.invalid');
    expect(u.password_hash).toBeNull();
    expect(u.email_hash).toBe(
      createHash('sha256').update('referent-1@synthetique-client-d.invalid').digest('hex'),
    );
    const m = await asService(`SELECT role, team_id FROM memberships WHERE user_id = $1`, [
      seeded.referentId,
    ]);
    expect(m.rows).toEqual([{ role: 'team_referent', team_id: seeded.teamId }]);
  });

  it('is idempotent: a second run creates nothing and writes no trail', async () => {
    const before = await asService(`SELECT count(*)::int AS n FROM audit_log`);
    const again = await seedLib.seedClient(db, OPTS);
    expect(again.created).toEqual([]);
    expect(again.tenantId).toBe(seeded.tenantId);
    expect(again.engagementId).toBe(seeded.engagementId);
    const after = await asService(`SELECT count(*)::int AS n FROM audit_log`);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('auditor:set-email moves the referent to a real address later', async () => {
    const real = 'demo-referent@example.test';
    await auditorLib.setUserEmail(db, {
      email: 'referent-1@synthetique-client-d.invalid',
      newEmail: real,
    });
    const u = (await asService(`SELECT email_hash FROM users WHERE id = $1`, [seeded.referentId]))
      .rows[0];
    expect(u.email_hash).toBe(createHash('sha256').update(real).digest('hex'));
    await expect(
      auditorLib.setUserEmail(db, { email: real, newEmail: OWNER_EMAIL }),
    ).rejects.toThrow(/already exists/);
  });
});

describe('migration 0019: view-as audit verbs', () => {
  it('accepts the view-as verbs with the real actor, rejects unknown ones', async () => {
    for (const action of ['view_as.start', 'view_as.stop', 'view_as.request', 'view_as.refused']) {
      await asTenant(
        seeded.tenantId,
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, $3, 'user', $4, '{}')`,
        [seeded.tenantId, SYNTHETIC_A, action, seeded.referentId],
      );
    }
    await expect(
      asTenant(
        seeded.tenantId,
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id)
         VALUES ($1, $2, 'view_as.impersonate', 'user', $3)`,
        [seeded.tenantId, SYNTHETIC_A, seeded.referentId],
      ),
    ).rejects.toThrow(/audit_log_action_check/);
  });

  it('a view-as trail row cannot be written into another tenant', async () => {
    await expect(
      asTenant(
        seeded.tenantId,
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id)
         VALUES ($1, $2, 'view_as.request', 'user', $3)`,
        [TENANT_A, SYNTHETIC_A, seeded.referentId],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('team space isolation (queries of apps/web/src/lib/clientData.ts)', () => {
  it('scoped to the client tenant, guessed ids of tenant A return nothing', async () => {
    const eng = await asTenant(
      seeded.tenantId,
      `SELECT e.id FROM engagements e
        WHERE e.tenant_id = $1 AND EXISTS (SELECT 1 FROM engagement_teams et
              WHERE et.engagement_id = e.id AND et.team_id = ANY($2::uuid[]))`,
      [TENANT_A, [TEAM_A]],
    );
    expect(eng.rows).toEqual([]);
    for (const [table, col, id] of [
      ['teams', 'id', TEAM_A],
      ['engagements', 'id', ENGAGEMENT_A],
      ['invitations', 'engagement_id', ENGAGEMENT_A],
      ['answers', 'tenant_id', TENANT_A],
      ['submissions', 'engagement_id', ENGAGEMENT_A],
      ['analyses', 'engagement_id', ENGAGEMENT_A],
      ['opportunities', 'engagement_id', ENGAGEMENT_A],
    ] as const) {
      const r = await asTenant(seeded.tenantId, `SELECT 1 FROM ${table} WHERE ${col} = $1`, [id]);
      expect(r.rows, table).toEqual([]);
    }
  });

  it('its own engagement and team are visible under its own tenant only', async () => {
    const own = await asTenant(
      seeded.tenantId,
      `SELECT t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2 AND et.team_id = ANY($3::uuid[])`,
      [seeded.tenantId, seeded.engagementId, [seeded.teamId]],
    );
    expect(own.rows).toEqual([{ name: OPTS.teamName }]);
    const fromA = await asTenant(TENANT_A, `SELECT 1 FROM teams WHERE id = $1`, [seeded.teamId]);
    expect(fromA.rows).toEqual([]);
  });
});
