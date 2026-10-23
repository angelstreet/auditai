import { expect, test } from '@playwright/test';

/** TASK-AB3: the footer breaks cleanly: no item wraps inside itself, links never sit alone oddly. */
for (const width of [360, 600, 800, 1280]) {
  test(`footer at ${width}px: licence line and links stay whole`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/login');
    const rights = page.locator('footer p').first();
    const lineHeight = await rights.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const box = await rights.boundingBox();
    expect(box?.height ?? 0, 'licence phrase on one line').toBeLessThanOrEqual(lineHeight * 1.2);
    for (const link of await page.locator('footer nav a').all()) {
      const b = await link.boundingBox();
      expect(b?.height ?? 0, 'link on one line').toBeLessThanOrEqual(48);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow).toBeLessThanOrEqual(width);
  });
}
