import { beforeEach, describe, expect, it, vi } from 'vitest';

/** TASK-U (ADR 0040): the owner can only invite a referent of the organisation being worked on. */
const s = vi.hoisted(() => ({
  referentOf: new Set<string>(),
  taken: false,
  log: [] as { sql: string; params: unknown[] }[],
}));
vi.mock('@/lib/db', () => ({
  withTenant: async () => [],
  withServiceAccount: async (fn: (c: unknown) => unknown) =>
    fn({
      query: async (sql: string, params: unknown[]) => {
        s.log.push({ sql, params });
        if (/FROM memberships m JOIN users u/.test(sql)) {
          const key = `${params[0]}:${params[1]}`;
          return { rows: s.referentOf.has(key) ? [{ team_id: 'team', disabled: false }] : [] };
        }
        if (/SELECT 1 FROM users WHERE email_hash/.test(sql)) {
          return { rows: s.taken ? [{}] : [] };
        }
        return { rows: [], rowCount: 1 };
      },
    }),
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const U = '77777777-7777-4777-8777-777777777777';
const ACTOR = '99999999-9999-4999-8999-999999999999';

beforeEach(() => {
  s.referentOf = new Set([`${A}:${U}`]);
  s.taken = false;
  s.log = [];
});

describe('inviteReferent', () => {
  it('refuses a user who is not a referent of this organisation, and issues nothing', async () => {
    const { inviteReferent } = await import('./referentData');
    const r = await inviteReferent(B as never, ACTOR as never, U, null);
    expect(r).toEqual({ ok: false, reason: 'not_referent' });
    expect(s.log.some((q) => /auth_tokens|audit_log/.test(q.sql))).toBe(false);
  });

  it('refuses an address another account already uses and changes nothing', async () => {
    s.taken = true;
    const { inviteReferent } = await import('./referentData');
    const r = await inviteReferent(A as never, ACTOR as never, U, 'new@example.test');
    expect(r).toEqual({ ok: false, reason: 'taken' });
    expect(s.log.some((q) => /UPDATE users/.test(q.sql))).toBe(false);
  });

  it('creates the link, hashes the address, and audits without it', async () => {
    const { inviteReferent } = await import('./referentData');
    const r = await inviteReferent(A as never, ACTOR as never, U, 'new@example.test');
    expect(r.ok && r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const update = s.log.find((q) => /UPDATE users SET email_hash/.test(q.sql));
    expect(update?.params[1]).toMatch(/^[0-9a-f]{64}$/);
    const audit = s.log.find((q) => /INSERT INTO audit_log/.test(q.sql));
    expect(audit?.params[1]).toBe(ACTOR);
    expect(JSON.stringify(audit?.params)).not.toContain('new@example.test');
    expect(JSON.stringify(s.log)).not.toContain(r.ok ? r.token : 'x');
  });
});
