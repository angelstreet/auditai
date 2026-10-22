import { mkdirSync } from 'node:fs';
import { test } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Before/after evidence for docs/brand/review (TASK-AD2). Skipped unless SHOTS_DIR is set; synthetic
 * seed data only. The "before" of these screens is the AC2 set (`after-admin-*`).
 */
const dir = process.env['SHOTS_DIR'];
const MISSION = '/admin/engagements/a5555555-4555-4555-8555-555555555555';

test.describe('missions screenshots', () => {
  test.skip(!dir, 'set SHOTS_DIR to write screenshots');
  for (const theme of ['light', 'dark'] as const) {
    test(`missions, mission tabs and settings, ${theme}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      mkdirSync(dir as string, { recursive: true });
      await context.addCookies([
        { name: 'evolai_theme', value: theme, url: baseURL as string },
        { name: 'evolai_locale', value: 'en', url: baseURL as string },
      ]);
      const shot = (name: string) =>
        page.screenshot({
          path: `${dir}/ad2-after-${name}-${info.project.name}-${theme}.png`,
          fullPage: true,
        });
      await signInAsAuditorA(page);
      await shot('missions');
      for (const [name, path] of [
        ['mission-overview', MISSION],
        ['mission-answers', `${MISSION}/answers`],
        ['mission-settings', `${MISSION}/settings`],
        ['workspace-settings', '/admin/settings'],
      ] as const) {
        await page.goto(path);
        await shot(name);
      }
    });
  }
});
