import Link from 'next/link';
import LinkProblem from '@/components/respondent/LinkProblem';
import PrivacyNotice from '@/components/respondent/PrivacyNotice';
import RespondentStatus from '@/components/respondent/RespondentStatus';
import { estimatedMinutes, firstUnanswered, loadRespondent, teamProgress } from '@/lib/respondent';
import { getCurrentBadgeForPseudonym } from '@/lib/respondentBadgeData';
import { totalQuestionCount } from '@/lib/syntheticTemplate';
import { isSubmitted } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

/**
 * Invitation landing. First visit: what this is, how long, privacy in one line, one Start button.
 * Interrupted visit: the same, with "continue where you left off". After submitting: the
 * respondent's status view (team progress, what happens next).
 */
export default async function WelcomePage({ params }: { params: Params }) {
  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;
  const total = totalQuestionCount();

  if (state.submissionId && (await isSubmitted(invite.tenantId, state.submissionId))) {
    const [team, badge] = await Promise.all([
      teamProgress(invite),
      getCurrentBadgeForPseudonym(invite.tenantId, invite.pseudonym),
    ]);
    return (
      <RespondentStatus
        token={params.token}
        title={t('survey.alreadyTitle')}
        team={team}
        myTier={badge?.mascotTier ?? null}
        locale={locale}
        t={t}
      />
    );
  }

  const answered = Object.keys(state.answers).length;
  const next = Math.min(firstUnanswered(state.answers, total), total - 1);
  return (
    <section className="stack" aria-labelledby="welcome-title">
      <h1 id="welcome-title">{t('survey.title')}</h1>
      <p className="lede">{t('survey.lede')}</p>
      <p className="meta">
        {answered > 0
          ? t('survey.resumeProgress', { done: answered, n: total })
          : t('survey.duration', { n: total, m: estimatedMinutes(total) })}
      </p>
      <Link className="btn btn-primary btn-block" href={`/s/${params.token}/q/${next}`}>
        {answered > 0 ? t('survey.resume') : t('survey.start')}
      </Link>
      <p className="muted">{t('survey.howItWorks')}</p>
      <PrivacyNotice t={t} />
    </section>
  );
}
