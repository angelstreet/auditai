import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

/**
 * TASK-S (ADR 0039): the team referent shares links, sends one generic reminder and follows
 * progress, and never learns who answered. The synthetic client C and its referent come from
 * infra/db/scripts/seed-synthetic-client.mjs. Phone (360) and desktop (1280), fr and en.
 *
 * The isolation check flips invitation states in the database and asserts that every page, export
 * and sheet the referent can reach is unchanged, apart from the coarse band on Home.
 */

const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const CONTACT = 'Demo Contact, 01 00 00 00 00';
const LOCALES = ['fr', 'en'] as const;
const COPY = {
  fr: {
    reminder: /si vous n’avez pas encore répondu/,
    message: /anonyme/,
    other: /anonymous/,
    otherLabel: 'English',
    answered: (done: number, total: number) => `${done} sur ${total} ont répondu`,
  },
  en: {
    reminder: /if you have not answered the survey yet/,
    message: /anonymous/,
    other: /anonyme/,
    otherLabel: 'Français',
    answered: (done: number, total: number) => `${done} of ${total} answered`,
  },
} as const;

const databaseUrl = (): string =>
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

const query = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
};

const engagementC = async (): Promise<{ id: string; tenant: string }> => {
  const [row] = await query<{ id: string; tenant_id: string }>(
    `SELECT e.id, e.tenant_id FROM engagements e JOIN tenants t ON t.id = e.tenant_id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!row) throw new Error('synthetic client C is not seeded');
  return { id: row.id, tenant: row.tenant_id };
};

/** Open the survey, close in `days`, name a contact. */
const setEngagement = async (id: string, status: string, closeInDays: number | null) =>
  query(
    `UPDATE engagements SET status = $2,
            closes_at = CASE WHEN $3::int IS NULL THEN NULL
                             ELSE (current_date + $3::int + interval '1 day' - interval '1 second') AT TIME ZONE 'UTC' END,
            privacy_json = privacy_json || jsonb_build_object('contact', $4::text)
      WHERE id = $1`,
    [id, status, closeInDays, CONTACT],
  );

const setStates = async (engagementId: string, submitted: number, opened: number) => {
  await query(
    `UPDATE invitations SET status = 'pending' WHERE engagement_id = $1 AND status <> 'revoked'`,
    [engagementId],
  );
  await query(
    `UPDATE invitations SET status = 'submitted', last_activity_on = current_date
      WHERE id IN (SELECT id FROM invitations WHERE engagement_id = $1 AND status = 'pending'
                    ORDER BY random() LIMIT $2)`,
    [engagementId, submitted],
  );
  await query(
    `UPDATE invitations SET status = 'opened', last_activity_on = current_date
      WHERE id IN (SELECT id FROM invitations WHERE engagement_id = $1 AND status = 'pending'
                    ORDER BY random() LIMIT $2)`,
    [engagementId, opened],
  );
};

const setLocale = (context: BrowserContext, baseURL: string | undefined, locale: string) =>
  context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);

const signIn = async (page: Page, who: { email: string; password: string }, expectPath: RegExp) => {
  await page.goto('/login');
  await page.fill('input[name=email]', who.email);
  await page.fill('input[name=password]', who.password);
  await page.click('button[type=submit]');
  await page.waitForURL(expectPath);
};

const axe = async (page: Page, label: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(blocking, `${label}: axe serious/critical`).toEqual([]);
};

const noHorizontalScroll = async (page: Page, label: string) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
};

/** Everything a referent can read about links: the list, both CSV variants, the QR sheet. */
const referentLinkView = async (page: Page) => {
  await page.goto('/client/invitations');
  const list = await page.getByTestId('client-link').allTextContents();
  const csv = await (await page.request.get('/client/invitations/export')).text();
  const csvKind = await (
    await page.request.get('/client/invitations/export?kind=reminders')
  ).text();
  const sheet = await (await page.request.get('/client/invitations/sheet')).text();
  const qrCount = (sheet.match(/src="data:image\/png/g) ?? []).length;
  const reminder = await page.getByTestId('client-reminder').innerText();
  return { list, csv, csvKind, qrCount, reminder };
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'phone and desktop only (TASK-S)');
});

test.afterAll(async () => {
  const eng = await engagementC();
  await setEngagement(eng.id, 'draft', null);
  await setStates(eng.id, 0, 0);
});

for (const locale of LOCALES) {
  test(`referent shares links and reminds, and never sees who answered (${locale})`, async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const copy = COPY[locale];
    const phone = testInfo.project.name === 'mobile-360';
    const eng = await engagementC();
    // Closes in 8 days: suggested reminders at day 1 and day 6, so nothing is due today.
    await setEngagement(eng.id, 'in_field', 8);
    await setStates(eng.id, 0, 0);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: baseURL as string,
    });
    await setLocale(context, baseURL, locale);
    await signIn(page, REFERENT, /\/client$/);

    // Create links, then they are listed with a copy button each.
    await page.getByTestId('client-tab-invitations').click();
    await page.waitForURL(/\/client\/invitations$/);
    await page.fill('input[name=count]', '6');
    await page.getByTestId('client-create-links').click();
    await expect(page.getByTestId('client-create-done')).toBeVisible();
    await page.reload();
    const rows = page.getByTestId('client-link-row');
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId('client-copy-link')).toHaveCount(n);
    await axe(page, `${locale} invitations`);
    await noHorizontalScroll(page, `${locale} invitations`);

    // Copy one link with the keyboard, then copy all.
    const first = (await page.getByTestId('client-link').first().textContent()) ?? '';
    expect(first).toMatch(/^https?:\/\/[^/]+\/s\/[\w.-]+$/);
    await page.getByTestId('client-copy-link').first().focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first);
    await page.getByTestId('client-copy-all').click();
    const all = (await page.evaluate(() => navigator.clipboard.readText())).split('\n');
    expect(all).toHaveLength(n);
    expect(all[0]).toBe(first);

    // The ready-made message: closing date, contact, anonymous; editable; other language.
    const message = page.getByTestId('client-message-text');
    await expect(message).toHaveValue(copy.message);
    await expect(message).toHaveValue(/Demo Contact/);
    await message.fill('Demo edited message');
    await page.getByTestId('client-link-more').first().focus();
    await page.keyboard.press('Enter');
    const email = page.getByTestId('client-share-email');
    await expect(email).toBeVisible();
    const mail = (await email.getAttribute('href')) ?? '';
    expect(mail.startsWith('mailto:?subject=')).toBe(true);
    expect(decodeURIComponent(mail)).toContain(`Demo edited message\n\n${first}`);
    const wa = (await page.getByTestId('client-share-whatsapp').getAttribute('href')) ?? '';
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa)).toContain(first);
    await page.keyboard.press('Escape');
    await expect(email).toBeHidden();
    await page.getByRole('button', { name: copy.otherLabel }).click();
    await expect(message).toHaveValue(copy.other);

    // One generic reminder, no link and no list of people.
    const reminder = page.getByTestId('client-reminder');
    await expect(page.getByTestId('client-reminder-text')).toHaveValue(copy.reminder);
    await expect(page.getByTestId('client-reminder-text')).not.toHaveValue(/https?:\/\//);
    await expect(reminder.locator('li, a[href*="/s/"]')).toHaveCount(0);
    await expect(page.getByTestId('client-reminder-when')).toContainText(/\d{4}/);

    // Isolation: flip states; the referent's link view does not change at all.
    const before = await referentLinkView(page);
    expect(before.csvKind).toBe(before.csv);
    expect(before.qrCount).toBe(n);
    expect(before.csv.trim().split(/\r?\n/)[0]).toBe('link,team');
    await setStates(eng.id, 2, 2);
    const after = await referentLinkView(page);
    expect(after).toEqual(before);

    // Home: below five answers, a coarse band only; no per-person words, no number of answers.
    await page.goto('/client');
    const team = page.getByTestId('client-team-progress');
    await expect(team).toHaveAttribute('data-kind', 'band');
    await expect(page.getByTestId('client-team-answered')).not.toContainText(/\d/);
    await expect(page.getByTestId('client-closing')).toContainText(/8/);
    // Nothing is due today: the next step is to share, not to remind.
    await expect(page.getByTestId('client-cta-share')).toBeVisible();
    await expect(page.getByTestId('client-cta-remind')).toHaveCount(0);
    await axe(page, `${locale} home (band)`);
    await noHorizontalScroll(page, `${locale} home`);

    // From five answers: "5 of N answered" and a bar.
    await setStates(eng.id, 5, 0);
    await page.reload();
    await expect(team).toHaveAttribute('data-kind', 'exact');
    const [{ invited } = { invited: 0 }] = await query<{ invited: number }>(
      `SELECT count(*)::int AS invited FROM invitations WHERE engagement_id = $1 AND status <> 'revoked'`,
      [eng.id],
    );
    await expect(page.getByTestId('client-team-answered')).toHaveText(copy.answered(5, invited));
    await expect(team.getByRole('progressbar')).toBeVisible();

    // A reminder day (two days before closing, links sent a week ago): the Home call to action
    // appears and scrolls to the reminder.
    await query(
      `UPDATE invitations SET created_at = least(created_at, now() - interval '7 days')
        WHERE engagement_id = $1`,
      [eng.id],
    );
    await setEngagement(eng.id, 'in_field', 2);
    await page.reload();
    const cta = page.getByTestId('client-cta-remind');
    await expect(cta).toBeVisible();
    await cta.click();
    await page.waitForURL(/\/client\/invitations#reminder$/);
    await expect(page.getByTestId('client-reminder')).toBeInViewport();

    // Phone details: tabs not clipped, count field full width, body text 16 px.
    const tabsClipped = await page
      .locator('[data-testid^="client-tab-"]')
      .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
    expect(tabsClipped).toBe(0);
    const bodySize = await page
      .getByTestId('client-links')
      .locator('p')
      .first()
      .evaluate((e) => getComputedStyle(e).fontSize);
    expect(bodySize).toBe('16px');
    if (phone) {
      const field = await page.locator('input[name=count]').boundingBox();
      const form = await page.getByTestId('client-create-form').boundingBox();
      expect(field && form ? field.width / form.width : 0).toBeGreaterThan(0.8);
    }
  });
}

for (const locale of LOCALES) {
  test(`referent home explains, copies with a fallback and shares (${locale})`, async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const phone = testInfo.project.name === 'mobile-360';
    const eng = await engagementC();
    await setEngagement(eng.id, 'in_field', 8);
    await setStates(eng.id, 0, 0);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: baseURL as string,
    });
    await setLocale(context, baseURL, locale);
    await signIn(page, REFERENT, /\/client$/);

    // The logo goes to the team space, not to the public welcome page.
    await expect(page.locator('a.home-link')).toHaveAttribute('href', '/client');

    // "How it works": what the team is asked, how long, who sees what, three steps.
    const how = page.getByTestId('client-how');
    await expect(how).toBeVisible();
    await expect(how).toContainText(/\d+/);
    await expect(how.locator('ol li')).toHaveCount(3);

    // Links to copy, then the home reminder: a date and one button that copies the message.
    await page.getByTestId('client-tab-invitations').click();
    await page.waitForURL(/\/client\/invitations$/);
    await page.fill('input[name=count]', '2');
    await page.getByTestId('client-create-links').click();
    await expect(page.getByTestId('client-create-done')).toBeVisible();
    await page.goto('/client');
    const reminder = page.getByTestId('client-home-reminder');
    await expect(reminder).toBeVisible();
    await expect(page.getByTestId('client-home-reminder-date')).toContainText(
      /\d{4}|aujourd|today/,
    );
    await page.getByTestId('client-home-reminder-copy').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      COPY[locale].reminder,
    );
    await axe(page, `${locale} home (how it works)`);
    await noHorizontalScroll(page, `${locale} home (how it works)`);

    // Report tab: what will be received, when, and how to forward it.
    await page.goto('/client/report');
    await expect(page.getByTestId('client-report-info')).toBeVisible();
    await expect(page.getByTestId('client-report-when')).toContainText(/\d{4}/);
    await expect(page.getByTestId('client-report-info')).toContainText(/PDF/);
    await axe(page, `${locale} report tab`);
    await noHorizontalScroll(page, `${locale} report tab`);

    // The clipboard is refused (some phones): the full link shows in a selectable field.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('refused')) },
        configurable: true,
      });
      document.execCommand = () => false;
      (navigator as unknown as { share: (d: unknown) => Promise<void> }).share = async (d) => {
        (window as unknown as { shared: unknown }).shared = d;
      };
    });
    await page.goto('/client/invitations');
    const link = ((await page.getByTestId('client-link').first().textContent()) ?? '').trim();
    expect(link).toMatch(/^https?:\/\/[^/]+\/s\/[\w.-]+$/);
    // The full link is on screen (it wraps), never cut with an ellipsis.
    const cut = await page
      .getByTestId('client-link')
      .first()
      .evaluate((e) => e.scrollWidth > e.clientWidth + 1);
    expect(cut).toBe(false);
    await page.getByTestId('client-copy-link').first().click();
    const fallback = page.getByTestId('copy-fallback-text');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveValue(link);
    // Let the dialog's fade-in finish: axe reads a half-transparent label as low contrast.
    await page.waitForTimeout(600);
    await axe(page, `${locale} copy fallback dialog`);
    await page.keyboard.press('Escape');
    await expect(fallback).toBeHidden();

    // Native share sheet when the device has one.
    await page.getByTestId('client-share-link').first().click();
    const shared = await page.evaluate(
      () => (window as unknown as { shared?: { text: string } }).shared?.text ?? '',
    );
    expect(shared).toContain(link);
    if (phone) await noHorizontalScroll(page, `${locale} invitations (phone)`);
  });
}

test('the mission is listed and the Links tab counts agree with the database', async ({ page }) => {
  const eng = await engagementC();
  await setEngagement(eng.id, 'in_field', 8);
  await setStates(eng.id, 2, 2);
  const [db] = await query<{ invited: number; opened: number; revoked: number; created: number }>(
    `SELECT count(*) FILTER (WHERE status <> 'revoked')::int AS invited,
            count(*) FILTER (WHERE status IN ('opened','in_progress','submitted'))::int AS opened,
            count(*) FILTER (WHERE status = 'revoked')::int AS revoked,
            count(*)::int AS created
       FROM invitations WHERE engagement_id = $1`,
    [eng.id],
  );
  await signIn(page, OWNER, /\/(admin\/|board)/);
  // The missions list shows the answers; the link counts live in the mission's Links tab.
  await page.goto(`/admin/engagements?tenant=${eng.tenant}`);
  await expect(page.locator(`a[href*="${eng.id}"]:visible`).first()).toBeVisible();
  await page.goto(`/admin/engagements/${eng.id}/invitations?tenant=${eng.tenant}`);
  const counts = await page.getByTestId('invitation-counts').innerText();
  expect(counts).toContain(String(db?.created));
  expect(counts).toMatch(new RegExp(`\\b${db?.invited}\\b`));
  // The same links, in full, with a copy button each.
  await expect(page.getByTestId('invite-link-full').first()).toContainText(/\/s\//);
  await expect(page.getByTestId('invite-copy-all')).toBeVisible();
});

test('the auditor still sees per-link status; the referent cannot reach it', async ({ page }) => {
  const eng = await engagementC();
  await signIn(page, REFERENT, /\/client$/);
  for (const path of [
    `/admin/engagements/${eng.id}/invitations?tenant=${eng.tenant}`,
    `/admin/engagements/${eng.id}/answers?tenant=${eng.tenant}`,
    `/admin/engagements/${eng.id}/answers/export?tenant=${eng.tenant}`,
    `/admin/invitations/export?tenant=${eng.tenant}&engagement=${eng.id}&kind=reminders`,
    `/admin/invitations/sheet?tenant=${eng.tenant}&engagement=${eng.id}`,
  ]) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect([303, 307, 403], path).toContain(res.status());
  }
  const api = await page.request.get(
    `/api/admin/invitations?tenant=${eng.tenant}&engagement=${eng.id}`,
  );
  expect(api.status()).toBe(403);
});

test('view as: the banner collapses to one line on phones after the first page', async ({
  page,
}, testInfo) => {
  const phone = testInfo.project.name === 'mobile-360';
  await signIn(page, OWNER, /\/(admin\/|board)/);
  await page.getByTestId('account-button').click();
  await page.getByTestId('view-as-persona').click();
  await page.waitForURL(/\/client$/);
  const banner = page.getByTestId('view-as-banner');
  await expect(banner).toHaveAttribute('data-compact', 'false');
  await page.getByTestId('client-tab-invitations').click();
  await page.waitForURL(/\/client\/invitations$/);
  await page.reload();
  await expect(banner).toHaveAttribute('data-compact', 'true');
  const height = (await banner.boundingBox())?.height ?? 999;
  if (phone) {
    expect(height).toBeLessThan(64);
    const details = page.getByTestId('view-as-details');
    await details.click();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#view-as-details')).toBeVisible();
  } else {
    await expect(page.getByTestId('view-as-details')).toBeHidden();
  }
  await axe(page, 'compact banner');
  await page.getByRole('button', { name: /Revenir à ma vue|Back to my view/ }).click();
  await page.waitForURL(/\/admin\//);
});
