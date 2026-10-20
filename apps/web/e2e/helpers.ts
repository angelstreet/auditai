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

/**
 * Answer the question on screen the way a person would: type a short sentence when it is a text
 * box and press Next, otherwise tap the last option (TASK-Z2: questionnaire v1 has both).
 */
export const answerCurrent = async (
  page: Page,
  sentence = 'Copier les mêmes lignes à la main.',
): Promise<void> => {
  const box = page.locator('textarea.text-answer-input');
  if ((await box.count()) > 0) {
    await box.fill(sentence);
    await page.locator('button.text-next').click();
    return;
  }
  await page.locator('button.option-button').last().click();
};
