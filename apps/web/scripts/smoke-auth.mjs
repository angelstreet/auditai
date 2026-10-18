/**
 * Shared smoke helper (ADR 0023): sign in as a synthetic seeded auditor and return a Cookie
 * header for authenticated fetches against the admin surface. Credentials are the obviously
 * fake ones seeded by infra/db/migrations/0015_auth_password.sql.
 *
 * The actor id a smoke writes into `audit_log` comes from that same session (`sub`), not from a
 * constant, so the audit rows carry the id the app itself would record.
 */
export const SYNTHETIC_USERS = {
  a: {
    email: 'synthetic-auditor-a@synthetic.invalid',
    password: 'synthetic-password-a',
    id: '99999999-9999-4999-8999-999999999999',
    tenantId: '11111111-1111-4111-8111-111111111111',
  },
  b: {
    email: 'synthetic-auditor-b@synthetic.invalid',
    password: 'synthetic-password-b',
    id: '99999999-9999-4999-8999-aaaaaaaaaaaa',
    tenantId: '22222222-2222-4222-8222-222222222222',
  },
};

export const loginCookie = async (base, user = SYNTHETIC_USERS.a) => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: user.email, password: user.password }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const m = /evolai_session=[^;]+/.exec(setCookie);
  if (res.status !== 303 || !m) throw new Error(`smoke login failed: HTTP ${res.status}`);
  // The smokes assert English copy; the app defaults to French without a choice (ADR 0024).
  return `${m[0]}; evolai_locale=en`;
};

/** users.id of the signed-in auditor, read from the session payload (`sub`, ADR 0023). */
export const sessionUserId = (cookie) => {
  const token = /evolai_session=([^;]+)/.exec(cookie)?.[1];
  const payload = token?.split('.')[0];
  if (!payload) throw new Error('smoke: no session cookie to read the user id from');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).sub;
};

/** Sign in like the app does and return the cookie plus the real user id behind it. */
export const signIn = async (base, user = SYNTHETIC_USERS.a) => {
  const cookie = await loginCookie(base, user);
  return { cookie, userId: sessionUserId(cookie) };
};
