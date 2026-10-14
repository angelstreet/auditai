import { expect, test } from '@playwright/test';

/**
 * Admin engagements smoke test (M6).
 *
 * The page is desktop-first; Playwright's default Chromium project is wide enough. We assert:
 *   - the page renders a table with the synthetic engagements,
 *   - the tenant switcher swaps the visible data,
 *   - unknown tenant ids redirect to the default.
 */

test.describe('admin engagements page', () => {
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

  test('tenant switcher swaps the data without leaking the other tenant', async ({ page }) => {
    await page.goto('/admin/engagements');
    const organisationCell = page.locator('table tbody tr').first().locator('th');
    await expect(organisationCell).toContainText('Synthetic Co A');

    // Click the second tenant link (tenant B) and confirm the data changes.
    await page.getByRole('link', { name: 'Synthetic Co B' }).click();
    const tenantBRow = page.locator('table tbody tr').first();
    await expect(tenantBRow.locator('th')).toContainText('Synthetic Co B');
    await expect(tenantBRow.locator('td').nth(7)).toContainText(/33%/); // tenant B: 3/9 = 0.3333 \u2248 33%

    // Cross-tenant leak check: tenant A's engagement id is absent from the table.
    const tenantAId = 'a5555555-4555-4555-8555-555555555555';
    await expect(page.locator(`table >> text=${tenantAId}`)).toHaveCount(0);
  });

  test('redirects to the default tenant when an unknown id is supplied', async ({ page }) => {
    await page.goto('/admin/engagements?tenant=not-a-real-tenant');
    await expect(page).toHaveURL(/\/admin\/engagements\?tenant=/);
    const tenantARow = page.locator('table tbody tr').first();
    await expect(tenantARow.locator('th')).toContainText('Synthetic Co A');
  });
});
