import type { InvitationId, SubmissionId, TenantId } from '@evolai/contracts';
import { firstUnanswered } from './respondent';
import { getOrCreateState, isSubmitted, submitState } from './surveyState';

export type FinishResult =
  | { readonly ok: true; readonly alreadySubmitted: boolean }
  | { readonly ok: false; readonly missingIndex: number };

/**
 * Submit a survey on an explicit request (never on a page load). Idempotent: a second call on a
 * submitted survey returns ok. Every question must be answered or skipped first; otherwise the
 * index of the first open question is returned so the person can go back to it.
 */
export const finishSurvey = async (
  tenantId: TenantId,
  invitationId: InvitationId,
  total: number,
): Promise<FinishResult> => {
  const state = await getOrCreateState(tenantId, invitationId);
  const submissionId = state.submissionId as SubmissionId;
  if (await isSubmitted(tenantId, submissionId)) return { ok: true, alreadySubmitted: true };
  const missing = firstUnanswered(state.answers, total);
  if (missing < total) return { ok: false, missingIndex: missing };
  await submitState(tenantId, invitationId, submissionId);
  return { ok: true, alreadySubmitted: false };
};
