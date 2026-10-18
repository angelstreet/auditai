import { expect, test } from '@playwright/test';

/** Security headers, robots, health and login hardening (TASK-K, ADR 0032). */
test.describe('security headers', () => {
  test('every page sends the hardening headers', async ({ request }) => {
    const res = await request.get('/welcome');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('login and admin are noindex; robots.txt disallows them', async ({ request }) => {
    const login = await request.get('/login');
    expect(login.headers()['x-robots-tag']).toContain('noindex');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /login');
  });

  test('no console CSP violation on the public pages', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/content security policy/i.test(m.text())) violations.push(m.text());
    });
    for (const path of ['/welcome', '/about', '/privacy', '/quiz', '/login']) {
      await page.goto(path);
    }
    expect(violations).toEqual([]);
  });
});

test.describe('health', () => {
  test('/api/health answers 200 with ok and db', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  test('the retention cron refuses callers without the secret', async ({ request }) => {
    expect((await request.get('/api/cron/retention')).status()).toBe(401);
    const bad = await request.get('/api/cron/retention', {
      headers: { authorization: 'Bearer wrong' },
    });
    expect(bad.status()).toBe(401);
  });
});

test.describe('login hardening', () => {
  const post = (request: import('@playwright/test').APIRequestContext, email: string, pw: string) =>
    request.post('/api/auth/login', {
      form: { email, password: pw },
      maxRedirects: 0,
      headers: { 'x-forwarded-for': '198.51.100.77' },
    });

  test('unknown user and wrong password look the same, then the email locks', async ({
    request,
  }) => {
    // Unique per project run: the three viewport projects share one database.
    const ghost = `nobody-${Math.random().toString(36).slice(2)}@synthetic.invalid`;
    const known = await post(request, 'synthetic-auditor-b@synthetic.invalid', 'wrong-password-1');
    const unknown = await post(request, ghost, 'wrong-password-1');
    expect(known.status()).toBe(303);
    expect(unknown.headers()['location']).toBe(known.headers()['location']);
    expect(known.headers()['location']).toContain('error=invalid');
    for (let i = 0; i < 4; i += 1) await post(request, ghost, `x-${i}`);
    const locked = await post(request, ghost, 'wrong-password-9');
    expect(locked.headers()['location']).toContain('error=locked');
  });

  test('the session cookie is HttpOnly and SameSite=Lax', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      form: { email: 'synthetic-auditor-a@synthetic.invalid', password: 'synthetic-password-a' },
      maxRedirects: 0,
      headers: { 'x-forwarded-for': '198.51.100.78' },
    });
    expect(res.status()).toBe(303);
    const cookie = res.headers()['set-cookie'] ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
  });
});
