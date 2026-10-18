import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { applyMigrations, connect, withServiceAccount, withTenant } from './db.js';

/**
 * FR-03 (TASK-N, ADR 0033): tenant isolation for the new table and columns, and the privacy
 * assertions that default mode stores no names or addresses.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const INV_A = 'a6666666-6666-4666-8666-666666666666';
const INV_B = 'b6666666-6666-4666-8666-666666666666';
const ENG_A = 'a5555555-4555-4555-8555-555555555555';
const AUDITOR = '99999999-9999-4999-8999-999999999999';

let client: pg.Client;

let admin: pg.Client;

beforeAll(async () => {
  // Own database so this suite cannot race the isolation suite, which resets the shared one.
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS invitations_test');
  await admin.query('CREATE DATABASE invitations_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/invitations_test';
  client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await applyMigrations(client);
  await client.query('SET ROLE auditai_app');
  await withServiceAccount(client, async () => {
    for (const [inv, tenant] of [
      [INV_A, TENANT_A],
      [INV_B, TENANT_B],
    ] as const) {
      await client.query(
        `INSERT INTO invitation_deliveries (invitation_id, tenant_id, address_cipher, purge_after)
         VALUES ($1, $2, 'ciphertext-not-an-address', now() + interval '1 day')`,
        [inv, tenant],
      );
    }
  });
});

afterAll(async () => {
  await client.end();
  await admin.end();
});

describe('invitation_deliveries isolation', () => {
  it('a tenant-scoped session cannot read any delivery row, not even its own tenant', async () => {
    for (const tenant of [TENANT_A, TENANT_B]) {
      const rows = await withTenant(
        client,
        tenant,
        async () => (await client.query('SELECT invitation_id FROM invitation_deliveries')).rows,
      );
      expect(rows).toHaveLength(0);
    }
  });

  it('a tenant-scoped session cannot write or delete delivery rows', async () => {
    await expect(
      withTenant(client, TENANT_A, async () =>
        client.query(
          `INSERT INTO invitation_deliveries (invitation_id, tenant_id, address_cipher, purge_after)
           VALUES ($1, $2, 'x', now())`,
          [INV_A, TENANT_A],
        ),
      ),
    ).rejects.toThrow();
    const deleted = await withTenant(client, TENANT_A, async () =>
      client.query('DELETE FROM invitation_deliveries'),
    );
    expect(deleted.rowCount).toBe(0);
  });

  it('the service account sees both and deleting an invitation cascades to its address', async () => {
    const n = await withServiceAccount(client, async () =>
      Number(
        (await client.query('SELECT COUNT(*)::int AS n FROM invitation_deliveries')).rows[0].n,
      ),
    );
    expect(n).toBe(2);
    await withServiceAccount(client, async () => {
      await client.query('DELETE FROM invitations WHERE id = $1', [INV_B]);
    });
    const left = await withServiceAccount(client, async () =>
      (await client.query('SELECT invitation_id FROM invitation_deliveries')).rows.map(
        (r) => r.invitation_id,
      ),
    );
    expect(left).toEqual([INV_A]);
  });
});

describe('invitations: new columns obey tenant isolation', () => {
  it('tenant B cannot update, revoke or read tenant A invitations', async () => {
    const seen = await withTenant(
      client,
      TENANT_B,
      async () => (await client.query('SELECT id FROM invitations WHERE id = $1', [INV_A])).rows,
    );
    expect(seen).toHaveLength(0);
    const updated = await withTenant(client, TENANT_B, async () =>
      client.query(
        `UPDATE invitations SET status = 'revoked', revoked_at = now(), reminder_count = 1
          WHERE id = $1`,
        [INV_A],
      ),
    );
    expect(updated.rowCount).toBe(0);
  });

  it('tenant A cannot insert an invitation for tenant B', async () => {
    await expect(
      withTenant(client, TENANT_A, async () =>
        client.query(
          `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym,
                                    status, token_reference, token_signature, opens_at, expires_at)
           SELECT gen_random_uuid(), $1, engagement_id, team_id, 'p-cross-tenant-01', 'pending',
                  'iCrossTenantReference0000000000', 'sig', now(), now() + interval '1 day'
             FROM invitations WHERE id = $2`,
          [TENANT_B, INV_A],
        ),
      ),
    ).rejects.toThrow();
  });

  it('token references are unique', async () => {
    await expect(
      withTenant(client, TENANT_A, async () =>
        client.query(
          `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym,
                                    status, token_reference, token_signature, opens_at, expires_at)
           SELECT gen_random_uuid(), tenant_id, engagement_id, team_id, 'p-duplicate-ref-01', 'pending',
                  token_reference, 'sig', now(), now() + interval '1 day'
             FROM invitations WHERE id = $1`,
          [INV_A],
        ),
      ),
    ).rejects.toThrow();
  });

  it('the audit trail accepts the new actions and stays append-only', async () => {
    await withTenant(client, TENANT_A, async () => {
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, 'invitation.create_batch', 'engagement', $3, '{"count":3}')`,
        [TENANT_A, AUDITOR, ENG_A],
      );
    });
    await expect(
      withTenant(client, TENANT_A, async () =>
        client.query(
          `UPDATE audit_log SET payload_json = '{}' WHERE action = 'invitation.create_batch'`,
        ),
      ),
    ).resolves.toMatchObject({ rowCount: 0 });
  });
});

describe('no personal data in default mode (PRD §15, §25.1)', () => {
  it('the invitation, respondent and submission tables have no name, email or phone column', async () => {
    const { rows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('invitations','respondents','submissions','answers')`,
    );
    const offenders = rows.filter((r) =>
      /mail|name|phone|address|firstname|lastname/i.test(r.column_name),
    );
    expect(offenders).toEqual([]);
  });

  it('the only column that can hold an address is the encrypted one, in the opt-in table', async () => {
    const { rows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ~* '(mail|address)'
          AND table_name NOT IN ('users')`,
    );
    expect(rows).toEqual([{ table_name: 'invitation_deliveries', column_name: 'address_cipher' }]);
  });

  it('no seeded invitation or respondent value looks like an email address', async () => {
    const { rows } = await withServiceAccount(client, async () =>
      client.query(
        `SELECT respondent_pseudonym, token_reference FROM invitations
          WHERE respondent_pseudonym ~ '@' OR token_reference ~ '@'`,
      ),
    );
    expect(rows).toEqual([]);
  });
});
