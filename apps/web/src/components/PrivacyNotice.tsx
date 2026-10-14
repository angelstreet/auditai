import type { SupportedLocale } from '@auditai/i18n';

interface Props {
  locale: SupportedLocale;
}

const COPY: Record<SupportedLocale, { title: string; bullets: string[] }> = {
  fr: {
    title: 'Confidentialit\u00e9 et usage',
    bullets: [
      'Vos r\u00e9ponses sont li\u00e9es \u00e0 un pseudonyme, pas \u00e0 votre nom.',
      'Le r\u00e9f\u00e9rent de l\u2019\u00e9quipe voit les taux de participation, pas vos r\u00e9ponses individuelles.',
      'L\u2019\u00e9quipe auditAI utilise vos r\u00e9ponses uniquement pour cartographier les opportunit\u00e9s d\u2019am\u00e9lioration.',
    ],
  },
  en: {
    title: 'Privacy and use',
    bullets: [
      'Your answers are tied to a pseudonym, not your name.',
      'Your team referent sees completion counts, not individual answers.',
      'The auditAI team uses your answers only to map improvement opportunities.',
    ],
  },
};

export default function PrivacyNotice({ locale }: Props) {
  const copy = COPY[locale];
  return (
    <section className="privacy" aria-labelledby="privacy-notice-title">
      <h2 id="privacy-notice-title">{copy.title}</h2>
      <ul>
        {copy.bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
