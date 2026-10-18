import { expect, test, type Page } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Standard chrome (TASK-L, ADR 0034, docs/UI_RULES.md §0, §6, §11, §12):
 *  - header controls are icon buttons with names, and keep the same boxes in fr/en and light/dark,
 *  - after sign-in the header says who you are (name, email, role, organisation) and signs you out,
 *  - the theme toggle is a cookie the server renders, so a reload keeps it without a flash,
 *  - dark is a lifted slate, not black.
 */

const CONTROLS = ['language-button', 'theme-button', 'sign-in-button'] as const;

const boxesOf = async (page: Page) => {
  const out: Record<string, { x: number; y: number; width: number; height: number } | null> = {};
  for (const id of CONTROLS) out[id] = await page.getByTestId(id).boundingBox();
  return out;
};

const visit = async (page: Page, baseURL: string, locale: 'fr' | 'en', theme: 'light' | 'dark') => {
  await page.context().addCookies([
    { name: 'evolai_locale', value: locale, url: baseURL },
    { name: 'evolai_theme', value: theme, url: baseURL },
  ]);
  await page.goto('/privacy');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
};

test.describe('header chrome', () => {
  test('controls are named icon buttons of 44px or more', async ({ page }) => {
    await page.goto('/privacy');
    for (const id of CONTROLS) {
      const control = page.getByTestId(id);
      await expect(control).toHaveAttribute('aria-label', /.+/);
      const box = await control.boundingBox();
      expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
    }
  });

  test('no layout shift when the language or the theme changes', async ({ page, baseURL }) => {
    await visit(page, baseURL as string, 'fr', 'light');
    const reference = await boxesOf(page);
    for (const [locale, theme] of [
      ['en', 'light'],
      ['fr', 'dark'],
      ['en', 'dark'],
    ] as const) {
      await visit(page, baseURL as string, locale, theme);
      expect(await boxesOf(page), `${locale} ${theme}`).toEqual(reference);
    }
  });

  test('the theme toggle persists through a reload, from the server', async ({ page }) => {
    await page.goto('/privacy');
    const before = await page.locator('html').getAttribute('data-theme');
    await page.getByTestId('theme-button').click();
    const after = before === 'dark' ? 'light' : 'dark';
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
    // The server sends the attribute itself: check the raw HTML, before any script runs.
    const html = await (await page.request.get('/privacy')).text();
    expect(html).toMatch(new RegExp(`<html[^>]*data-theme="${after}"`));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  });

  test('dark is a lifted slate with a visible teal primary, not black (§12)', async ({
    page,
    baseURL,
  }) => {
    await visit(page, baseURL as string, 'en', 'dark');
    await page.goto('/welcome');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(26, 29, 35)');
    const primary = page.locator('main a.MuiButton-contained').first();
    await expect(primary).toBeVisible();
    expect(await primary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(46, 196, 178)',
    );
  });
});

test.describe('identity after sign-in (§11)', () => {
  test('the header shows who is signed in and signs out', async ({ page, baseURL }) => {
    await page
      .context()
      .addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
    await signInAsAuditorA(page);
    await expect(page.getByTestId('sign-in-button')).toHaveCount(0);
    const account = page.getByTestId('account-button');
    await expect(account).toBeVisible();
    await expect(account).toHaveAccessibleName('Synthetic auditor A');
    await account.click();
    const identity = page.getByTestId('account-identity');
    await expect(identity).toContainText('synthetic-auditor-a@synthetic.invalid');
    await expect(identity).toContainText(/Auditor|Platform owner/);
    await expect(identity).toContainText(/·\s*\S/);
    await page.getByTestId('sign-out').click();
    await page.waitForURL(/\/login/);
    await expect(page.getByTestId('sign-in-button')).toBeVisible();
  });
});
