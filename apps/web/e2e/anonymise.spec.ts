import { execFileSync } from 'node:child_process';
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
          data: { token, index: 5, choice: '1_3h', comment },
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

  test('the backfill anonymises stored text: dry run first, then apply, then nothing left to do', async () => {
    const [target] = await query<{ id: string; submission_id: string; question_item_id: string }>(
      `SELECT a.id, a.submission_id, a.question_item_id FROM answers a
         JOIN invitations i ON i.token_reference = $1
         JOIN submissions s ON s.invitation_id = i.id AND s.id = a.submission_id
        WHERE a.sequence = 5`,
      [REFERENCE],
    );
    expect(target).toBeDefined();
    await query(`UPDATE submissions SET locale = 'fr' WHERE id = $1`, [target?.submission_id]);
    // A legacy row written before TASK-W: raw text in the value and in the rationale column.
    const legacy = `Legacy note from ${TYPED.person}, ${TYPED.email}, ${TYPED.phone}`;
    await query(`UPDATE answers SET value_json = $2, rationale = $3 WHERE id = $1`, [
      target?.id,
      JSON.stringify({ kind: 'scenario_choice', choice: 'verify_source', rationale: legacy }),
      legacy,
    ]);
    const run = (...args: string[]): string =>
      execFileSync('node', ['--import', 'tsx', 'scripts/anonymise-backfill.ts', ...args], {
        cwd: join(process.cwd(), '..', '..', 'services', 'ai'),
        env: { ...process.env, DATABASE_URL: databaseUrl(), DATABASE_URL_UNPOOLED: '' },
        encoding: 'utf8',
      });
    const changed = (out: string): number => Number(/total changed=(\d+)/.exec(out)?.[1] ?? -1);

    const dry = run();
    expect(dry).toContain('dry run');
    expect(changed(dry)).toBeGreaterThanOrEqual(1);
    for (const secret of Object.values(TYPED)) expect(dry).not.toContain(secret);
    const [before] = await query<{ rationale: string }>(
      `SELECT rationale FROM answers WHERE id = $1`,
      [target?.id],
    );
    expect(before?.rationale).toBe(legacy);

    const applied = run('--apply');
    expect(applied).toContain('APPLIED');
    expect(changed(applied)).toBeGreaterThanOrEqual(1);
    const [after] = await query<{ rationale: string; value_json: { rationale: string } }>(
      `SELECT rationale, value_json FROM answers WHERE id = $1`,
      [target?.id],
    );
    expect(after?.rationale).toBe('Legacy note from [nom], [email], [téléphone]');
    expect(after?.value_json.rationale).toBe(after?.rationale);
    const audit = await query<{ payload_json: Record<string, number> }>(
      `SELECT payload_json FROM audit_log WHERE action = 'answers.anonymise' AND tenant_id = $1`,
      [tenantId],
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);

    expect(changed(run('--apply'))).toBe(0);
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

  test('rejects an over-long comment without echoing it', async ({ request }) => {
    const res = await request.post('/api/answer', {
      data: { token, index: 5, choice: '1_3h', comment: 'x'.repeat(2001) },
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
