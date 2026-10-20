import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import pg from 'pg';

/**
 * TASK-W (ADR 0044): free text is anonymised before it is stored. The spec posts a comment full
 * of synthetic personal data through the real answer route, in French and in English, then scans
 * the database for what was typed. All values are obviously fake.
 */

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const REFERENCE = 'inv-synthetic-pilot-001';
const token = `${REFERENCE}.${createHmac('sha256', SECRET).update(REFERENCE).digest('base64url')}`;

const TYPED = {
  email: 'jean.dupont.synthetic@synthetic.invalid',
  phone: '06 12 34 56 78',
  person: 'Jean Dupont',
  hidden: 'Zorglub Demo',
  url: 'https://intranet.synthetic.invalid/secret-page',
};
const COMMENT = (lead: string): string =>
  `${lead} ${TYPED.person} (${TYPED.email}, ${TYPED.phone}) via ${TYPED.url} for ${TYPED.hidden}, we use Excel.`;

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

const SCANNED_TABLES = ['answers', 'submissions', 'audit_log', 'analyses', 'invitations'];

test.describe('free text is anonymised when saved', () => {
  let tenantId = '';
  let termId = '';

  test.beforeAll(async () => {
    const [inv] = await query<{ tenant_id: string }>(
      `SELECT tenant_id FROM invitations WHERE token_reference = $1`,
      [REFERENCE],
    );
    tenantId = inv?.tenant_id ?? '';
    const [term] = await query<{ id: string }>(
      `INSERT INTO ai_redaction_terms (tenant_id, term) VALUES ($1, $2)
       ON CONFLICT (tenant_id, term) DO UPDATE SET term = EXCLUDED.term RETURNING id`,
      [tenantId, TYPED.hidden.toLowerCase()],
    );
    termId = term?.id ?? '';
  });

  test.afterAll(async () => {
    if (termId) await query(`DELETE FROM ai_redaction_terms WHERE id = $1`, [termId]);
    await query(
      `UPDATE submissions SET locale = 'fr' WHERE invitation_id IN
                   (SELECT id FROM invitations WHERE token_reference = $1)`,
      [REFERENCE],
    );
  });

  for (const locale of ['fr', 'en'] as const) {
    test(`stores only the anonymised text (${locale})`, async ({ request }) => {
      const post = (comment: string) =>
        request.post('/api/answer', {
          data: { token, index: 5, choice: 'verify_source', comment },
        });
      // The first call creates the submission; then set its language like the engagement's.
      expect((await post('hello')).ok()).toBe(true);
      await query(
        `UPDATE submissions SET locale = $2 WHERE invitation_id IN
           (SELECT id FROM invitations WHERE token_reference = $1)`,
        [REFERENCE, locale],
      );
      const res = await post(COMMENT(locale === 'fr' ? 'Parlez à' : 'Please talk to'));
      expect(res.ok()).toBe(true);

      const rows = await query<{ value_json: { rationale: string | null } }>(
        `SELECT a.value_json FROM answers a JOIN invitations i ON i.token_reference = $1
           JOIN submissions s ON s.invitation_id = i.id AND s.id = a.submission_id
          WHERE a.sequence = 5`,
        [REFERENCE],
      );
      const stored = rows[0]?.value_json.rationale ?? '';
      const [phone, link, name] =
        locale === 'fr' ? ['[téléphone]', '[lien]', '[nom]'] : ['[phone]', '[link]', '[name]'];
      for (const expected of ['[email]', phone, link, name, '[organisation]', 'Excel']) {
        expect(stored).toContain(expected);
      }

      // Nothing typed may remain anywhere in the database.
      for (const table of SCANNED_TABLES) {
        for (const secret of Object.values(TYPED)) {
          const hits = await query<{ n: string }>(
            `SELECT count(*)::text AS n FROM ${table} t WHERE t::text ILIKE $1`,
            [`%${secret}%`],
          );
          expect(hits[0]?.n, `${table} still holds typed text`).toBe('0');
        }
      }
    });
  }

  test('rejects an over-long comment without echoing it', async ({ request }) => {
    const res = await request.post('/api/answer', {
      data: { token, index: 5, choice: 'verify_source', comment: 'x'.repeat(2001) },
    });
    expect(res.status()).toBe(400);
    expect(await res.text()).not.toContain('xxxx');
  });
});

test.describe('privacy notice wording', () => {
  test.use({ locale: 'en-US' });
  test('says free text is anonymised before saving', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText(/hidden automatically before the answer is saved/)).toBeVisible();
  });
});
