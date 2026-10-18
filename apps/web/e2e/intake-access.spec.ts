import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * TASK-R, ADR 0037: /intake needs an auditor session and is scoped to the session's tenant.
 * Synthetic data only.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const RUN = Date.now().toString(36);

const databaseUrl = (): string =>
  process.env['DATABASE_URL'] ??
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

const briefCount = async (tenant: string, text: string): Promise<number> => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.is_service_account = 'on'");
    const { rows } = await client.query<{ n: string }>(
      'SELECT count(*) AS n FROM sponsor_briefs WHERE tenant_id = $1 AND top_priority_workflow = $2',
      [tenant, text],
    );
    await client.query('ROLLBACK');
    return Number(rows[0]?.n ?? 0);
  } finally {
    await client.end();
  }
};

test.describe('/intake access', () => {
  const MARKER = 'Demo Client intake marker';
  test('anonymous visitors are sent to /login?next=/intake and see no brief', async ({ page }) => {
    for (const url of ['/intake', `/intake?tenant=${TENANT_B}`]) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/login\?next=%2Fintake/);
      const text = await page.locator('body').innerText();
      expect(text).not.toContain(MARKER);
      await expect(page.locator('dl.dl-grid')).toHaveCount(0);
    }
  });

  test('an anonymous request does not return the brief page', async ({ request }) => {
    const res = await request.get('/intake', { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()['location'] ?? '').toContain('/login');
    expect(await res.text()).not.toContain(MARKER);
  });

  test('a tenant-A auditor saves to tenant A even with a forged tenantId', async ({
    page,
  }, info) => {
    const marker = `${MARKER} ${RUN} ${info.project.name}`;
    await signInAsAuditorA(page);
    await page.goto(`/intake?tenant=${TENANT_B}`);
    await page.fill('textarea[name=topPriorityWorkflow], input[name=topPriorityWorkflow]', marker);
    await page.evaluate((b) => {
      const form = document.querySelector('form') as HTMLFormElement;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'tenantId';
      input.value = b;
      form.appendChild(input);
    }, TENANT_B);
    await page.locator('form button[type=submit]').click();
    await expect.poll(() => briefCount(TENANT_A, marker)).toBe(1);
    expect(await briefCount(TENANT_B, marker)).toBe(0);
    await page.goto('/intake');
    await expect(page.locator('dl.dl-grid')).toContainText(marker);
  });
});
