import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyMigrations, connect } from './db.js';

/** `pnpm identity:strip-names` (TASK-X, ADR 0044): dry run, apply, idempotence, no name in output. */
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
const REFERENT = 'b0000000-0000-4000-8000-0000000000b1';
const NAME = 'Demo Referent';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

let admin: pg.Client;
let db: pg.Client;
let lib: any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  lib = await load('identity-lib.mjs');
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS identity_test');
  await admin.query('CREATE DATABASE identity_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/identity_test';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await applyMigrations(db);
  await db.query('SET ROLE auditai_app');
  await db.query('BEGIN');
  await db.query(`SELECT set_config('app.is_service_account','on',true)`);
  const slug = (await db.query(`SELECT slug FROM tenants WHERE id = $1`, [TENANT_A])).rows[0].slug;
  await db.query(`INSERT INTO users (id, email_hash, display_name) VALUES ($1, $2, $3)`, [
    REFERENT,
    hash(`demo-referent@${slug}.invalid`),
    NAME,
  ]);
  await db.query(
    `INSERT INTO memberships (id, tenant_id, user_id, team_id, role)
     VALUES (gen_random_uuid(), $1, $2, $3, 'team_referent')`,
    [TENANT_A, REFERENT, TEAM_A],
  );
  await db.query('COMMIT');
});

afterAll(async () => {
  await db?.end();
  await admin?.query('DROP DATABASE IF EXISTS identity_test');
  await admin?.end();
});

const user = async () => {
  await db.query('BEGIN');
  await db.query(`SELECT set_config('app.is_service_account','on',true)`);
  const r = await db.query(`SELECT * FROM users WHERE id = $1`, [REFERENT]);
  await db.query('COMMIT');
  return r.rows[0];
};

describe('identity:strip-names', () => {
  it('dry run changes nothing', async () => {
    const r = await lib.stripIdentities(db, { apply: false });
    expect(r.applied).toBe(false);
    expect(r.addressesRewritten).toBe(1);
    expect((await user()).display_name).toBe(NAME);
  });

  it('apply clears names, rewrites the placeholder address and audits it', async () => {
    const r = await lib.stripIdentities(db, { apply: true });
    expect(r.addressesRewritten).toBe(1);
    expect(r.namesCleared).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toContain('Demo');
    const u = await user();
    expect(u.display_name).toBeNull();
    expect(u.email).toMatch(/^referent-1@.+\.invalid$/);
    expect(u.email_hash).toBe(hash(u.email));
    await db.query('BEGIN');
    await db.query(`SELECT set_config('app.is_service_account','on',true)`);
    const a = await db.query(
      `SELECT payload_json FROM audit_log WHERE target_id = $1 AND action = 'user.set_email'`,
      [REFERENT],
    );
    await db.query('COMMIT');
    expect(a.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.rows)).not.toContain('@');
  });

  it('is idempotent', async () => {
    const r = await lib.stripIdentities(db, { apply: true });
    expect(r).toEqual({ applied: true, namesCleared: 0, addressesRewritten: 0 });
  });
});
