import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-U (ADR 0039): forgot-password gives the same answer for every address and is rate limited;
 * set-password lands a referent on /client and staff on /board; the owner's invite is audited by
 * the data layer and never touches another organisation.
 */
const s = vi.hoisted(() => ({
  limited: false,
  known: false,
  lookups: 0,
  issued: 0,
  sent: [] as { to: string; text: string }[],
  audits: [] as string[],
  memberships: [] as { id: string; role: string; teamId?: string }[],
  cookieSet: [] as string[],
}));

vi.mock('next/headers', () => ({
  headers: () =>
    new Headers({
      host: 'app.example.test',
      'x-forwarded-for': '203.0.113.9',
      'accept-language': 'en',
    }),
  cookies: () => ({
    get: () => undefined,
    set: (name: string) => {
      s.cookieSet.push(name);
    },
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock('@/lib/publicThrottle', () => ({ hitPublicLimit: async () => s.limited }));
vi.mock('@/lib/db', () => ({
  withServiceAccount: async (fn: (c: unknown) => unknown) =>
    fn({
      query: async () => {
        s.lookups += 1;
        return { rows: s.known ? [{ id: 'u1' }] : [] };
      },
    }),
}));
vi.mock('@/lib/authTokens', () => ({
  issueToken: async () => {
    s.issued += 1;
    return { token: 'T'.repeat(43), expiresAt: new Date() };
  },
  setPasswordWithToken: async () => ({
    ok: true,
    userId: 'u1',
    kind: 'invite',
    displayName: 'Demo Referent',
  }),
}));
vi.mock('@/lib/authAudit', () => ({
  auditSelf: async (_u: string, action: string) => {
    s.audits.push(action);
  },
}));
vi.mock('@/lib/authProvider', async (orig) => ({
  ...(await orig<typeof import('@/lib/authProvider')>()),
  loadMemberships: async () => s.memberships,
}));
vi.mock('@/lib/emailProvider', () => ({
  resolveEmailProvider: () => ({
    name: 'mock',
    send: async (m: { to: string; text: string }) => {
      s.sent.push(m);
    },
  }),
}));

const fd = (o: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  Object.assign(s, {
    limited: false,
    known: false,
    lookups: 0,
    issued: 0,
    sent: [],
    audits: [],
    memberships: [],
    cookieSet: [],
  });
});

describe('forgot password', () => {
  it('answers the same for a known and an unknown address', async () => {
    const { forgotPasswordAction } = await import('@/app/forgot-password/actions');
    s.known = true;
    const known = await forgotPasswordAction(
      { ok: false, message: '' },
      fd({ email: 'a@example.test' }),
    );
    expect(s.issued).toBe(1);
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]?.text).toContain('/set-password?token=');
    s.known = false;
    s.issued = 0;
    s.sent = [];
    const unknown = await forgotPasswordAction(
      { ok: false, message: '' },
      fd({ email: 'b@example.test' }),
    );
    expect(unknown).toEqual(known);
    expect(known.ok).toBe(true);
    expect(s.issued).toBe(0);
    expect(s.sent).toHaveLength(0);
  });

  it('answers the same when rate limited and does not even look the address up', async () => {
    const { forgotPasswordAction } = await import('@/app/forgot-password/actions');
    s.known = true;
    const normal = await forgotPasswordAction(
      { ok: false, message: '' },
      fd({ email: 'a@example.test' }),
    );
    s.issued = 0;
    s.lookups = 0;
    s.limited = true;
    const limited = await forgotPasswordAction(
      { ok: false, message: '' },
      fd({ email: 'a@example.test' }),
    );
    expect(limited).toEqual(normal);
    expect(s.lookups).toBe(0);
    expect(s.issued).toBe(0);
  });

  it('writes no token to the audit trail', async () => {
    const { forgotPasswordAction } = await import('@/app/forgot-password/actions');
    s.known = true;
    await forgotPasswordAction({ ok: false, message: '' }, fd({ email: 'a@example.test' }));
    expect(s.audits).toEqual(['password.reset_request']);
  });
});

describe('set password landing', () => {
  const run = (rest: Record<string, string> = {}) =>
    import('@/app/set-password/actions').then((m) =>
      m.setPasswordAction(
        { message: '' },
        fd({
          token: 'T'.repeat(43),
          password: 'a-long-enough-password',
          again: 'a-long-enough-password',
          ...rest,
        }),
      ),
    );

  it('sends a team referent to /client, never to the admin', async () => {
    s.memberships = [{ id: 't1', role: 'team_referent', teamId: 'team1' }];
    await expect(run()).rejects.toThrow('redirect:/client');
    expect(s.cookieSet).toEqual(['evolai_session']);
    expect(s.audits).toEqual(['password.set']);
  });

  it('sends staff to the portfolio', async () => {
    s.memberships = [{ id: 't1', role: 'auditor' }];
    await expect(run()).rejects.toThrow('redirect:/board');
  });

  it('signs nobody in without a surface to land on', async () => {
    s.memberships = [{ id: 't1', role: 'employee_respondent' }];
    const r = await run();
    expect(r.dead).toBe(true);
    expect(s.cookieSet).toEqual([]);
  });
});
