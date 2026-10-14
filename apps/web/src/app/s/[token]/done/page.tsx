import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findTenantForInvitation } from '@/lib/db';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { getOrCreateState, submitState } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

const COPY = {
  fr: {
    title: 'Merci',
    body:
      'Vos r\u00e9ponses ont \u00e9t\u00e9 enregistr\u00e9es. Le r\u00e9f\u00e9rent de votre \u00e9quipe ' +
      'voit les statistiques de participation, pas vos r\u00e9ponses individuelles.',
    tipHeading: 'Astuce pour la suite',
    tip: 'D\u00e9crivez le r\u00e9sultat attendu avant de choisir un outil ; testez petit et v\u00e9rifiez.',
    review: 'Revoir le questionnaire',
  },
  en: {
    title: 'Thank you',
    body:
      'Your answers have been recorded. Your team referent sees participation statistics, ' +
      'not your individual answers.',
    tipHeading: 'Tip going forward',
    tip: 'Describe the outcome you want before choosing a tool; test small and verify outputs.',
    review: 'Review the survey',
  },
} as const;

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
  const copy = COPY[locale];

  if (state.submissionId) {
    await submitState(resolved.tenantId, resolved.invitationId, state.submissionId);
  }

  return (
    <section aria-labelledby="done-title">
      <h1 id="done-title">{copy.title}</h1>
      <p>{copy.body}</p>
      <h2>{copy.tipHeading}</h2>
      <p>{copy.tip}</p>
      <p>
        <Link href={`/s/${params.token}`}>{copy.review}</Link>
      </p>
    </section>
  );
}
