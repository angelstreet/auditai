import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * ADR 0023: auditor sign-in, tenant isolation and real actor in the audit trail.
 * Credentials are the obviously-fake ones seeded by migration 0015.
 */

const USER_A = {
  email: 'synthetic-auditor-a@synthetic.invalid',
  password: 'synthetic-password-a',
  id: '99999999-9999-4999-8999-999999999999',
  tenant: '11111111-1111-4111-8111-111111111111',
};
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const databaseUrl = (): string =>
  process.env['DATABASE_URL'] ??
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

const count = async (sql: string, params: unknown[]): Promise<number> => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ n: string }>(sql, params);
    return Number(rows[0]?.n ?? 0);
  } finally {
    await client.end();
  }
};

test.describe('auditor auth (ADR 0023)', () => {
  test('anonymous visitors are redirected from /admin/settings to /login', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fsettings/);
    await expect(
      page.getByRole('heading', { level: 1, name: /sign in|connexion|connecter/i }),
    ).toBeVisible();
  });

  test('wrong password does not sign in', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name=email]', USER_A.email);
    await page.fill('input[name=password]', 'not-the-password');
    await page.click('button[type=submit]');
    await expect(page.getByRole('alert')).toContainText('incorrect');
    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a forged session cookie is rejected', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'evolai_session',
        value: 'eyJzdWIiOiJ4In0.AAAA',
        url: `http://127.0.0.1:${process.env['PW_PORT'] ?? '3200'}`,
      },
    ]);
    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('respondent routes stay public', async ({ page }) => {
    for (const path of ['/welcome', '/quiz', '/privacy', '/about']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      expect(page.url(), path).not.toContain('/login');
    }
  });

  test('a tenant-A user cannot erase in tenant B (forged tenantId)', async ({ page }) => {
    await signInAsAuditorA(page);
    await page.goto('/admin/settings/data');
    // ?tenant=B is ignored: the page stays on a tenant the session grants.
    await page.goto(`/admin/settings/data?tenant=${TENANT_B}`);
    await expect(page.locator('input[name=tenantId]').first()).toHaveValue(USER_A.tenant);

    const exportsB = () =>
      count('SELECT count(*) AS n FROM export_requests WHERE tenant_id = $1', [TENANT_B]);
    const erasuresB = () =>
      count('SELECT count(*) AS n FROM audit_log WHERE tenant_id = $1 AND action = $2', [
        TENANT_B,
        'badge.erase',
      ]);
    const before = [await exportsB(), await erasuresB()];

    // Forge the hidden field of both forms.
    await page.evaluate((t) => {
      document
        .querySelectorAll<HTMLInputElement>('input[name=tenantId]')
        .forEach((i) => (i.value = t));
    }, TENANT_B);
    await page.fill('input[name=respondentPseudonym]', 'synthetic-employee-001');
    await page.getByRole('button', { name: 'Erase the answers' }).click();
    // Erase only runs from the confirm dialog (UI_RULES §3).
    await page.getByRole('dialog').getByLabel('Answer code').fill('synthetic-employee-001');
    await page.getByRole('dialog').getByRole('button', { name: 'Erase the answers' }).click();
    await expect(page.getByText('You do not belong to this organisation').first()).toBeVisible();

    expect([await exportsB(), await erasuresB()]).toEqual(before);
  });
});
