import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Missions list smoke test (M6, reshaped by TASK-AD2): the synthetic mission of the default
 * organisation is listed with its answers, other organisations never leak, and an unknown
 * `?tenant=` changes nothing.
 */
const visibleMissions = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid=mission-row]:visible, [data-testid=mission-card]:visible');

test.describe('missions list', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAuditorA(page);
  });

  test('lists the synthetic mission of the default organisation with its answers', async ({
    page,
  }) => {
    await page.goto('/admin/engagements');
    await expect(page.getByRole('heading', { level: 1, name: /^Missions$/ })).toBeVisible();
    await expect(visibleMissions(page)).toHaveCount(1);
    // Tenant A: 5 answers out of 12 expected.
    await expect(visibleMissions(page).first()).toContainText(/5 (of|sur) 12/);
  });

  test("lists only the signed-in user's organisations", async ({ page }) => {
    await page.goto('/admin/engagements');
    await expect(visibleMissions(page).first()).toContainText('Synthetic Co A');
    // Auditor A is not a member of tenant B: nothing of it is listed (ADR 0023).
    await expect(page.getByText('Synthetic Co B')).toHaveCount(0);
  });

  test('an unknown organisation id changes nothing', async ({ page }) => {
    await page.goto('/admin/engagements?tenant=not-a-real-tenant');
    await expect(visibleMissions(page).first()).toContainText('Synthetic Co A');
    await expect(page.getByText('Synthetic Co B')).toHaveCount(0);
  });
});
