import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyMigrations, connect } from './db.js';

/**
 * Auditor account tooling and the credential cleanup of migration 0017 (TASK-K, ADR 0032).
 * Own database so it cannot race the isolation suite. Runs as `auditai_app` so row-level
 * security is in force, like the app (the CLI itself connects as the owner and sets the flag).
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
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const SYNTHETIC_A = '99999999-9999-4999-8999-999999999999';
const STRONG = 'correct horse battery staple';

let admin: pg.Client;
let db: pg.Client;
let lib: any; // eslint-disable-line @typescript-eslint/no-explicit-any
let seed: any; // eslint-disable-line @typescript-eslint/no-explicit-any

const asService = async (sql: string, params: unknown[] = []) => {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('app.is_service_account','on',true)`);
    const r = await db.query(sql, params);
    await db.query('COMMIT');
    return r;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

beforeAll(async () => {
  lib = await load('auditor-lib.mjs');
  seed = await load('seed-synthetic-auth.mjs');
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS auditor_test');
  await admin.query('CREATE DATABASE auditor_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/auditor_test';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await applyMigrations(db);
  await db.query('SET ROLE auditai_app');
});

afterAll(async () => {
  await db?.end();
  await admin?.query('DROP DATABASE IF EXISTS auditor_test');
  await admin?.end();
});

describe('migration 0017', () => {
  it('leaves no password on the seeded synthetic users', async () => {
    const { rows } = await asService(
      `SELECT count(*)::int AS n FROM users WHERE password_hash IS NOT NULL`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('seed-synthetic-auth restores them locally and refuses in production', async () => {
    await expect(seed.seedSyntheticAuth(db, { NODE_ENV: 'production' })).rejects.toThrow(
      /production/,
    );
    expect(
      (await asService(`SELECT password_hash FROM users WHERE id = $1`, [SYNTHETIC_A])).rows[0]
        .password_hash,
    ).toBeNull();
    await seed.seedSyntheticAuth(db, { NODE_ENV: 'test' });
    const { rows } = await asService(
      `SELECT count(*)::int AS n FROM users WHERE password_hash LIKE 'scrypt$%'`,
    );
    expect(rows[0].n).toBe(2);
    // Clear again so the later cases start from the production state.
    await asService(`UPDATE users SET password_hash = NULL`);
  });
});

describe('auditor:create', () => {
  it('creates a user with memberships, a scrypt hash and one audit row per tenant', async () => {
    const { id } = await lib.createAuditor(db, {
      email: 'New.Auditor@example.test',
      displayName: 'New Auditor',
      tenantIds: [TENANT_A, TENANT_B],
      password: STRONG,
    });
    const u = (await asService(`SELECT * FROM users WHERE id = $1`, [id])).rows[0];
    expect(u.email_hash).toBe(
      createHash('sha256').update('new.auditor@example.test').digest('hex'),
    );
    expect(u.password_hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(u.password_hash).not.toContain(STRONG);
    const m = await asService(
      `SELECT tenant_id, role FROM memberships WHERE user_id = $1 ORDER BY 1`,
      [id],
    );
    expect(m.rows).toEqual([
      { tenant_id: TENANT_A, role: 'auditor' },
      { tenant_id: TENANT_B, role: 'auditor' },
    ]);
    const a = await asService(
      `SELECT action, target_kind, payload_json FROM audit_log WHERE target_id = $1`,
      [id],
    );
    expect(a.rows).toHaveLength(2);
    expect(a.rows[0]).toMatchObject({ action: 'user.create', target_kind: 'user' });
    expect(JSON.stringify(a.rows)).not.toContain(STRONG);
  });

  it('refuses weak passwords, bad input and duplicates', async () => {
    const base = { email: 'weak@example.test', displayName: 'W', tenantIds: [TENANT_A] };
    await expect(lib.createAuditor(db, { ...base, password: 'short' })).rejects.toThrow(/12/);
    await expect(lib.createAuditor(db, { ...base, password: 'aaaaaaaaaaaaaaaa' })).rejects.toThrow(
      /repetitive/,
    );
    await expect(
      lib.createAuditor(db, { ...base, email: 'nope', password: STRONG }),
    ).rejects.toThrow(/email/);
    await expect(
      lib.createAuditor(db, { ...base, tenantIds: [], password: STRONG }),
    ).rejects.toThrow(/tenant/);
    await expect(
      lib.createAuditor(db, {
        ...base,
        tenantIds: ['33333333-3333-4333-8333-333333333333'],
        password: STRONG,
      }),
    ).rejects.toThrow(/unknown tenant/);
    await expect(
      lib.createAuditor(db, { ...base, email: 'new.auditor@example.test', password: STRONG }),
    ).rejects.toThrow(/already exists/);
  });
});

describe('auditor:set-password and auditor:disable', () => {
  it('changes the hash, then disabling clears it and is audited', async () => {
    const email = 'new.auditor@example.test';
    const before = (
      await asService(`SELECT password_hash FROM users WHERE email_hash = $1`, [
        lib.emailHash(email),
      ])
    ).rows[0].password_hash;
    await lib.setAuditorPassword(db, { email, password: 'another long passphrase' });
    const after = (
      await asService(`SELECT password_hash FROM users WHERE email_hash = $1`, [
        lib.emailHash(email),
      ])
    ).rows[0].password_hash;
    expect(after).not.toBe(before);
    await expect(lib.setAuditorPassword(db, { email, password: 'short' })).rejects.toThrow(/12/);
    await expect(
      lib.setAuditorPassword(db, { email: 'ghost@example.test', password: STRONG }),
    ).rejects.toThrow(/no such user/);

    await lib.disableAuditor(db, { email });
    const u = (
      await asService(`SELECT password_hash, disabled_at FROM users WHERE email_hash = $1`, [
        lib.emailHash(email),
      ])
    ).rows[0];
    expect(u.password_hash).toBeNull();
    expect(u.disabled_at).not.toBeNull();
    const actions = (
      await asService(`SELECT DISTINCT action FROM audit_log WHERE target_kind = 'user' ORDER BY 1`)
    ).rows.map((r) => r.action);
    expect(actions).toEqual(['user.create', 'user.disable', 'user.set_password']);
  });
});

describe('target database guard', () => {
  it('prefers the unpooled URL and refuses mismatched hosts', () => {
    const pooled = 'postgres://u:p@ep-abc-pooler.region.example.test/db';
    const direct = 'postgres://u:p@ep-abc.region.example.test/db';
    expect(lib.resolveTargetUrl({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct })).toBe(
      direct,
    );
    expect(() =>
      lib.resolveTargetUrl({
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: 'postgres://u:p@other.example.test/db',
      }),
    ).toThrow(/different hosts/);
    expect(() => lib.resolveTargetUrl({}, undefined)).toThrow(/not set/);
    expect(() => lib.resolveTargetUrl({ DATABASE_URL: direct }, 'elsewhere.example.test')).toThrow(
      /--expect-host/,
    );
    expect(lib.resolveTargetUrl({ DATABASE_URL: direct }, 'ep-abc.region.example.test')).toBe(
      direct,
    );
  });
});
