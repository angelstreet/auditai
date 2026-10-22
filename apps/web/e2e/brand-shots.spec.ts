import { mkdirSync } from 'node:fs';
import { test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Before/after evidence for docs/brand/review (TASK-AC2). Skipped unless SHOTS_DIR is set; synthetic
 * seed data only. SHOTS_PREFIX is "before" on main and "after" on this branch.
 */
const dir = process.env['SHOTS_DIR'];
const prefix = process.env['SHOTS_PREFIX'] ?? 'after';

test.describe('brand screenshots', () => {
  test.skip(!dir, 'set SHOTS_DIR to write screenshots');
  for (const theme of ['light', 'dark'] as const) {
    test(`public and signed-in, ${theme}`, async ({ page, context, baseURL }, info) => {
      mkdirSync(dir as string, { recursive: true });
      await context.addCookies([
        { name: 'evolai_theme', value: theme, url: baseURL as string },
        { name: 'evolai_locale', value: 'en', url: baseURL as string },
      ]);
      const shot = (name: string) =>
        page.screenshot({ path: `${dir}/${prefix}-${name}-${info.project.name}-${theme}.png` });
      await page.goto('/');
      await shot('front');
      await page.goto('/login');
      await shot('sign-in');
      await signInAsAuditorA(page);
      await page.goto('/admin/engagements');
      await shot('admin');
      await page.getByTestId('account-button').click();
      await page.waitForTimeout(400);
      await shot('account-menu');
    });
  }
});
