import Link from 'next/link';
import { notFound } from 'next/navigation';
import LocaleSync from '@/components/LocaleSync';
import { findTenantForInvitation } from '@/lib/db';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { getOrCreateState, submitState } from '@/lib/surveyState';
import { createTranslator } from '@auditai/i18n';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

export default async function DonePage({ params }: { params: Params }) {
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

  if (state.submissionId) {
    await submitState(resolved.tenantId, resolved.invitationId, state.submissionId);
  }

  return (
    <section aria-labelledby="done-title">
      <LocaleSync locale={locale} />
      <h1 id="done-title">{t('survey.thanksTitle')}</h1>
      <p>{t('survey.thanksBody')}</p>
      <h2>{t('survey.tipHeading')}</h2>
      <p>{t('survey.tip')}</p>
      <p>
        <Link href={`/s/${params.token}`}>{t('survey.review')}</Link>
      </p>
    </section>
  );
}
