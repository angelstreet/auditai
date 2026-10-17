import { expect, test } from '@playwright/test';

/**
 * Language negotiation + switching (TASK-C, ADR 0024).
 * First visit: Accept-Language decides (default fr). The header switcher stores a cookie and
 * re-renders the page in place; the choice survives navigation.
 */

test.describe('i18n negotiation and switching', () => {
  test.describe('Accept-Language: en-GB', () => {
    test.use({ locale: 'en-GB', extraHTTPHeaders: { 'accept-language': 'en-GB,en;q=0.9' } });
    test('first visit renders English', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Privacy notice/);
    });
  });

  test.describe('Accept-Language: fr-CA', () => {
    test.use({
      locale: 'fr-CA',
      extraHTTPHeaders: { 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5' },
    });
    test('first visit renders French', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        /Politique de confidentialité/,
      );
    });
  });

  test.describe('Accept-Language: de (unsupported)', () => {
    test.use({ locale: 'de-DE', extraHTTPHeaders: { 'accept-language': 'de-DE,de;q=0.9' } });
    test('falls back to the default (fr)', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    });
  });

  test.describe('switcher', () => {
    test.use({ locale: 'fr-FR', extraHTTPHeaders: { 'accept-language': 'fr' } });
    test('switching to English re-renders and persists across navigation', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await page.getByTestId('switch-en').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Privacy notice/);
      await page.goto('/about');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByTestId('switch-en')).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('switch-fr').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    });
  });
});
