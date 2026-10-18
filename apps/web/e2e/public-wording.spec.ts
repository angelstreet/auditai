import { expect, test } from '@playwright/test';

/**
 * What a visitor from a real company reads (TASK-K): no milestone numbers, mock-up or test-data
 * wording, no developer hints, in fr and en. Admin screens are out of scope.
 */
// /intake is not public any more (ADR 0036); it is covered by intake-access.spec.ts.
const PUBLIC_PATHS = ['/welcome', '/about', '/privacy', '/quiz', '/login'];
const DEV_WORDING =
  /\bM\d{1,2}[a-z]?\b|mock-?up|synthetic|synth[ée]tique|development|d[ée]veloppement|\bseed\b|placeholder|lorem|\bgate\s+[a-z]\b|local:up|\bTODO\b/i;

for (const locale of ['fr', 'en'] as const) {
  for (const path of PUBLIC_PATHS) {
    test(`${path} shows no development wording in ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const text = await page.locator('body').innerText();
      expect(text, `${path} (${locale})`).not.toMatch(DEV_WORDING);
      const title = await page.title();
      expect(title, `${path} title`).not.toMatch(DEV_WORDING);
    });
  }
}
