import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/** FR-03 admin flow: create links, small teams are suppressed, exports carry no identity. */
test.describe('admin invitations page', () => {
  test('creates links, shows progress and exports bare links', async ({ page }) => {
    await signInAsAuditorA(page);
    await page.goto('/admin/invitations');
    await page
      .getByRole('link')
      .filter({ hasText: /synthetic/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Invitations' })).toBeVisible();

    await page
      .getByLabel(/^Links for /)
      .first()
      .fill('2');
    await page.getByRole('button', { name: 'Create links' }).click();
    // The same batch twice within ten minutes asks for a tick (other projects ran it already).
    const again = page.getByLabel('Yes, create them again');
    const asked = await again
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (asked) {
      await again.check();
      await page.getByRole('button', { name: 'Create links' }).click();
    }
    await expect(page.getByRole('status').filter({ hasText: '2 links created.' })).toBeVisible();

    // Progress per team appears; suppression below 5 people is covered by unit tests.
    await expect(page.getByRole('heading', { name: 'Progress by team' })).toBeVisible();
    await expect(page.getByRole('progressbar').first()).toBeVisible();

    const url = new URL(page.url());
    const q = `tenant=${url.searchParams.get('tenant')}&engagement=${url.searchParams.get('engagement')}`;
    const csv = await page.request.get(`/admin/invitations/export?${q}`);
    expect(csv.status()).toBe(200);
    const body = await csv.text();
    expect(body.split(/\r?\n/)[0]).toBe('link,team');
    expect(body).not.toContain('@');
  });

  test('the export refuses an anonymous request', async ({ request }) => {
    const res = await request.get(
      '/admin/invitations/export?tenant=00000000-0000-4000-8000-000000000001&engagement=00000000-0000-4000-8000-000000000002',
      { maxRedirects: 0 },
    );
    expect([307, 401, 403]).toContain(res.status());
  });
});
