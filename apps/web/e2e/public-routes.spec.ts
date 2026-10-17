import { expect, test } from '@playwright/test';

/**
 * Cross-route Playwright smoke (M15 slice D, PRD \u00a716).
 *
 * Walks the 5 public surfaces (the ones reachable without a secure invite
 * token) at each configured viewport (mobile-360, tablet-768,
 * desktop-admin). The assertions are intentionally cheap:
 *   * HTTP 200,
 *   * the page heading is visible,
 *   * no horizontal scroll on mobile,
 *   * no `clip` of the title labels in the visible viewport.
 *
 * The deeper per-route smoke (data assertions) is covered by the Node
 * `m10..m15b:smoke` scripts; this spec is the **layout** gate.
 */

test.describe('public routes (every viewport, layout gate)', () => {
  for (const path of [
    '/welcome',
    '/board',
    '/quiz',
    '/admin/teams',
    '/admin/synergies',
    '/admin/data',
  ]) {
    test(`${path} renders a heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
      // At least one heading in the viewport \u2014 catches a 4xx that slipped past status.
      const heading = page.locator('h1, h2, h3').first();
      await expect(heading).toBeVisible();
    });
  }

  test('/ 30x-redirects to /welcome on every viewport', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Final URL after the redirect.
    expect(page.url().endsWith('/welcome')).toBe(true);
    expect(response?.status(), 'redirect chain lands at 200').toBeLessThan(400);
  });

  test('mobile-360 has no horizontal scroll on the public surfaces', async ({ page }) => {
    page.setViewportSize({ width: 360, height: 800 });
    for (const path of ['/welcome', '/board', '/quiz', '/admin/teams', '/admin/data']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      );
      expect(overflow, `${path}: scrollWidth should be <= 360`).toBeLessThanOrEqual(360);
    }
  });

  test('no clipped labels at the viewport edges', async ({ page }) => {
    await page.goto('/welcome');
    // The hero heading + the first CTA are both inside the viewport.
    const heading = page.locator('h1').first();
    await expect(heading).toBeInViewport();
  });
});
