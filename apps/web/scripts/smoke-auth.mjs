/**
 * Shared smoke helper (ADR 0023): sign in as a synthetic seeded auditor and return a Cookie
 * header for authenticated fetches against the admin surface. Credentials are the obviously
 * fake ones seeded by infra/db/migrations/0015_auth_password.sql.
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
  const m = /aai_session=[^;]+/.exec(setCookie);
  if (res.status !== 303 || !m) throw new Error(`smoke login failed: HTTP ${res.status}`);
  // The smokes assert English copy; the app defaults to French without a choice (ADR 0024).
  return `${m[0]}; auditai_locale=en`;
};
