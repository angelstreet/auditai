import type { Translator } from '@evolai/i18n';

/** Expired or withdrawn invitation: say so plainly and give the one next action (PRD §16). */
export default function LinkProblem({ gate, t }: { gate: 'expired' | 'withdrawn'; t: Translator }) {
  return (
    <section className="stack" aria-labelledby="link-problem-title">
      <h1 id="link-problem-title">
        {gate === 'expired' ? t('survey.expiredTitle') : t('survey.withdrawnTitle')}
      </h1>
      <p>{t('survey.askNewLink')}</p>
    </section>
  );
}
