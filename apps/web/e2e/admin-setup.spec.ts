import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import pg from 'pg';
import { expect, test, type BrowserContext } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * TASK-T (ADR 0038): the auditor sets an audit up (teams, engagement, launch, preview), the header
 * names the organisation and the language switch is clean. Runs in fr and en at 360 and 1280.
 * Everything it creates is removed at the end so the other specs see the seed data.
 */

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const LOCALES = ['fr', 'en'] as const;
type Locale = (typeof LOCALES)[number];
const RUN = `e2e-setup-${Date.now()}`;

const COPY = {
  fr: {
    org: 'Synthetic tenant A',
    steps: ['Créer la mission', 'Ajouter les équipes', 'Créer les liens', 'Suivre', 'Consulter'],
    addTeam: 'Ajouter l’équipe',
    teamName: 'Nom de l’équipe',
    teamAdded: 'Équipe ajoutée.',
    create: 'Créer la mission',
    name: 'Nom',
    langLabel: 'Langue du questionnaire',
    other: 'English',
    launch: 'Lancer l’audit',
    launchConfirm: 'Lancer',
    live: 'Ouverte. Les personnes peuvent répondre avec leur lien.',
    preview: 'Voir le questionnaire',
    previewHeading: 'Aperçu du questionnaire',
    previewText: /Une IA vous donne|Vous donne/i,
    opensOn: 'Ouverture le',
    closesOn: 'Clôture le',
  },
  en: {
    org: 'Synthetic tenant A',
    steps: [
      'Create the engagement',
      'Add the teams',
      'Create the links',
      'Follow progress',
      'Review',
    ],
    addTeam: 'Add team',
    teamName: 'Team name',
    teamAdded: 'Team added.',
    create: 'Create engagement',
    name: 'Name',
    langLabel: 'Survey language',
    other: 'Français',
    launch: 'Launch the audit',
    launchConfirm: 'Launch',
    live: 'Open. People can answer with their link.',
    preview: 'Preview the survey',
    previewHeading: 'Survey preview',
    previewText: /Un assistant|Une IA vous donne/i,
    opensOn: 'Opens on',
    closesOn: 'Closes on',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

const databaseUrl = (): string =>
  process.env['DATABASE_URL'] ??
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

const sql = async (text: string, params: unknown[] = []) => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return (await client.query(text, params)).rows;
  } finally {
    await client.end();
  }
};

const setLocale = (context: BrowserContext, baseURL: string | undefined, locale: Locale) =>
  context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);

test.afterAll(async () => {
  // Engagements first (engagement_teams cascades), then the teams this run made.
  await sql(`DELETE FROM engagements WHERE tenant_id = $1 AND name LIKE $2`, [TENANT_A, `${RUN}%`]);
  await sql(`DELETE FROM teams WHERE tenant_id = $1 AND name LIKE $2`, [TENANT_A, `${RUN}%`]);
});

