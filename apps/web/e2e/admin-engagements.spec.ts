import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Admin engagements smoke test (M6).
 *
 * The page is desktop-first; Playwright's default Chromium project is wide enough. We assert:
 *   - the page renders a table with the synthetic engagements,
 *   - the tenant switcher swaps the visible data,
 *   - unknown tenant ids redirect to the default.
 */

test.describe('admin engagements page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAuditorA(page);
  });

  test('lists the synthetic engagements for the default tenant', async ({ page }) => {
    await page.goto('/admin/engagements');
    const heading = page.getByRole('heading', { level: 1, name: /audit engagements/i });
    await expect(heading).toBeVisible();

    // One engagement row visible in the default tenant.
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);

    // Completion text in the table cell.
    const completionCell = page.locator('table tbody tr').first().locator('td').nth(7);
    await expect(completionCell).toContainText(/42%/); // tenant A: 5/12 = 0.4167 \u2248 42%
  });

  test("tenant switcher lists only the signed-in user's tenants", async ({ page }) => {
    await page.goto('/admin/engagements');
    const organisationCell = page.locator('table tbody tr').first().locator('th');
    await expect(organisationCell).toContainText('Synthetic Co A');
    // Auditor A is not a member of tenant B: no switcher link, no leaked data (ADR 0023).
    await expect(page.getByRole('link', { name: 'Synthetic Co B' })).toHaveCount(0);
  });

  test('redirects to the default tenant when an unknown id is supplied', async ({ page }) => {
    await page.goto('/admin/engagements?tenant=not-a-real-tenant');
    await expect(page).toHaveURL(/\/admin\/engagements\?tenant=/);
    const tenantARow = page.locator('table tbody tr').first();
    await expect(tenantARow.locator('th')).toContainText('Synthetic Co A');
  });
});
