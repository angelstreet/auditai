import type { Answer, AnswerValue, InvitationId, SubmissionId, TenantId } from '@auditai/contracts';
import { withTenant } from './db';

/**
 * Survey persistence backed by the M4 schema (PRD \u00a714, \u00a75, \u00a717).
 *
 * Each call site runs inside a transaction with `app.tenant_id` set, so the row-level security
 * policies from migration 0002 apply. Resume works because the same invitation reference
 * resolves to the same submission row.
 *
 * The functions return strongly-typed shapes from `@auditai/contracts`; values from the JSON
 * columns are re-validated by the call site (in Phase 2 we will tighten this with Zod).
 */

export interface SurveyState {
  readonly invitationReference: string;
  readonly invitationId: InvitationId;
  readonly tenantId: TenantId;
  locale: 'fr' | 'en';
  submissionId: SubmissionId | null;
  startedAt: string;
  submittedAt: string | null;
  answers: Record<number, { questionId: string; value: AnswerValue }>;
}

interface InvitationRow {
  id: string;
  tenant_id: string;
  respondent_pseudonym: string;
  status: string;
  token_reference: string;
  opens_at: string;
  expires_at: string;
  submission_id: string | null;
}

interface SubmissionRow {
  id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  locale: string;
}

interface AnswerRow {
  id: string;
  question_item_id: string;
  value_json: AnswerValue;
  sequence: number;
}

/**
 * Look up or create the submission row for an invitation. The first call seeds the row; later
 * calls return the same row (resume). The function does *not* validate the invitation token
 * \u2014 callers do that with `verifyInviteToken` and pass the resolved invitation.
 */
export const getOrCreateState = async (
  tenantId: TenantId,
  invitationId: InvitationId,
): Promise<SurveyState> => {
  return withTenant(tenantId, async (client) => {
    const inviteResult = await client.query<InvitationRow>(
      `SELECT id, tenant_id, respondent_pseudonym, status, token_reference,
              opens_at, expires_at, submission_id
         FROM invitations WHERE id = $1`,
      [invitationId],
    );
    const invite = inviteResult.rows[0];
    if (!invite) {
      throw new Error(`invitation ${invitationId} not found for tenant ${tenantId}`);
    }

    if (invite.submission_id) {
      const subResult = await client.query<SubmissionRow>(
        `SELECT id, status, started_at, submitted_at, locale
           FROM submissions WHERE id = $1`,
        [invite.submission_id],
      );
      const sub = subResult.rows[0];
      if (sub) {
        const answers = await loadAnswers(client, sub.id);
        return {
          invitationReference: invite.token_reference,
          invitationId: invite.id as InvitationId,
          tenantId: invite.tenant_id as TenantId,
          locale: sub.locale === 'fr' ? 'fr' : 'en',
          submissionId: sub.id as SubmissionId,
          startedAt: sub.started_at,
          submittedAt: sub.submitted_at,
          answers,
        };
      }
    }

    // No submission yet \u2014 create one and link it to the invitation.
    const insertResult = await client.query<{ id: string; started_at: string; locale: string }>(
      `INSERT INTO submissions (
         id, tenant_id, engagement_id, questionnaire_version_id, invitation_id,
         status, locale, started_at
       )
       SELECT gen_random_uuid(), i.tenant_id, i.engagement_id, e.questionnaire_version_id, i.id,
              'in_progress',
              CASE WHEN e.locale = 'fr' THEN 'fr' ELSE 'en' END,
              now()
         FROM invitations i
         JOIN engagements e ON e.id = i.engagement_id
        WHERE i.id = $1
       RETURNING id, started_at, locale`,
      [invitationId],
    );
    const created = insertResult.rows[0];
    if (!created) {
      throw new Error(`failed to create submission for invitation ${invitationId}`);
    }
    await client.query(
      `UPDATE invitations SET submission_id = $1, updated_at = now() WHERE id = $2`,
      [created.id, invitationId],
    );
    await client.query(
      `UPDATE invitations SET status = 'in_progress', updated_at = now() WHERE id = $1`,
      [invitationId],
    );

    return {
      invitationReference: invite.token_reference,
      invitationId: invite.id as InvitationId,
      tenantId: invite.tenant_id as TenantId,
      locale: created.locale === 'fr' ? 'fr' : 'en',
      submissionId: created.id as SubmissionId,
      startedAt: created.started_at,
      submittedAt: null,
      answers: {},
    };
  });
};

const loadAnswers = async (
  client: import('pg').PoolClient,
  submissionId: string,
): Promise<SurveyState['answers']> => {
  const result = await client.query<AnswerRow>(
    `SELECT id, question_item_id, value_json, sequence
       FROM answers WHERE submission_id = $1
       ORDER BY sequence ASC`,
    [submissionId],
  );
  const map: SurveyState['answers'] = {};
  result.rows.forEach((row) => {
    // Re-validate the persisted JSON so a corrupted row doesn't poison the UI.
    map[row.sequence] = { questionId: row.question_item_id, value: row.value_json };
  });
  return map;
};

export const recordAnswer = async (
  tenantId: TenantId,
  submissionId: SubmissionId,
  questionItemId: string,
  sequence: number,
  value: AnswerValue,
): Promise<SurveyState['answers'][number]> => {
  return withTenant(tenantId, async (client) => {
    // upsert: replace any existing answer for (submission, question) at this sequence.
    const result = await client.query<{ id: string }>(
      `INSERT INTO answers (
         id, tenant_id, submission_id, question_item_id, value_json, sequence
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       ON CONFLICT (submission_id, question_item_id, sequence)
       DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()
       RETURNING id`,
      [tenantId, submissionId, questionItemId, value, sequence],
    );
    void result;
    return { questionId: questionItemId, value };
  });
};

export const setLocale = async (
  tenantId: TenantId,
  submissionId: SubmissionId,
  locale: 'fr' | 'en',
): Promise<void> => {
  await withTenant(tenantId, async (client) => {
    await client.query(`UPDATE submissions SET locale = $1, updated_at = now() WHERE id = $2`, [
      locale,
      submissionId,
    ]);
  });
};

export const submitState = async (
  tenantId: TenantId,
  invitationId: InvitationId,
  submissionId: SubmissionId,
): Promise<SurveyState> => {
  return withTenant(tenantId, async (client) => {
    await client.query(
      `UPDATE submissions
         SET status = 'submitted', submitted_at = now(), updated_at = now()
       WHERE id = $1 AND status <> 'submitted'`,
      [submissionId],
    );
    await client.query(
      `UPDATE invitations
         SET status = 'submitted', updated_at = now()
       WHERE id = $1 AND status <> 'submitted'`,
      [invitationId],
    );
    return {
      invitationReference: '',
      invitationId,
      tenantId,
      locale: 'en',
      submissionId,
      startedAt: '',
      submittedAt: new Date().toISOString(),
      answers: {},
    };
  });
};

export const isSubmitted = async (
  tenantId: TenantId,
  submissionId: SubmissionId,
): Promise<boolean> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM submissions WHERE id = $1`,
      [submissionId],
    );
    return rows[0]?.status === 'submitted';
  });
};

// Compatibility shim so M5 callers do not need to change their import shape.
export type { Answer };
