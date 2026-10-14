import { expect, test } from '@playwright/test';

/**
 * Mobile-survey acceptance test (PRD \u00a716).
 *
 * Runs at 360 px wide viewport. For each page in the synthetic flow:
 *  - the document does not horizontally scroll (`scrollWidth \u2264 clientWidth`),
 *  - the heading and option buttons are fully visible (no clipped labels),
 *  - the locale toggle and progress bar are present.
 */

test.describe('employee mobile survey @ 360 px', () => {
  test('welcome page renders without horizontal scroll and without clipped labels', async ({
    page,
  }) => {
    await page.goto('/about');
    const link = page.getByRole('link', { name: /synthetic sample survey/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/s\//);

    await page.goto(href ?? '/');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // No horizontal scroll on the page.
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Privacy notice and language toggle render fully.
    const privacy = page.locator('section.privacy');
    await expect(privacy).toBeVisible();
    const toggle = page.locator('[role="group"][aria-label="Survey language"]');
    await expect(toggle).toBeVisible();
  });

  test('can answer the first two questions without clipping at 360 px', async ({ page }) => {
    await page.goto('/about');
    const link = page.getByRole('link', { name: /synthetic sample survey/i });
    const href = (await link.getAttribute('href')) ?? '/';
    await page.goto(href);

    await page.getByRole('button', { name: /start the survey/i }).click();

    // Q1 \u2014 wait for the question heading and the option list to be rendered.
    await expect(page).toHaveURL(/\/q\/0$/);
    await expect(page.getByRole('progressbar')).toBeVisible();
    const option1 = page.locator('button.option-button').first();
    await expect(option1).toBeVisible();
    const box1 = await option1.boundingBox();
    expect(box1).not.toBeNull();
    expect(box1?.width ?? 0).toBeLessThanOrEqual(360);
    await page.locator('button.option-button').nth(1).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Q2 \u2014 URL changes to /q/1 once the answer is saved. We then measure the option button.
    await expect(page).toHaveURL(/\/q\/1$/);
    const option2 = page.locator('button.option-button').first();
    await expect(option2).toBeVisible();
    const box2 = await option2.boundingBox();
    expect(box2).not.toBeNull();
    expect(box2?.width ?? 0).toBeLessThanOrEqual(360);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('rejects an invalid token with a 404', async ({ page }) => {
    const response = await page.goto('/s/not-a-token');
    expect(response?.status()).toBe(404);
  });
});
