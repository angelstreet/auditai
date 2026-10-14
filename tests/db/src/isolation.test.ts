import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { applyMigrations, connect, resetDatabase, withServiceAccount, withTenant } from './db.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEPT_A = 'a1111111-1111-4111-8111-111111111111';
const DEPT_B = 'b1111111-1111-4111-8111-111111111111';
const TEAM_A = 'a2222222-2222-4222-8222-222222222222';
const TEAM_B = 'b2222222-2222-4222-8222-222222222222';
const TPL_A = 'a3333333-3333-4333-8333-333333333333';
const TPL_B = 'b3333333-3333-4333-8333-333333333333';
const VER_A = 'a4444444-4444-4444-8444-444444444444';
const VER_B = 'b4444444-4444-4444-8444-444444444444';
const ENG_A = 'a5555555-5555-4555-8555-555555555555';
const ENG_B = 'b5555555-5555-4555-8555-555555555555';
const INV_A = 'a6666666-6666-4666-8666-666666666666';
const INV_B = 'b6666666-6666-4666-8666-666666666666';

const TABLES = [
  'organisations',
  'departments',
  'teams',
  'templates',
  'questionnaire_versions',
  'engagements',
  'invitations',
] as const;

let pgClient: pg.Client;

beforeAll(async () => {
  pgClient = connect();
  await pgClient.connect();
  await resetDatabase(pgClient);
  await applyMigrations(pgClient);
  // The bootstrap user is a superuser and therefore bypasses RLS. Switch to the
  // non-superuser application role (created by migration 0004) so the tests genuinely exercise
  // the row-level security policies.
  await pgClient.query('SET ROLE auditai_app');
});

afterAll(async () => {
  await pgClient.end();
});

describe('tenant isolation (PRD \u00a716, \u00a725.1, \u00a733)', () => {
  it('seeds both tenants and both sets of rows exist as a service account', async () => {
    await withServiceAccount(pgClient, async () => {
      const { rows } = await pgClient.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM tenants',
      );
      expect(Number(rows[0]?.count)).toBe(2);
      const orgs = await pgClient.query<{ id: string }>('SELECT id FROM organisations ORDER BY id');
      expect(orgs.rows.map((r) => r.id)).toEqual([ORG_A, ORG_B]);
    });
  });

  describe('SELECT is filtered by app.tenant_id', () => {
    for (const table of TABLES) {
      it(`tenant A only sees tenant A rows in ${table}`, async () => {
        await withTenant(pgClient, TENANT_A, async () => {
          const { rows } = await pgClient.query<{ id: string }>(
            `SELECT id FROM ${table} ORDER BY id`,
          );
          const ids = rows.map((r) => r.id);
          for (const id of ids) {
            expect(id.startsWith('a')).toBe(true);
          }
          expect(ids.length).toBeGreaterThan(0);
        });
      });

      it(`tenant B only sees tenant B rows in ${table}`, async () => {
        await withTenant(pgClient, TENANT_B, async () => {
          const { rows } = await pgClient.query<{ id: string }>(
            `SELECT id FROM ${table} ORDER BY id`,
          );
          const ids = rows.map((r) => r.id);
          for (const id of ids) {
            expect(id.startsWith('b')).toBe(true);
          }
          expect(ids.length).toBeGreaterThan(0);
        });
      });
    }
  });

  it('UPDATE of a row belonging to another tenant reports zero rows affected', async () => {
    await withTenant(pgClient, TENANT_A, async () => {
      const { rowCount } = await pgClient.query(`UPDATE teams SET name = 'hacked' WHERE id = $1`, [
        TEAM_B,
      ]);
      expect(rowCount).toBe(0);
    });
    await withServiceAccount(pgClient, async () => {
      const { rows } = await pgClient.query<{ name: string }>(
        `SELECT name FROM teams WHERE id = $1`,
        [TEAM_B],
      );
      expect(rows[0]?.name).toBe('Synthetic team B');
    });
  });

  it('DELETE of a row belonging to another tenant reports zero rows affected', async () => {
    await withTenant(pgClient, TENANT_A, async () => {
      const { rowCount } = await pgClient.query(`DELETE FROM invitations WHERE id = $1`, [INV_B]);
      expect(rowCount).toBe(0);
    });
    await withServiceAccount(pgClient, async () => {
      const { rows } = await pgClient.query<{ id: string }>(
        `SELECT id FROM invitations WHERE id = $1`,
        [INV_B],
      );
      expect(rows[0]?.id).toBe(INV_B);
    });
  });

  it('INSERT with the wrong tenant_id is rejected by the WITH CHECK policy', async () => {
    await withTenant(pgClient, TENANT_A, async () => {
      await expect(
        pgClient.query(
          `INSERT INTO organisations (id, tenant_id, legal_name, country) VALUES
             ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, 'Cross-tenant probe', 'FR')`,
          [TENANT_B],
        ),
      ).rejects.toThrow(/row-level security|policy/i);
    });
    await withServiceAccount(pgClient, async () => {
      const { rows } = await pgClient.query<{ id: string }>(
        `SELECT id FROM organisations WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'`,
      );
      expect(rows).toHaveLength(0);
    });
  });

  it('fails closed when no app.tenant_id is set', async () => {
    // No withTenant call \u2014 the application forgot to set the variable.
    await pgClient.query('BEGIN');
    try {
      for (const table of TABLES) {
        const { rows } = await pgClient.query(`SELECT id FROM ${table}`);
        expect(rows).toHaveLength(0);
      }
    } finally {
      await pgClient.query('ROLLBACK');
    }
  });

  it('engagements are filtered as well as the join table engagement_teams', async () => {
    await withTenant(pgClient, TENANT_A, async () => {
      const { rows } = await pgClient.query<{ engagement_id: string; team_id: string }>(
        'SELECT engagement_id, team_id FROM engagement_teams ORDER BY team_id',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.engagement_id).toBe(ENG_A);
      expect(rows[0]?.team_id).toBe(TEAM_A);
    });
  });
});
