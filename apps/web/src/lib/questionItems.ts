import { PILOT_QUESTIONNAIRE, toItemRow } from '@evolai/contracts';
import { withServiceAccount } from './db';

/**
 * The `question_items` row id for a question code in one tenant, creating the row from the
 * questionnaire definition on first use (TASK-Z2). Answers reference these rows; creating them
 * here means a questionnaire edited in the repo works as soon as it is deployed, with no manual
 * seeding step. Existing rows are never changed (a question's text is frozen once answered).
 */
export const ensureQuestionItemId = async (
  tenantId: string,
  code: string,
): Promise<string | null> => {
  const def = PILOT_QUESTIONNAIRE.questions.find((q) => q.code === code);
  return withServiceAccount(async (client) => {
    const found = await client.query<{ id: string }>(
      `SELECT id FROM question_items WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [tenantId, code],
    );
    if (found.rows[0]) return found.rows[0].id;
    if (!def) return null;
    const row = toItemRow(def);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO question_items (id, tenant_id, axis, code, kind, locale, prompt, helper,
                                   options_json, scoring_json, sensitivity, retestable)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id, code) DO UPDATE SET code = EXCLUDED.code
       RETURNING id`,
      [
        tenantId,
        row.axis,
        row.code,
        row.kind,
        row.locale,
        row.prompt,
        row.helper,
        JSON.stringify(row.options),
        JSON.stringify(row.scoring),
        row.sensitivity,
        row.retestable,
      ],
    );
    return inserted.rows[0]?.id ?? null;
  });
};
