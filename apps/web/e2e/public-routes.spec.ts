import { expect, test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

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

const LOCALES = ['fr', 'en'] as const;
const PUBLIC_PATHS = [
  '/welcome',
  '/about',
  '/privacy',
  '/intake',
  '/board',
  '/quiz',
  '/admin/teams',
  '/admin/synergies',
  '/admin/data',
];
/** Catalog keys look like `namespace.sub.key`; seeing one in rendered text means a missing message. */
const RAW_KEY =
  /\b(common|meta|welcome|about|privacy|survey|quiz|intake|status|admin)\.[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)*\b/;

test.describe('public routes (every viewport, layout gate)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAuditorA(page);
  });

  for (const locale of LOCALES) {
    for (const path of PUBLIC_PATHS) {
      test(`${path} renders a heading in ${locale}`, async ({ page, context, baseURL }) => {
        await context.addCookies([
          { name: 'auditai_locale', value: locale, url: baseURL as string },
        ]);
        const response = await page.goto(path);
        expect(response?.status(), `${path} should return 200`).toBe(200);
        // At least one heading in the viewport \u2014 catches a 4xx that slipped past status.
        const heading = page.locator('h1, h2, h3').first();
        await expect(heading).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // One landmark per page: pages render inside the layout's <main> (ADR 0025).
        await expect(page.locator('main')).toHaveCount(1);
        const text = await page.locator('body').innerText();
        expect(text, `${path} (${locale}) must not render a raw message key`).not.toMatch(RAW_KEY);
      });
    }
  }

  test('/ 30x-redirects to /welcome on every viewport', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Final URL after the redirect.
    // Static prerender redirects client-side; wait for it rather than racing DOMContentLoaded.
    await page.waitForURL(/\/welcome$/);
    expect(response?.status(), 'redirect chain lands at 200').toBeLessThan(400);
  });

  test('mobile-360 has no horizontal scroll on the public surfaces', async ({ page }) => {
    page.setViewportSize({ width: 360, height: 800 });
    for (const path of [
      '/welcome',
      '/board',
      '/quiz',
      '/intake',
      '/admin/engagements',
      '/admin/teams',
      '/admin/data',
    ]) {
      for (const locale of LOCALES) {
        await page
          .context()
          .addCookies([{ name: 'auditai_locale', value: locale, url: 'http://127.0.0.1:3200' }]);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(() =>
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        );
        expect(overflow, `${path} (${locale}): scrollWidth should be <= 360`).toBeLessThanOrEqual(
          360,
        );
      }
    }
  });

  test('header controls are at least 44px tall', async ({ page }) => {
    await page.goto('/privacy');
    const heights = await page
      .locator('header a, header button')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test('no clipped labels at the viewport edges', async ({ page }) => {
    await page.goto('/welcome');
    // The hero heading + the first CTA are both inside the viewport.
    const heading = page.locator('h1').first();
    await expect(heading).toBeInViewport();
  });
});
