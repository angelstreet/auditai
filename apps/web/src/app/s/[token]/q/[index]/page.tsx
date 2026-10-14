import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProgressBar from '@/components/ProgressBar';
import QuestionClient from '@/components/QuestionClient';
import { findTenantForInvitation } from '@/lib/db';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { questionByIndex, totalQuestionCount } from '@/lib/syntheticTemplate';
import { getOrCreateState } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
  index: string;
}

const COPY = {
  fr: {
    done: 'Termin\u00e9',
    continue: 'Continuer',
    skip: 'Passer cette question',
    ariaQuestion: 'Choix de r\u00e9ponse',
    progressAria: 'Progression du questionnaire',
  },
  en: {
    done: 'Finish',
    continue: 'Continue',
    skip: 'Skip this question',
    ariaQuestion: 'Answer options',
    progressAria: 'Survey progress',
  },
} as const;

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
  const copy = COPY[locale];

  const isLast = index === total - 1;
  const nextHref = isLast ? `/s/${params.token}/done` : `/s/${params.token}/q/${index + 1}`;
  const initialChoice =
    state.answers[index]?.value.kind === 'scenario_choice'
      ? (state.answers[index]?.value.choice ?? null)
      : null;

  return (
    <section aria-labelledby="question-prompt">
      <ProgressBar current={index + 1} total={total} ariaLabel={copy.progressAria} />
      <QuestionClient
        token={params.token}
        index={index}
        prompt={question.prompt[locale]}
        helper={question.helper[locale]}
        options={question.options.map((o) => ({ value: o.value, label: o.label[locale] }))}
        initialChoice={initialChoice}
        nextHref={nextHref}
        ctaLabel={isLast ? copy.done : copy.continue}
        ariaQuestionLabel={copy.ariaQuestion}
      />
      <p className="muted" style={{ marginTop: '16px' }}>
        <Link href={`/s/${params.token}`}>Back to welcome</Link>
      </p>
    </section>
  );
}
