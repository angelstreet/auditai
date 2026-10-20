/**
 * Backfill: anonymise free-text answers stored before TASK-W (ADR 0044).
 *
 * Runs the same `anonymise()` the answer route uses over `answers.value_json` (short text and
 * scenario rationale), `answers.rationale` and `submissions.end_comment`, tenant by tenant. Dry
 * run by default: nothing is written without `apply`. Idempotent. The report holds counts only;
 * no answer text is ever returned, printed or put in an error or in the audit log.
 */
import pg from 'pg';
import { anonymise, type AnonymiseLocale } from '@evolai/domain';

/** The system user seeded by migration 0014, used as actor for CLI work. */
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

const SERVICE_ON = `SELECT set_config('app.is_service_account', 'on', true)`;

export interface TenantReport {
  readonly tenantId: string;
  readonly scanned: number;
  readonly changed: number;
}

export interface BackfillReport {
  readonly applied: boolean;
  readonly tenants: ReadonlyArray<TenantReport>;
}

interface AnswerRow {
  id: string;
  value_json: unknown;
  rationale: string | null;
  locale: string;
}

const run = (text: string, locale: AnonymiseLocale, terms: ReadonlyArray<string>): string =>
  anonymise(text, { locale, terms }).text;

/** Anonymised copy of a stored answer value; `null` when it holds no free text. */
export const anonymiseValueJson = (
  value: unknown,
  locale: AnonymiseLocale,
  terms: ReadonlyArray<string>,
): unknown => {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v['kind'] === 'short_text' && typeof v['text'] === 'string') {
    return { ...v, text: run(v['text'], locale, terms) };
  }
  if (v['kind'] === 'scenario_choice' && typeof v['rationale'] === 'string') {
    return { ...v, rationale: run(v['rationale'], locale, terms) };
  }
  return null;
};

export interface BackfillOptions {
  readonly databaseUrl: string;
  readonly apply: boolean;
}

export const runAnonymiseBackfill = async (options: BackfillOptions): Promise<BackfillReport> => {
  const client = new pg.Client({ connectionString: options.databaseUrl });
  await client.connect();
  const tenants: TenantReport[] = [];
  try {
    await client.query('BEGIN');
    await client.query(SERVICE_ON);
    const ids = (await client.query<{ id: string }>(`SELECT id FROM tenants ORDER BY id`)).rows;
    await client.query('COMMIT');

    for (const { id: tenantId } of ids) {
      await client.query('BEGIN');
      try {
        await client.query(SERVICE_ON);
        const terms = (
          await client.query<{ term: string }>(
            `SELECT term FROM ai_redaction_terms WHERE tenant_id = $1`,
            [tenantId],
          )
        ).rows.map((r) => r.term);

        let scanned = 0;
        let changed = 0;
        const answers = await client.query<AnswerRow>(
          `SELECT a.id, a.value_json, a.rationale, s.locale
             FROM answers a JOIN submissions s ON s.id = a.submission_id
            WHERE a.tenant_id = $1 FOR UPDATE OF a`,
          [tenantId],
        );
        for (const row of answers.rows) {
          const locale: AnonymiseLocale = row.locale === 'fr' ? 'fr' : 'en';
          const nextValue = anonymiseValueJson(row.value_json, locale, terms);
          const nextRationale = row.rationale === null ? null : run(row.rationale, locale, terms);
          const hasText = nextValue !== null || row.rationale !== null;
          if (!hasText) continue;
          scanned += 1;
          const valueChanged =
            nextValue !== null && JSON.stringify(nextValue) !== JSON.stringify(row.value_json);
          const rationaleChanged = nextRationale !== row.rationale;
          if (!valueChanged && !rationaleChanged) continue;
          changed += 1;
          if (options.apply) {
            await client.query(
              `UPDATE answers
                  SET value_json = $2, rationale = $3, updated_at = now()
                WHERE id = $1`,
              [row.id, valueChanged ? nextValue : row.value_json, nextRationale],
            );
          }
        }

        const comments = await client.query<{ id: string; end_comment: string; locale: string }>(
          `SELECT id, end_comment, locale FROM submissions
            WHERE tenant_id = $1 AND end_comment IS NOT NULL FOR UPDATE`,
          [tenantId],
        );
        for (const row of comments.rows) {
          scanned += 1;
          const next = run(row.end_comment, row.locale === 'fr' ? 'fr' : 'en', terms);
          if (next === row.end_comment) continue;
          changed += 1;
          if (options.apply) {
            await client.query(
              `UPDATE submissions SET end_comment = $2, updated_at = now() WHERE id = $1`,
              [row.id, next],
            );
          }
        }

        if (options.apply && changed > 0) {
          await client.query(
            `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
             VALUES ($1, $2, 'answers.anonymise', 'tenant', $1, $3)`,
            [tenantId, SYSTEM_ACTOR_ID, { scanned, changed }],
          );
        }
        await client.query('COMMIT');
        tenants.push({ tenantId, scanned, changed });
      } catch {
        await client.query('ROLLBACK');
        // The message could quote row data; say only which tenant failed.
        throw new Error(`anonymise backfill failed for tenant ${tenantId}; nothing written for it`);
      }
    }
  } finally {
    await client.end();
  }
  return { applied: options.apply, tenants };
};
