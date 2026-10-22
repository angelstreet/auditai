import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { answerCurrent, signInAsAuditorA } from './helpers';

/**
 * Screenshot sweep (TASK-L, docs/UI_GLOWUP_PLAN.md): every page in light and dark, 360 and 1280,
 * fr and en. Not a gate: runs only with SCREENS=1 and writes PNGs to apps/web/screens/<SCREENS_TAG>/
 * (git-ignored) for the visual review against docs/UI_RULES.md.
 *
 *   SCREENS=1 SCREENS_TAG=before pnpm exec playwright test screens --project=desktop-admin
 */

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const tokenFor = (reference: string): string =>
  `${reference}.${createHmac('sha256', SECRET).update(reference).digest('base64url')}`;

const OUT = join(process.cwd(), 'screens', process.env['SCREENS_TAG'] ?? 'latest');
// Pending seeded invitations, one per combination: opening /done submits, so each combination
// shoots the first-visit and question screens on an invitation nobody has used yet.
const FRESH = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa000${n}`);
// Answered once in the sweep to show the return page.
const ANSWERED = 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0005';
let combo = 0;

const shoot = async (page: Page, dir: string, name: string) => {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
};

const answerAll = async (page: Page, token: string) => {
  await page.goto(`/s/${token}/q/0`);
  for (let i = 0; i < 20 && !page.url().endsWith('/done'); i += 1) {
    const before = page.url();
    await answerCurrent(page);
    await page.waitForURL((u) => u.toString() !== before);
  }
};

test.describe('screenshot sweep', () => {
  test.skip(!process.env['SCREENS'], 'set SCREENS=1 to take the review screenshots');
  test.setTimeout(600_000);

  test('every page, both themes, both widths, both languages', async ({ browser, baseURL }) => {
    let answered = false;
    for (const locale of ['fr', 'en'] as const) {
      for (const scheme of ['light', 'dark'] as const) {
        for (const width of [360, 1280]) {
          const dir = join(OUT, `${locale}-${scheme}-${width}`);
          mkdirSync(dir, { recursive: true });
          const context = await browser.newContext({
            viewport: { width, height: width < 600 ? 800 : 900 },
            colorScheme: scheme,
            locale,
          });
          await context.addCookies([
            { name: 'evolai_locale', value: locale, url: baseURL as string },
            { name: 'evolai_theme', value: scheme, url: baseURL as string },
          ]);
          const page = await context.newPage();
          const fresh = tokenFor(FRESH[combo++ % FRESH.length] as string);

          for (const [name, path] of [
            ['01-home', '/'],
            ['02-welcome', '/welcome'],
            ['03-about', '/about'],
            ['04-privacy', '/privacy'],
            ['05-login', '/login'],
            ['06-login-error', '/login?error=invalid'],
            ['07-survey-start', `/s/${fresh}`],
            ['15-quiz', '/quiz'],
            ['16-quiz-result-missing', '/quiz/result'],
            ['19-not-found', '/does-not-exist'],
            ['20-bad-link', `/s/${'x'.repeat(10)}.${'y'.repeat(40)}`],
          ] as const) {
            await page.goto(path);
            await shoot(page, dir, name);
          }
          // One screen per question (each question type in the seeded template).
          for (let i = 0; i < 10; i += 1) {
            const res = await page.goto(`/s/${fresh}/q/${i}`);
            if (!res || res.status() >= 400 || page.url().endsWith('/done')) break;
            await shoot(page, dir, `08-question-${i + 1}`);
          }
          for (const [name, path] of [['12-done', `/s/${fresh}/done`]] as const) {
            await page.goto(path);
            await shoot(page, dir, name);
          }

          if (!answered) {
            await answerAll(page, tokenFor(ANSWERED));
            answered = true;
          }
          await page.goto(`/s/${tokenFor(ANSWERED)}`);
          await shoot(page, dir, '14-return');

          await signInAsAuditorA(page);
          await shoot(page, dir, '30-admin-after-sign-in');
          await page.goto('/admin/engagements');
          await shoot(page, dir, '30-admin-engagements');
          const mission = '/admin/engagements/a5555555-4555-4555-8555-555555555555';
          for (const [name, path] of [
            ['31-mission-overview', mission],
            ['32-mission-links', `${mission}/invitations`],
            ['33-mission-answers', `${mission}/answers`],
            ['34-mission-report', `${mission}/report`],
            ['35-mission-settings', `${mission}/settings`],
            ['36-settings-members', '/admin/settings'],
            ['37-settings-data', '/admin/settings/data'],
            ['38-settings-audit', '/admin/settings/audit'],
          ] as const) {
            await page.goto(path);
            await shoot(page, dir, name);
          }
          await context.close();
        }
      }
    }
  });
});
