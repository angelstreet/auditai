import { LITERACY_QUIZ } from '@auditai/domain';
import LinkProblem from '@/components/respondent/LinkProblem';
import { loadRespondent } from '@/lib/respondent';
import { QuizForm } from '@/app/quiz/QuizForm';
import { submitRespondentQuizAction } from '@/app/quiz/actions';

export const dynamic = 'force-dynamic';

/** Optional mascot quiz, offered after the survey. Tenant and pseudonym come from the token. */
export default async function RespondentQuizPage({ params }: { params: { token: string } }) {
  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { t } = ctx;
  return (
    <div className="stack">
      <p className="muted">
        {t('quiz.intro')} {t('quiz.privacyShort')}
      </p>
      <QuizForm
        action={submitRespondentQuizAction.bind(null, params.token)}
        questions={LITERACY_QUIZ}
      />
    </div>
  );
}
