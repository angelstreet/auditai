import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { AddTeamForm, TeamRow } from '@/components/admin/SetupForms';
import HelpTip from '@/components/HelpTip';
import { listTeamsSetup } from '@/lib/setupData';
import { EmptyState, Mascot, PageTitle, StatusText } from '@evolai/ui';
import type { MascotTier, TenantId } from '@evolai/contracts';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { formatDate } from '@evolai/i18n';
import { listHiddenTeamIds, listTeamBadges, listTeamsInTenant } from '@/lib/teamBadgeData';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { listReferents } from '@/lib/referentData';
import ReferentInviteForm from './ReferentInviteForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

/**
 * /admin/teams: the team profile read surface (M14 slice C).
 *
 * Each team card shows ONLY the dominant mascot tier + the per-tier
 * composition (tortoise / fox / owl headcounts). Raw quiz_scores never
 * appear here; the analyst who needs the raw score is expected to read
 * the `respondent_badges` table directly.
 */
export default async function TeamsPage({ searchParams }: PageProps) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  const current = (tenants.find((t) => t === requested(searchParams.tenant)) ?? tenants[0]) as
    | TenantId
    | undefined;
  if (!current) {
    return (
      <div className="wide">
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </div>
    );
  }
  const [teams, badges, setupTeams, hiddenTeams, referents] = await Promise.all([
    listTeamsInTenant(current),
    listTeamBadges(current),
    listTeamsSetup(current),
    listHiddenTeamIds(current),
    listReferents(current),
  ]);
  const badgeByTeam = new Map(badges.map((b) => [b.teamId, b]));
  return (
    <div className="wide">
      <PageTitle
        title={t('admin.teams.title')}
        subtitle={t('admin.teams.intro')}
        actions={
          <Button variant="outlined" href="/quiz">
            {t('admin.teams.takeQuiz')}
          </Button>
        }
      />
      <Paper variant="outlined" component="section" sx={{ p: 4, borderRadius: 3, mb: 5 }}>
        <Typography variant="sectionTitle" component="h2">
          {t('admin.setup.teams.addTitle')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('admin.setup.teams.addIntro')}
        </Typography>
        <AddTeamForm tenantId={current} />
      </Paper>
      {setupTeams.length > 0 ? (
        <Paper variant="outlined" component="section" sx={{ p: 4, borderRadius: 3, mb: 5 }}>
          <Typography variant="sectionTitle" component="h2">
            {t('admin.setup.teams.manageTitle')}
          </Typography>
          <ul style={{ padding: 0, margin: 0 }}>
            {setupTeams.map((team) => (
              <TeamRow
                key={team.id}
                tenantId={current}
                team={{ id: team.id, name: team.name, size: team.expectedHeadcount }}
                usedLabel={t('admin.setup.teams.usedIn', { n: team.engagementCount })}
              />
            ))}
          </ul>
        </Paper>
      ) : null}
      {teams.length === 0 ? (
        <EmptyState icon="team" title={t('admin.teams.none')} />
      ) : (
        <ul className="card-list card-grid">
          {teams.map((team) => {
            const b = badgeByTeam.get(team.id);
            const tier = b?.dominantTier ?? null;
            return (
              <li key={team.id} className="card">
                <header>
                  <h3>{team.name}</h3>
                  {tier ? (
                    <span className={`pill tier-${tier}`}>{t(`quiz.tier.${tier}`)}</span>
                  ) : hiddenTeams.has(team.id) ? (
                    <StatusText status="pending">{t('trust.small.pill')}</StatusText>
                  ) : (
                    <StatusText status="pending">{t('admin.teams.noBadgesPill')}</StatusText>
                  )}
                </header>
                {b ? (
                  <>
                    <Mascot
                      tier={tier as MascotTier}
                      size={96}
                      label={t(`quiz.mascotAlt.${tier as MascotTier}`)}
                    />
                    <p className="muted">{t(`quiz.tierDescriptor.${tier as MascotTier}`)}</p>
                    <dl className="dl-grid">
                      <dt>{t('admin.teams.members')}</dt>
                      <dd>{b.memberCount}</dd>
                      <dt>{t('quiz.tier.tortoise')}</dt>
                      <dd>{b.tortoiseCount}</dd>
                      <dt>{t('quiz.tier.fox')}</dt>
                      <dd>{b.foxCount}</dd>
                      <dt>{t('quiz.tier.owl')}</dt>
                      <dd>{b.owlCount}</dd>
                      <dt>{t('admin.teams.computed')}</dt>
                      <dd>{formatDate(locale, b.computedAt)}</dd>
                    </dl>
                  </>
                ) : hiddenTeams.has(team.id) ? null : (
                  <p className="muted">{t('admin.teams.noBadges')}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hiddenTeams.size > 0 ? (
        <p className="muted" data-testid="small-group-note">
          {t('trust.small.hidden', { n: MIN_GROUP_SIZE })}
        </p>
      ) : null}
      <Paper variant="outlined" component="section" sx={{ p: 4, borderRadius: 3, my: 5 }}>
        <Typography variant="sectionTitle" component="h2">
          {t('trust.referents.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {t('trust.referents.intro')}
        </Typography>
        {referents.length === 0 ? (
          <p className="muted">{t('trust.referents.none')}</p>
        ) : (
          <ul className="card-list">
            {referents.map((r) => (
              <li key={r.userId} className="card" data-testid="referent-card">
                <header>
                  <h3>
                    {r.name} <span className="muted">({r.teamName})</span>
                  </h3>
                  <StatusText status={r.status === 'ready' ? 'success' : 'pending'}>
                    {t(
                      r.status === 'ready'
                        ? 'trust.referents.statusReady'
                        : r.status === 'disabled'
                          ? 'trust.referents.statusDisabled'
                          : 'trust.referents.statusNone',
                    )}
                  </StatusText>
                </header>
                {r.status === 'disabled' ? null : (
                  <ReferentInviteForm tenantId={current} userId={r.userId} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Paper>
      <p className="footnote">
        {t('admin.teams.footnote')}
        <HelpTip label={t('admin.teams.footnoteHelpAria')} text={t('admin.teams.footnoteHelp')} />
      </p>
    </div>
  );
}

const requested = (raw: string | undefined): string | undefined => raw;
