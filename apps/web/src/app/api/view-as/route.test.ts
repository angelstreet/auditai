import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * TASK-P (ADR 0035): who may start a view-as. Real signing and verification; the database is a
 * stub that only knows one persona, in the owner's tenant.
 */
const state = vi.hoisted(() => ({
  cookie: '' as string,
  sql: [] as { sql: string; params: unknown[] }[],
}));

const T = '33333333-3333-4333-8333-333333333333';
const OTHER = '11111111-1111-4111-8111-111111111111';
const MEMBERSHIP = '88888888-8888-4888-8888-888888888888';
const PERSONA_ROW = {
  id: MEMBERSHIP,
  role: 'team_referent',
  tenant_id: T,
  team_id: '55555555-5555-4555-8555-555555555555',
  user_id: '66666666-6666-4666-8666-666666666666',
  email: 'synthetic-referent@synthetic.invalid',
  tenant_label: 'Synthetic client C',
  team_label: 'Synthetic pilot team',
};

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'evolai_session' && state.cookie ? { value: state.cookie } : undefined,
  }),
  headers: () => new Headers(),
}));
vi.mock('@/lib/db', () => {
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      state.sql.push({ sql, params });
      if (/FROM memberships m/.test(sql)) {
        const owned = params[1] as string[];
        const id = params[2];
        const rows = [PERSONA_ROW].filter(
          (r) => owned.includes(r.tenant_id) && (id === undefined || r.id === id),
        );
        return { rows };
      }
      return { rows: [] };
    },
  };
  return {
    withTenant: async (_t: string, fn: (c: typeof client) => unknown) => fn(client),
    withServiceAccount: async (fn: (c: typeof client) => unknown) => fn(client),
  };
});

const { POST } = await import('./route');
const { newSessionPayload, signSession, verifySession, withViewAs } = await import('@/lib/session');

const post = (persona: string | null, headers: Record<string, string> = {}) => {
  const body = new FormData();
  if (persona !== null) body.set('persona', persona);
  return POST(new NextRequest('http://x/api/view-as', { method: 'POST', body, headers }));
};
const as = async (tenants: { id: string; role: string; teamId?: string }[], viewAs?: object) => {
  const s = newSessionPayload({ id: '77777777-7777-4777-8777-777777777777', name: 'U' }, tenants);
  state.cookie = await signSession(viewAs ? withViewAs(s, viewAs as never) : s);
  return s;
};
const setCookie = (res: Response) =>
  /evolai_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];

beforeEach(() => {
  state.cookie = '';
  state.sql = [];
});

describe('POST /api/view-as', () => {
  it('without a session: back to sign-in, no cookie', async () => {
    const res = await post(MEMBERSHIP);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login');
    expect(setCookie(res)).toBeUndefined();
  });

  it('an auditor (not owner) posting a valid persona id is refused', async () => {
    await as([{ id: T, role: 'auditor' }]);
    const res = await post(MEMBERSHIP);
    expect(res.status).toBe(403);
    expect(setCookie(res)).toBeUndefined();
    expect(state.sql).toEqual([]);
  });

  it('a referent posting a persona id is refused', async () => {
    await as([{ id: T, role: 'team_referent', teamId: PERSONA_ROW.team_id }]);
    expect((await post(MEMBERSHIP)).status).toBe(403);
  });

  it('an owner of another tenant cannot reach a persona outside it (forged field)', async () => {
    await as([{ id: OTHER, role: 'platform_owner' }]);
    const res = await post(MEMBERSHIP);
    expect(res.status).toBe(403);
    // The query was scoped to the session's owned tenants only.
    expect(state.sql[0]?.params[1]).toEqual([OTHER]);
  });

  it('garbage or missing persona values are refused', async () => {
    await as([{ id: T, role: 'platform_owner' }]);
    for (const v of ['', 'not-a-uuid', "' OR 1=1 --", null]) {
      expect((await post(v)).status).toBe(403);
    }
  });

  it('cross-site posts are refused', async () => {
    await as([{ id: T, role: 'platform_owner' }]);
    expect((await post(MEMBERSHIP, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });

  it('an owner starts a view-as: signed cookie, trail row, team space', async () => {
    const s = await as([
      { id: T, role: 'auditor' },
      { id: T, role: 'platform_owner' },
    ]);
    const res = await post(MEMBERSHIP);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/client');
    const verified = await verifySession(setCookie(res));
    expect(verified?.viewAs).toMatchObject({ tenantId: T, label: 'synthetic-referent' });
    expect(verified?.exp).toBe(s.exp);
    const trail = state.sql.find((q) => /INSERT INTO audit_log/.test(q.sql));
    expect(trail?.params).toEqual(
      expect.arrayContaining([T, s.sub, 'view_as.start', PERSONA_ROW.user_id]),
    );
  });

  it('no nested switch while already viewing as', async () => {
    const owner = [{ id: T, role: 'platform_owner' }];
    await as(owner);
    const started = setCookie(await post(MEMBERSHIP)) as string;
    state.cookie = started;
    expect((await post(MEMBERSHIP)).status).toBe(403);
  });

  it('"self" restores the owner view and trails the stop', async () => {
    const owner = [{ id: T, role: 'platform_owner' }];
    await as(owner);
    state.cookie = setCookie(await post(MEMBERSHIP)) as string;
    state.sql = [];
    const res = await post('self');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin/engagements');
    const verified = await verifySession(setCookie(res));
    expect(verified?.viewAs).toBeUndefined();
    expect(state.sql.some((q) => q.params.includes('view_as.stop'))).toBe(true);
  });
});
