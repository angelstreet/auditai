import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ProgressBar from '@/components/ProgressBar';
import LinkProblem from '@/components/respondent/LinkProblem';
import QuestionClient from '@/components/respondent/QuestionClient';
import { loadRespondent } from '@/lib/respondent';
import { questionByIndex, totalQuestionCount } from '@/lib/syntheticTemplate';
import { isSubmitted } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
  index: string;
}

export default async function QuestionPage({ params }: { params: Params }) {
  const total = totalQuestionCount();
  const index = Number.parseInt(params.index, 10);
  if (!Number.isInteger(index) || index < 0 || index >= total) notFound();

  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;
  if (!state.submissionId) notFound();
  // Answers are final once submitted; send the person to their status view instead.
  if (await isSubmitted(invite.tenantId, state.submissionId)) redirect(`/s/${params.token}`);

  const question = questionByIndex(index);
  const isLast = index === total - 1;
  const nextHref = isLast ? `/s/${params.token}/done` : `/s/${params.token}/q/${index + 1}`;
  const backHref = index === 0 ? `/s/${params.token}` : `/s/${params.token}/q/${index - 1}`;
  const initialChoice =
    state.answers[index]?.value.kind === 'scenario_choice'
      ? (state.answers[index]?.value.choice ?? null)
      : null;

  return (
    <div className="stack">
      <div className="step-bar">
        <Link className="link-button" href={backHref}>
          ← {t('survey.back')}
        </Link>
        <span className="muted">{t('survey.questionOf', { i: index + 1, n: total })}</span>
      </div>
      <ProgressBar
        current={index + 1}
        total={total}
        ariaLabel={t('survey.progress')}
        valueText={t('survey.questionOf', { i: index + 1, n: total })}
      />
      <QuestionClient
        token={params.token}
        index={index}
        prompt={question.prompt[locale]}
        helper={question.helper[locale]}
        options={question.options.map((o) => ({ value: o.value, label: o.label[locale] }))}
        initialChoice={initialChoice}
        nextHref={nextHref}
        ariaQuestionLabel={t('survey.answerOptions')}
        messages={{ saving: t('survey.saving'), saveFailed: t('survey.saveFailed') }}
      />
      <div className="step-bar end">
        <Link className="link-button" href={nextHref}>
          {t('survey.skip')} →
        </Link>
      </div>
    </div>
  );
}
