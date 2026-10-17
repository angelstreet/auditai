import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { runRetentionWorker, SYSTEM_ACTOR } from './retentionWorker.js';

const fakeClient = (): { client: pg.Client; calls: { sql: string; params?: unknown[] }[] } => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/FROM tenants/.test(sql)) return { rows: [{ id: 't1' }, { id: 't2' }] };
      if (/FROM respondent_badges/.test(sql)) {
        return { rows: params?.[0] === 't1' ? [{ respondent_pseudonym: 'p-aaaaaaaa' }] : [] };
      }
      return { rows: [] };
    },
  } as unknown as pg.Client;
  return { client, calls };
};

describe('retention worker (M15, FR-09)', () => {
  it('erases due pseudonyms through the shared SQL function, one transaction per tenant', async () => {
    const { client, calls } = fakeClient();
    const r = await runRetentionWorker({ client });
    expect(r).toEqual({ tenantsScanned: 2, purged: 1 });
    const erase = calls.filter((c) => /erase_respondent_pseudonym/.test(c.sql));
    expect(erase).toHaveLength(1);
    expect(erase[0]?.params).toEqual(['t1', 'p-aaaaaaaa', SYSTEM_ACTOR]);
    expect(erase[0]?.sql).toContain("'retention_expired'");
    const sqls = calls.map((c) => c.sql);
    expect(sqls.filter((s) => s === 'BEGIN')).toHaveLength(3);
    expect(sqls.filter((s) => s === 'COMMIT')).toHaveLength(3);
  });

  it('rolls back and rethrows when the erase fails', async () => {
    const calls: string[] = [];
    const client = {
      query: async (sql: string) => {
        calls.push(sql);
        if (/FROM tenants/.test(sql)) return { rows: [{ id: 't1' }] };
        if (/FROM respondent_badges/.test(sql))
          return { rows: [{ respondent_pseudonym: 'p-aaaaaaaa' }] };
        if (/erase_respondent_pseudonym/.test(sql)) throw new Error('boom');
        return { rows: [] };
      },
    } as unknown as pg.Client;
    await expect(runRetentionWorker({ client })).rejects.toThrow('boom');
    expect(calls).toContain('ROLLBACK');
  });
});
