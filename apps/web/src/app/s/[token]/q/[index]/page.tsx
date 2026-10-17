import Link from 'next/link';
import { notFound } from 'next/navigation';
import LocaleSync from '@/components/LocaleSync';
import ProgressBar from '@/components/ProgressBar';
import QuestionClient from '@/components/QuestionClient';
import { findTenantForInvitation } from '@/lib/db';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { questionByIndex, totalQuestionCount } from '@/lib/syntheticTemplate';
import { getOrCreateState } from '@/lib/surveyState';
import { createTranslator } from '@auditai/i18n';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
  index: string;
}

export default async function QuestionPage({ params }: { params: Params }) {
  try {
    verifyInviteToken(params.token);
  } catch (err) {
    if (err instanceof InvalidInviteToken) notFound();
    throw err;
  }

  const reference = params.token.split('.')[0] as string;
  const resolved = await findTenantForInvitation(reference);
  if (!resolved) notFound();

  const total = totalQuestionCount();
  const index = Number.parseInt(params.index, 10);
  if (!Number.isInteger(index) || index < 0 || index >= total) notFound();

  const state = await getOrCreateState(resolved.tenantId, resolved.invitationId);
  if (!state.submissionId) notFound();

  const question = questionByIndex(index);
  const locale = state.locale;
  const t = createTranslator(locale);

  const isLast = index === total - 1;
  const nextHref = isLast ? `/s/${params.token}/done` : `/s/${params.token}/q/${index + 1}`;
  const initialChoice =
    state.answers[index]?.value.kind === 'scenario_choice'
      ? (state.answers[index]?.value.choice ?? null)
      : null;

  return (
    <section aria-labelledby="question-prompt">
      <LocaleSync locale={locale} />
      <ProgressBar current={index + 1} total={total} ariaLabel={t('survey.progress')} />
      <QuestionClient
        token={params.token}
        index={index}
        prompt={question.prompt[locale]}
        helper={question.helper[locale]}
        options={question.options.map((o) => ({ value: o.value, label: o.label[locale] }))}
        initialChoice={initialChoice}
        nextHref={nextHref}
        ctaLabel={isLast ? t('survey.finish') : t('survey.continue')}
        ariaQuestionLabel={t('survey.answerOptions')}
        messages={{
          pickOption: t('survey.pickOption'),
          saveFailed: t('survey.saveFailed'),
        }}
      />
      <p className="muted" style={{ marginTop: '16px' }}>
        <Link href={`/s/${params.token}`}>{t('survey.backToWelcome')}</Link>
      </p>
    </section>
  );
}
