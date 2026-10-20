import LinkProblem from '@/components/respondent/LinkProblem';
import RespondentStatus from '@/components/respondent/RespondentStatus';
import { redirect } from 'next/navigation';
import FinishButton from '@/components/respondent/FinishButton';
import { firstUnanswered, loadRespondent, teamProgress } from '@/lib/respondent';
import { totalQuestionCount } from '@/lib/syntheticTemplate';
import { getCurrentBadgeForPseudonym } from '@/lib/respondentBadgeData';
import { isSubmitted } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

export default async function DonePage({ params }: { params: Params }) {
  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;

  // Read-only: this page never submits (a prefetch or reload must not change state). Submission
  // happens through POST /api/submit.
  if (!state.submissionId) redirect(`/s/${params.token}`);
  if (!(await isSubmitted(invite.tenantId, state.submissionId))) {
    const total = totalQuestionCount();
    const missing = firstUnanswered(state.answers, total);
    if (missing < total) redirect(`/s/${params.token}/q/${missing}`);
    return (
      <div className="stack">
        <h1>{t('survey.oneMoreTitle')}</h1>
        <p>{t('survey.oneMoreBody')}</p>
        <FinishButton
          token={params.token}
          label={t('survey.finish')}
          messages={{ failed: t('survey.finishFailed') }}
        />
      </div>
    );
  }
  const [team, badge] = await Promise.all([
    teamProgress(invite),
    getCurrentBadgeForPseudonym(invite.tenantId, invite.pseudonym),
  ]);

  return (
    <RespondentStatus
      token={params.token}
      title={t('survey.thanksTitle')}
      team={team}
      myTier={badge?.mascotTier ?? null}
      locale={locale}
      t={t}
    />
  );
}
