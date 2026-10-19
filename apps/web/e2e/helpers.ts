import type { Page } from '@playwright/test';

/** Sign in as the seeded synthetic auditor of tenant A (migration 0015; fake credentials). */
export const signInAsAuditorA = async (
  page: Page,
  expectPath = /\/(admin\/|board)/,
): Promise<void> => {
  await page.goto('/login');
  await page.fill('input[name=email]', 'synthetic-auditor-a@synthetic.invalid');
  await page.fill('input[name=password]', 'synthetic-password-a');
  await page.click('button[type=submit]');
  await page.waitForURL(expectPath);
};
