import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { applyMigrations, connect, withServiceAccount, withTenant } from './db.js';

/**
 * TASK-U (ADR 0039): tables behind referent login, public rate limits and privacy requests.
 * Tokens and counters are service-account only; privacy requests are tenant scoped and can only be
 * created by the public form's service account; the trail accepts the new verbs and nothing else.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const AUDITOR = '99999999-9999-4999-8999-999999999999';

let client: pg.Client;
let admin: pg.Client;

beforeAll(async () => {
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS referent_login_test');
  await admin.query('CREATE DATABASE referent_login_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/referent_login_test';
  client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await applyMigrations(client);
  await client.query('SET ROLE auditai_app');
  await withServiceAccount(client, async () => {
    for (const tenant of [TENANT_A, TENANT_B]) {
      await client.query(
        `INSERT INTO privacy_requests (tenant_id, kind, respondent_code, reply_to)
         VALUES ($1, 'erase', 'demo-code-0001', 'reply@example.test')`,
        [tenant],
      );
    }
    await client.query(
      `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
       VALUES ($1, 'invite', 'hash-not-a-token', now() + interval '1 hour')`,
      [AUDITOR],
    );
    await client.query(
      `INSERT INTO public_attempts (kind, scope, key_hash) VALUES ('forgot_password', 'ip', 'k')`,
    );
  });
});

afterAll(async () => {
  await client.end();
  await admin.end();
});

describe('tokens and counters are invisible to a tenant session', () => {
  it('reads nothing from auth_tokens or public_attempts', async () => {
    for (const table of ['auth_tokens', 'public_attempts']) {
      const rows = await withTenant(
        client,
        TENANT_A,
        async () => (await client.query(`SELECT * FROM ${table}`)).rows,
      );
      expect(rows, table).toHaveLength(0);
    }
  });
  it('cannot write them either', async () => {
    await expect(
      withTenant(client, TENANT_A, async () =>
        client.query(
          `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
           VALUES ($1, 'reset', 'x', now())`,
          [AUDITOR],
        ),
      ),
    ).rejects.toThrow();
  });
  it('a token hash is unique, so a replayed insert cannot shadow a live link', async () => {
    await expect(
      withServiceAccount(client, async () =>
        client.query(
          `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
           VALUES ($1, 'reset', 'hash-not-a-token', now())`,
          [AUDITOR],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe('privacy_requests isolation', () => {
  it('each organisation sees only its own requests', async () => {
    for (const tenant of [TENANT_A, TENANT_B]) {
      const rows = await withTenant(
        client,
        tenant,
        async () => (await client.query('SELECT tenant_id FROM privacy_requests')).rows,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_id).toBe(tenant);
    }
  });
  it('a tenant session cannot create a request, only the public form can', async () => {
    await expect(
      withTenant(client, TENANT_A, async () =>
        client.query(`INSERT INTO privacy_requests (tenant_id, kind) VALUES ($1, 'question')`, [
          TENANT_A,
        ]),
      ),
    ).rejects.toThrow();
  });
  it('handling one request cannot touch another organisation and clears the reply address', async () => {
    const other = await withTenant(client, TENANT_B, async () =>
      client.query(`UPDATE privacy_requests SET status = 'handled' WHERE tenant_id = $1`, [
        TENANT_A,
      ]),
    );
    expect(other.rowCount).toBe(0);
    await withTenant(client, TENANT_A, async () =>
      client.query(
        `UPDATE privacy_requests SET status = 'handled', handled_at = now(), reply_to = NULL`,
      ),
    );
    const row = await withTenant(
      client,
      TENANT_A,
      async () => (await client.query('SELECT status, reply_to FROM privacy_requests')).rows[0],
    );
    expect(row).toEqual({ status: 'handled', reply_to: null });
  });
});

describe('audit trail verbs', () => {
  const insert = (action: string, kind = 'user') =>
    withTenant(client, TENANT_A, async () =>
      client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id)
         VALUES ($1, $2, $3, $4, $2)`,
        [TENANT_A, AUDITOR, action, kind],
      ),
    );
  it('accepts the new actions', async () => {
    for (const a of ['referent.invite', 'password.set', 'password.reset', 'privacy.update']) {
      await insert(a);
    }
    await insert('privacy_request.handle', 'privacy_request');
  });
  it('still refuses an invented one and keeps the older verbs', async () => {
    await expect(insert('made.up')).rejects.toThrow();
    await insert('view_as.start');
    await insert('team.create', 'team');
  });
});
