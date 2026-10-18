'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  type MascotTier,
  type QuizAnswer,
  type RespondentBadgeWrite,
  mascotTierForScore,
  type TenantId,
} from '@evolai/contracts';
import { computeQuizScore, isCompleteQuizSubmission, LITERACY_QUIZ } from '@evolai/domain';
import { writeRespondentBadge } from '@/lib/respondentBadgeData';
import { getT } from '@/lib/i18n';
import { verifyInviteToken } from '@/lib/invitationToken';
import { findInvitation, gateFor } from '@/lib/respondent';

export interface QuizActionState {
  ok: boolean;
  message: string;
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isPseudonym = (v: string): boolean => /^[a-z0-9-]{8,64}$/.test(v);

const findOption = (code: string, value: string): { weight: number } | undefined =>
  LITERACY_QUIZ.find((q) => q.code === code)?.options.find((o) => o.value === value);

type SaveResult = { ok: false; message: string } | { ok: true; tier: MascotTier };

/** Validate the five answers, write the badge row, return the mascot tier (never the raw score). */
const saveQuiz = async (
  tenantId: string,
  pseudonym: string,
  engagementId: string | null,
  formData: FormData,
): Promise<SaveResult> => {
  const { t } = getT();
  if (!isUuidV4(tenantId)) return { ok: false, message: t('quiz.errInvalidTenant') };
  if (!isPseudonym(pseudonym)) return { ok: false, message: t('quiz.errInvalidPseudonym') };
  const answers: Record<string, string> = {};
  for (const q of LITERACY_QUIZ) {
    const v = formData.get(q.code);
    const s = typeof v === 'string' ? v : '';
    if (s) answers[q.code] = s;
  }
  if (!isCompleteQuizSubmission(answers)) {
    return { ok: false, message: t('quiz.errIncomplete') };
  }
  for (const q of LITERACY_QUIZ) {
    if (!findOption(q.code, answers[q.code] ?? '')) {
      return { ok: false, message: t('quiz.errUnknownAnswer') };
    }
  }
  const sourceAnswers: QuizAnswer[] = LITERACY_QUIZ.map((q) => ({
    questionCode: q.code,
    value: answers[q.code] ?? '',
  }));
  const quizScore = computeQuizScore(answers);
  const payload: RespondentBadgeWrite = {
    tenantId: tenantId as TenantId,
    respondentPseudonym: pseudonym,
    engagementId: engagementId as RespondentBadgeWrite['engagementId'],
    quizScore,
    sourceAnswers,
  };
  try {
    await writeRespondentBadge(tenantId as TenantId, payload);
  } catch (err) {
    // The raw error stays server-side: it may contain SQL or tenant details.
    console.error('quiz save failed', err);
    return { ok: false, message: t('quiz.errSaveFailed') };
  }
  return { ok: true, tier: mascotTierForScore(quizScore) };
};

/** Public demo quiz (`/quiz`): tenant + pseudonym come from the form. */
export async function submitQuizAction(
  _prev: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const pseudonym = String(formData.get('respondentPseudonym') ?? '');
  const result = await saveQuiz(String(formData.get('tenantId') ?? ''), pseudonym, null, formData);
  if (!result.ok) return result;
  revalidatePath('/quiz');
  revalidatePath('/quiz/result');
  // Redirect after successful submission; the result page reads the badge back.
  redirect(`/quiz/result?pseudonym=${encodeURIComponent(pseudonym)}&tier=${result.tier}`);
}

/**
 * Respondent quiz (`/s/[token]/quiz`): tenant, pseudonym and engagement come from the signed
 * invitation, never from the form, so a respondent can only write their own badge.
 */
export async function submitRespondentQuizAction(
  token: string,
  _prev: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const { t } = getT();
  try {
    verifyInviteToken(token);
  } catch {
    return { ok: false, message: t('quiz.errInvalidTenant') };
  }
  const invite = await findInvitation(token.split('.')[0] as string);
  if (!invite || gateFor(invite, new Date()) !== 'ok') {
    return { ok: false, message: t('quiz.errInvalidTenant') };
  }
  const result = await saveQuiz(invite.tenantId, invite.pseudonym, invite.engagementId, formData);
  if (!result.ok) return result;
  revalidatePath(`/s/${token}`);
  redirect(`/s/${token}#mascot`);
}