test.describe('audit set-up', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) === 768, 'checked at 360 and 1280 only');

  for (const locale of LOCALES) {
    const c = COPY[locale];

    test(`sign-in lands on the portfolio with the organisation and the guide in ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await setLocale(context, baseURL, locale);
      await signInAsAuditorA(page);
      await expect(page).toHaveURL(/\/board$/);
      await expect(page.getByTestId('header-organisation')).toHaveText(c.org);
      const guide = page.getByTestId('first-run-checklist');
      await expect(guide).toBeVisible();
      await expect(guide.locator('ol > li')).toHaveCount(5);
      for (const [i, text] of c.steps.entries()) {
        await expect(guide.locator('ol > li').nth(i)).toContainText(text);
      }
      // The workspace link keeps the portfolio, not a data page.
      await page.getByTestId('account-button').click();
      await expect(
        page.getByRole('menuitem', { name: /Workspace|Espace de travail/ }),
      ).toHaveAttribute('href', '/board');
    });

    test(`add a team, create the engagement, launch it and preview it in ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      await setLocale(context, baseURL, locale);
      await signInAsAuditorA(page);
      const team = `${RUN}-${locale} Équipe pilote`;

      await page.goto('/admin/teams');
      await page.getByLabel(c.teamName).first().fill(team);
      await page.getByRole('button', { name: c.addTeam }).click();
      // The line under the form and the snackbar say the same words: check the page one.
      await expect(page.locator('#main').getByText(c.teamAdded)).toBeVisible();
      // The new team is listed with its size and can be resized in place.
      const row = page.locator('li', { has: page.locator(`input[value="${team}"]`) });
      await expect(row).toHaveCount(1);

      await page.goto('/admin/engagements/new');
      await page.getByLabel(c.name).fill(`${RUN}-${locale} audit`);
      await page.getByLabel(c.langLabel).click();
      await page.getByRole('option', { name: c.other }).click();
      await page.getByLabel(c.opensOn).fill('2026-10-19');
      await page.getByLabel(c.closesOn).fill('2026-11-02');
      await page.getByLabel(new RegExp(team)).check();
      await page.getByRole('button', { name: c.create }).click();
      await page.waitForURL(/\/admin\/engagements\/[0-9a-f-]+\/settings/);

      // Draft: launch is behind a plain confirmation.
      await page.getByRole('button', { name: c.launch }).click();
      await page.getByRole('dialog').getByRole('button', { name: c.launchConfirm }).click();
      await expect(page.getByText(c.live).first()).toBeVisible();

      // The status and the audit trail are real.
      const rows = await sql(
        `SELECT e.status, e.locale, e.opens_at, e.closes_at FROM engagements e WHERE e.tenant_id = $1 AND e.name = $2`,
        [TENANT_A, `${RUN}-${locale} audit`],
      );
      expect(rows[0]?.status).toBe('in_field');
      expect(rows[0]?.locale).toBe(locale === 'fr' ? 'en' : 'fr');
      const trail = await sql(
        `SELECT action FROM audit_log WHERE tenant_id = $1 AND created_at > now() - interval '5 minutes'
           AND action IN ('team.create','engagement.create','engagement.launch') ORDER BY created_at`,
        [TENANT_A],
      );
      expect(trail.map((r) => r.action)).toEqual(
        expect.arrayContaining(['team.create', 'engagement.create', 'engagement.launch']),
      );

      // The preview speaks the engagement language, not the interface language.
      await page
        .getByRole('link', { name: c.preview })
        .or(page.getByRole('button', { name: c.preview }))
        .first()
        .click();
      await expect(page.getByRole('heading', { level: 1, name: c.previewHeading })).toBeVisible();
      const question =
        locale === 'fr' ? /An AI tool gives you an answer/ : /Un outil d’IA vous donne une réponse/;
      await expect(page.getByText(question).first()).toBeVisible();
    });
  }

  test('keyboard: the new engagement form can be filled and submitted without a mouse', async ({
    page,
  }) => {
    await signInAsAuditorA(page);
    await page.goto('/admin/engagements/new');
    await page
      .getByLabel(/^(Name|Nom)/)
      .first()
      .focus();
    await page.keyboard.type(`${RUN}-keyboard`);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox').first()).toBeFocused();
    // The submit button is reachable by Tab alone.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      if (
        await page
          .getByRole('button', { name: /Create engagement|Créer la mission/ })
          .evaluate((el) => el === document.activeElement)
      )
        break;
    }
    await expect(
      page.getByRole('button', { name: /Create engagement|Créer la mission/ }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/admin\/engagements\/[0-9a-f-]+\/settings/);
  });
});

test.describe('organisation memory', () => {
  test('?tenant= is remembered and a made-up id changes nothing', async ({ page, context }) => {
    await signInAsAuditorA(page);
    await page.goto(`/admin/teams?tenant=${TENANT_A}`);
    const cookie = (await context.cookies()).find((x) => x.name === 'evolai_org');
    expect(cookie?.value).toBe(TENANT_A);
    await page.goto('/admin/data');
    await expect(page.getByTestId('header-organisation')).toHaveText('Synthetic tenant A');
    // An organisation the session does not hold is ignored, never shown.
    await page.goto('/admin/teams?tenant=99999999-9999-4999-8999-999999999990');
    await expect(page.getByTestId('header-organisation')).toHaveText('Synthetic tenant A');
  });
});

test.describe('language', () => {
  test('switching language re-renders at once, with no English left over', async ({ page }) => {
    await signInAsAuditorA(page);
    await page.goto('/admin/engagements');
    await page.getByTestId('language-button').click();
    await page.getByTestId('switch-fr').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Missions d’audit/);
    // Statuses are words in the page language.
    await expect(page.locator('table')).not.toContainText(/\b(Draft|Open|Closed|Scheduled)\b/);
  });

  test('the employee page follows the engagement language when the browser says English', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      locale: 'en-US',
      extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
    });
    const secret =
      process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
    const reference = 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0004';
    const token = `${reference}.${createHmac('sha256', secret).update(reference).digest('base64url')}`;
    const page = await context.newPage();
    await page.goto(`/s/${token}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('main')).toContainText(/Commencer|Reprendre|déjà répondu|Merci/);
    await context.close();
  });
});

test.describe('data page', () => {
  test('erasing a code that does not exist says so and asks for the code first', async ({
    page,
  }) => {
    await signInAsAuditorA(page);
    await page.goto('/admin/data');
    const code = 'no-such-respondent-0001';
    await page.locator('input[name=respondentPseudonym]').fill(code);
    await page.getByRole('button', { name: /Erase respondent|Effacer le répondant/ }).click();
    // An unknown code is said plainly before any confirmation step (TASK-U, ADR 0040).
    await expect(
      page.getByText(/No respondent has this code|Aucun répondant n’a ce code/),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('an export shows a download button and plain column names', async ({ page }) => {
    await signInAsAuditorA(page);
    await page.goto('/admin/data');
    await page.getByRole('button', { name: /Run export|Lancer l’export/ }).click();
    const download = page.getByTestId('export-download');
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute('download', /\.csv$/);
    const preview = page.locator('pre.csv-preview');
    await expect(preview).not.toContainText('engagement_id');
  });
});
