import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrivacyNotice from '@/components/PrivacyNotice';
import WelcomeClient from '@/components/WelcomeClient';
import { findTenantForInvitation } from '@/lib/db';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { SYNTHETIC_QUESTIONS, totalQuestionCount } from '@/lib/syntheticTemplate';
import { getOrCreateState, isSubmitted } from '@/lib/surveyState';
import { createTranslator } from '@auditai/i18n';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

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
  const t = createTranslator(locale);
  const total = totalQuestionCount();

  if (state.submissionId) {
    const submitted = await isSubmitted(resolved.tenantId, state.submissionId);
    if (submitted) {
      return (
        <section aria-labelledby="already-submitted-title">
          <h1 id="already-submitted-title">{t('survey.alreadySubmitted')}</h1>
          <p>
            <Link href={`/s/${params.token}/done`}>{t('survey.viewThanks')}</Link>.
          </p>
        </section>
      );
    }
  }

  return (
    <section aria-labelledby="welcome-title">
      <h1 id="welcome-title">EvolAI</h1>
      <p className="muted">
        {t('survey.questionsCount', { n: total })} \u00b7 {t('survey.estimated')}
      </p>
      <PrivacyNotice locale={locale} />
      <WelcomeClient token={params.token} initialLocale={locale} totalQuestions={total} />
    </section>
  );
}

// Reference the questions so the bundler keeps the synthetic template reachable.
void SYNTHETIC_QUESTIONS;
