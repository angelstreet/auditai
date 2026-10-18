import LinkProblem from '@/components/respondent/LinkProblem';
import RespondentStatus from '@/components/respondent/RespondentStatus';
import { loadRespondent, teamProgress } from '@/lib/respondent';
import { getCurrentBadgeForPseudonym } from '@/lib/respondentBadgeData';
import { submitState } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

export default async function DonePage({ params }: { params: Params }) {
  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;

  if (state.submissionId) {
    await submitState(invite.tenantId, invite.invitationId, state.submissionId);
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
