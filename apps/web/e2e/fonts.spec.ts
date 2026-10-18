import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * One font everywhere (TASK-G, ADR 0027). Every surface renders the same primary family, it is
 * really loaded (not a silent system fallback), nothing asks an external host for a font, and
 * French text with long words does not overflow a 360 px screen.
 */

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const INVITE_FR = 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0002';
const inviteUrl = `/s/${INVITE_FR}.${createHmac('sha256', SECRET).update(INVITE_FR).digest('base64url')}`;
const LANDING = pathToFileURL(join(process.cwd(), '..', '..', 'landing', 'index.html')).href;

const primaryFamily = (page: Page, selector = 'body') =>
  page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel) as Element).fontFamily.split(',')[0],
    selector,
  );

/** Wait for the fonts the page asked for, then report whether Inter 400/500/600 are loaded. */
const interLoaded = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(async () => {
    await Promise.all(
      ['400', '500', '600'].map((w) => document.fonts.load(`${w} 16px Inter`, 'Aàéçœ')),
    );
    return ['400', '500', '600'].every((w) => document.fonts.check(`${w} 16px Inter`));
  });
};

test.describe('one font on every surface', () => {
  const externalFontRequests: string[] = [];

  test.beforeEach(({ page }) => {
    externalFontRequests.length = 0;
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) {
        externalFontRequests.push(req.url());
      }
    });
  });

  test.afterEach(() => {
    expect(externalFontRequests, 'no request leaves the host (fonts are self-hosted)').toEqual([]);
  });

  test('respondent, login, admin and landing share the primary family', async ({ page }) => {
    const seen: Record<string, string | undefined> = {};

    await page.goto(inviteUrl);
    seen['respondent'] = await primaryFamily(page);
    expect(await interLoaded(page), 'respondent: Inter 400/500/600 loaded').toBe(true);
    expect(await primaryFamily(page, 'main')).toBe(seen['respondent']);

    await page.goto('/login');
    seen['login'] = await primaryFamily(page);
    expect(await primaryFamily(page, 'input[name=email]')).toBe(seen['login']);
    expect(await primaryFamily(page, 'button[type=submit]')).toBe(seen['login']);

    await signInAsAuditorA(page);
    await page.goto('/admin/teams');
    seen['admin'] = await primaryFamily(page);
    expect(await primaryFamily(page, 'h1')).toBe(seen['admin']);

    await page.goto(LANDING);
    seen['landing'] = await primaryFamily(page);
    expect(await interLoaded(page), 'landing: Inter loaded from brand/fonts').toBe(true);

    expect(new Set(Object.values(seen)).size, JSON.stringify(seen)).toBe(1);
    expect(seen['respondent']).toMatch(/Inter/);
  });
});

test.describe('French text fits a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'runs in the mobile-360 project');

  for (const path of [inviteUrl, '/welcome', '/about', '/privacy', '/quiz', '/login']) {
    test(`no horizontal overflow at 360px: ${path.startsWith('/s/') ? '/s/<invite>' : path}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([{ name: 'evolai_locale', value: 'fr', url: baseURL as string }]);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll, 'scrollWidth vs clientWidth').toBeLessThanOrEqual(client);
    });
  }
});
