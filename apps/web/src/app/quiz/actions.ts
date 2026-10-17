'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  type QuizAnswer,
  type RespondentBadgeWrite,
  mascotTierForScore,
  type TenantId,
} from '@auditai/contracts';
import { computeQuizScore, isCompleteQuizSubmission, LITERACY_QUIZ } from '@auditai/domain';
import { writeRespondentBadge } from '@/lib/respondentBadgeData';
import { getT } from '@/lib/i18n';

export interface QuizActionState {
  ok: boolean;
  message: string;
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isPseudonym = (v: string): boolean => /^[a-z0-9-]{8,64}$/.test(v);

const findOption = (code: string, value: string): { weight: number } | undefined =>
  LITERACY_QUIZ.find((q) => q.code === code)?.options.find((o) => o.value === value);

export async function submitQuizAction(
  _prev: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const pseudonym = String(formData.get('respondentPseudonym') ?? '');
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
    const v = answers[q.code] ?? '';
    if (!findOption(q.code, v)) {
      return { ok: false, message: t('quiz.errUnknownAnswer', { code: q.code, value: v }) };
    }
  }
  const sourceAnswers: QuizAnswer[] = LITERACY_QUIZ.map((q) => {
    const v = answers[q.code] ?? '';
    return { questionCode: q.code, value: v };
  });
  const quizScore = computeQuizScore(answers);
  const payload: RespondentBadgeWrite = {
    tenantId: tenantId as TenantId,
    respondentPseudonym: pseudonym,
    engagementId: null,
    quizScore,
    sourceAnswers,
  };
  try {
    await writeRespondentBadge(tenantId as TenantId, payload);
    revalidatePath('/quiz');
    revalidatePath('/quiz/result');
  } catch (err) {
    // The raw error stays server-side: it may contain SQL or tenant details.
    console.error('quiz save failed', err);
    return { ok: false, message: t('quiz.errSaveFailed') };
  }
  // Redirect after successful submission; the result page reads the badge back.
  const tier = mascotTierForScore(quizScore);
  redirect(`/quiz/result?pseudonym=${encodeURIComponent(pseudonym)}&tier=${tier}`);
}
