import Link from 'next/link';
import { Mascot } from '@auditai/ui';
import { formatDate, type SupportedLocale, type Translator } from '@auditai/i18n';
import type { MascotTier } from '@auditai/contracts';
import ProgressBar from '@/components/ProgressBar';
import type { TeamProgress } from '@/lib/respondent';

interface Props {
  token: string;
  title: string;
  team: TeamProgress;
  myTier: MascotTier | null;
  locale: SupportedLocale;
  t: Translator;
}

/** "1 November" / "1er novembre": French writes the first of the month as an ordinal. */
const dayMonth = (locale: SupportedLocale, iso: string): string => {
  const text = formatDate(locale, iso, { day: 'numeric', month: 'long' });
  return locale === 'fr' ? text.replace(/^1 /, '1er ') : text;
};

const nextStep = (team: TeamProgress, locale: SupportedLocale, t: Translator): string => {
  switch (team.engagementStatus) {
    case 'analysis':
    case 'review':
      return t('survey.nextClosed');
    case 'closed':
    case 'archived':
      return t('survey.nextDone');
    default:
      return team.closesAt
        ? t('survey.nextOpenUntil', { date: dayMonth(locale, team.closesAt) })
        : t('survey.nextOpen');
  }
};

/**
 * "How is my team doing, what happens next" (done page and return visit). One glance: the team
 * answer count, one sentence on the next step, and the optional mascot quiz. Counts only, never
 * names or answers (PRD §4.3, §15).
 */
export default function RespondentStatus({ token, title, team, myTier, locale, t }: Props) {
  return (
    <div className="stack">
      <h1 id="status-title">{title}</h1>
      <section className="card" aria-labelledby="team-title">
        <h2 id="team-title">{t('survey.teamHeading')}</h2>
        <p className="stat">
          {t('survey.teamProgress', { done: team.answered, total: team.invited })}
        </p>
        <ProgressBar
          current={team.answered}
          total={team.invited}
          ariaLabel={t('survey.teamProgressAria')}
        />
        {team.teamTier ? (
          <p className="inline-mascot">
            <Mascot tier={team.teamTier} size={40} label={t(`quiz.mascotAlt.${team.teamTier}`)} />
            {t('survey.teamMascot', { tier: t(`quiz.tier.${team.teamTier}`) })}
          </p>
        ) : null}
      </section>
      <section aria-labelledby="next-title">
        <h2 id="next-title">{t('survey.nextHeading')}</h2>
        <p>{nextStep(team, locale, t)}</p>
        <p className="muted">{t('survey.keepLink')}</p>
      </section>
      <section id="mascot" className="card" aria-labelledby="mascot-title">
        {myTier ? (
          <>
            <h2 id="mascot-title" className="inline-mascot">
              <Mascot tier={myTier} size={64} label={t(`quiz.mascotAlt.${myTier}`)} />
              {t('survey.yourMascot', { tier: t(`quiz.tier.${myTier}`) })}
            </h2>
            <p>{t(`quiz.tierDescriptor.${myTier}`)}</p>
            <p className="muted">{t('quiz.mascotIntro')}</p>
            <Link className="btn btn-secondary" href={`/s/${token}/quiz`}>
              {t('survey.retakeQuiz')}
            </Link>
          </>
        ) : (
          <>
            <h2 id="mascot-title">{t('survey.quizTitle')}</h2>
            <p>{t('survey.quizBody')}</p>
            <Link className="btn btn-primary" href={`/s/${token}/quiz`}>
              {t('survey.quizCta')}
            </Link>
          </>
        )}
      </section>
      <section aria-labelledby="tip-title">
        <h2 id="tip-title">{t('survey.tipHeading')}</h2>
        <p>{t('survey.tip')}</p>
      </section>
    </div>
  );
}
