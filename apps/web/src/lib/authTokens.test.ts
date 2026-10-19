import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-U (ADR 0039): set-password and reset tokens are hashed at rest, single use and expiring.
 * The in-memory client below answers the four statements the module issues, with the same
 * conditions as the SQL (unused, not expired, user not disabled), so reuse and expiry are real.
 */
interface Tok {
  user_id: string;
  kind: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}
const db = vi.hoisted(() => ({
  tokens: [] as Tok[],
  users: new Map<string, { password_hash: string | null; disabled: boolean; name: string }>(),
}));

vi.mock('@/lib/db', () => {
  const client = {
    query: async (sql: string, p: unknown[] = []) => {
      if (/^\s*UPDATE auth_tokens SET used_at = \$2 WHERE user_id = \$1/.test(sql)) {
        for (const t of db.tokens) if (t.user_id === p[0] && !t.used_at) t.used_at = p[1] as Date;
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO auth_tokens/.test(sql)) {
        db.tokens.push({
          user_id: p[0] as string,
          kind: p[1] as string,
          token_hash: p[2] as string,
          expires_at: p[3] as Date,
          used_at: null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE auth_tokens t SET used_at = \$2/.test(sql)) {
        const t = db.tokens.find(
          (x) =>
            x.token_hash === p[0] &&
            !x.used_at &&
            x.expires_at > (p[1] as Date) &&
            !db.users.get(x.user_id)?.disabled,
        );
        if (!t) return { rows: [], rowCount: 0 };
        t.used_at = p[1] as Date;
        return { rows: [{ user_id: t.user_id, kind: t.kind }], rowCount: 1 };
      }
      if (/UPDATE users SET password_hash/.test(sql)) {
        const u = db.users.get(p[0] as string);
        if (u) u.password_hash = p[1] as string;
        return { rows: [{ display_name: u?.name ?? '' }], rowCount: 1 };
      }
      if (/FROM auth_tokens t JOIN users u/.test(sql)) {
        const t = db.tokens.find(
          (x) =>
            x.token_hash === p[0] &&
            !x.used_at &&
            x.expires_at > (p[1] as Date) &&
            !db.users.get(x.user_id)?.disabled,
        );
        return { rows: t ? [{ user_id: t.user_id, kind: t.kind }] : [], rowCount: t ? 1 : 0 };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
  return { withServiceAccount: async (fn: (c: typeof client) => unknown) => fn(client) };
});

const U = '77777777-7777-4777-8777-777777777777';
const GOOD = 'a-long-enough-password';
const T0 = new Date('2026-10-19T10:00:00Z');
const plus = (min: number) => new Date(T0.getTime() + min * 60_000);

const issue = async (kind: 'invite' | 'reset' = 'invite', now = T0) => {
  const { issueToken } = await import('./authTokens');
  const { withServiceAccount } = await import('./db');
  return withServiceAccount((c) => issueToken(c, U, kind, now));
};

beforeEach(() => {
  db.tokens = [];
  db.users = new Map([[U, { password_hash: null, disabled: false, name: 'Demo Referent' }]]);
});

describe('auth tokens', () => {
  it('stores only the hash of the token', async () => {
    const { token } = await issue();
    const { tokenDigest } = await import('./authTokens');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(db.tokens[0]?.token_hash).toBe(tokenDigest(token));
    expect(JSON.stringify(db.tokens)).not.toContain(token);
  });

  it('sets the password once and refuses a second use of the same link', async () => {
    const { token } = await issue();
    const { setPasswordWithToken } = await import('./authTokens');
    const first = await setPasswordWithToken(token, GOOD, GOOD, plus(5));
    expect(first).toMatchObject({ ok: true, userId: U, kind: 'invite' });
    expect(db.users.get(U)?.password_hash).toMatch(/^scrypt\$/);
    const second = await setPasswordWithToken(
      token,
      'another-long-password',
      'another-long-password',
      plus(6),
    );
    expect(second).toEqual({ ok: false, reason: 'invalid' });
  });

  it('expires a reset after 60 minutes and an invite after 72 hours', async () => {
    const { setPasswordWithToken } = await import('./authTokens');
    const reset = await issue('reset');
    expect(await setPasswordWithToken(reset.token, GOOD, GOOD, plus(61))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const okReset = await issue('reset');
    expect(await setPasswordWithToken(okReset.token, GOOD, GOOD, plus(59))).toMatchObject({
      ok: true,
    });
    const invite = await issue('invite');
    expect(await setPasswordWithToken(invite.token, GOOD, GOOD, plus(71 * 60))).toMatchObject({
      ok: true,
    });
    const lateInvite = await issue('invite');
    expect(await setPasswordWithToken(lateInvite.token, GOOD, GOOD, plus(73 * 60))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('does not burn the link on a weak or mistyped password', async () => {
    const { token } = await issue();
    const { setPasswordWithToken, peekToken } = await import('./authTokens');
    expect(await setPasswordWithToken(token, 'short', 'short', plus(1))).toEqual({
      ok: false,
      reason: 'too_short',
    });
    expect(await setPasswordWithToken(token, GOOD, GOOD + 'x', plus(1))).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(await peekToken(token, plus(2))).toMatchObject({ userId: U });
    expect(await setPasswordWithToken(token, GOOD, GOOD, plus(3))).toMatchObject({ ok: true });
  });

  it('a newer link replaces the older one', async () => {
    const old = await issue('invite');
    const fresh = await issue('reset', plus(1));
    const { peekToken } = await import('./authTokens');
    expect(await peekToken(old.token, plus(2))).toBeNull();
    expect(await peekToken(fresh.token, plus(2))).toMatchObject({ kind: 'reset' });
  });

  it('refuses a disabled account and anything that is not a token', async () => {
    const { token } = await issue();
    db.users.get(U)!.disabled = true;
    const { setPasswordWithToken, peekToken } = await import('./authTokens');
    expect(await peekToken(token, plus(1))).toBeNull();
    expect(await setPasswordWithToken(token, GOOD, GOOD, plus(1))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await peekToken('not-a-token', plus(1))).toBeNull();
    expect(await peekToken('', plus(1))).toBeNull();
  });
});
