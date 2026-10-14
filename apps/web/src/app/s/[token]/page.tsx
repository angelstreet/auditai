import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrivacyNotice from '@/components/PrivacyNotice';
import WelcomeClient from '@/components/WelcomeClient';
import { findTenantForInvitation } from '@/lib/db';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { SYNTHETIC_QUESTIONS, totalQuestionCount } from '@/lib/syntheticTemplate';
import { getOrCreateState, isSubmitted } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

const COPY = {
  fr: {
    start: 'Commencer le questionnaire',
    estimated: 'Environ 6 \u00e0 8 minutes, six questions.',
    skip: 'Vous pouvez passer les questions \u00e0 tout moment.',
    alreadySubmitted: 'Ce questionnaire a d\u00e9j\u00e0 \u00e9t\u00e9 soumis. Merci.',
    languageHeading: 'Langue',
    questionsCount: (n: number) => `${n} questions`,
  },
  en: {
    start: 'Start the survey',
    estimated: 'About 6 to 8 minutes, six questions.',
    skip: 'You can skip any question at any time.',
    alreadySubmitted: 'This survey has already been submitted. Thank you.',
    languageHeading: 'Language',
    questionsCount: (n: number) => `${n} questions`,
  },
} as const;

export default async function WelcomePage({ params }: { params: Params }) {
  try {
    verifyInviteToken(params.token);
  } catch (err) {
    if (err instanceof InvalidInviteToken) notFound();
    throw err;
  }
  const reference = params.token.split('.')[0] as string;
  const resolved = await findTenantForInvitation(reference);
  if (!resolved) notFound();
  const state = await getOrCreateState(resolved.tenantId, resolved.invitationId);
  const locale = state.locale;
  const copy = COPY[locale];
  const total = totalQuestionCount();

  if (state.submissionId) {
    const submitted = await isSubmitted(resolved.tenantId, state.submissionId);
    if (submitted) {
      return (
        <section aria-labelledby="already-submitted-title">
          <h1 id="already-submitted-title">{copy.alreadySubmitted}</h1>
          <p>
            <Link href={`/s/${params.token}/done`}>View your thank-you page</Link>.
          </p>
        </section>
      );
    }
  }

  return (
    <section aria-labelledby="welcome-title">
      <h1 id="welcome-title">auditAI</h1>
      <p className="muted">
        {copy.questionsCount(total)} \u00b7 {copy.estimated}
      </p>
      <PrivacyNotice locale={locale} />
      <WelcomeClient
        token={params.token}
        initialLocale={locale}
        totalQuestions={total}
        startLabel={copy.start}
        estimatedLabel={copy.estimated}
        skipLabel={copy.skip}
        languageHeading={copy.languageHeading}
      />
    </section>
  );
}

// Reference the questions so the bundler keeps the synthetic template reachable.
void SYNTHETIC_QUESTIONS;
