import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { getOrCreateState, submitState } from '@/lib/surveyState';

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

export default function DonePage({ params }: { params: Params }) {
  try {
    verifyInviteToken(params.token);
  } catch (err) {
    if (err instanceof InvalidInviteToken) notFound();
    throw err;
  }

  const reference = params.token.split('.')[0] as string;
  const state = getOrCreateState(reference);
  const locale = state.locale;
  const copy = COPY[locale];

  // Mark submitted on first visit; later visits are idempotent.
  submitState(reference);

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
