import Link from 'next/link';
import { Mascot } from '@evolai/ui';
import { mascotTierOrder, type MascotTier, type TenantId } from '@evolai/contracts';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { formatDate } from '@evolai/i18n';
import { listTeamBadges, listTeamsInTenant } from '@/lib/teamBadgeData';

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
  const [label, teams, badges] = await Promise.all([
    tenantLabel(current),
    listTeamsInTenant(current),
    listTeamBadges(current),
  ]);
  const badgeByTeam = new Map(badges.map((b) => [b.teamId, b]));
  return (
    <div className="wide">
      <h1>{t('admin.teams.title')}</h1>
      <p className="muted">{t('admin.teams.intro', { label })}</p>
      <p className="actions">
        <Link className="btn btn-secondary btn-sm" href="/board">
          {t('admin.common.backToBoard')}
        </Link>{' '}
        <Link className="btn btn-secondary btn-sm" href="/quiz">
          {t('admin.teams.takeQuiz')}
        </Link>
      </p>
      {teams.length === 0 ? (
        <section className="empty-state">
          <p className="muted">{t('admin.teams.none')}</p>
        </section>
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
                  ) : (
                    <span className="pill pill-muted">{t('admin.teams.noBadgesPill')}</span>
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
                ) : (
                  <p className="muted">{t('admin.teams.noBadges')}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="footnote">{t('admin.teams.footnote')}</p>
      <p className="muted">
        {t('admin.teams.allTiers')}{' '}
        {mascotTierOrder.map((tier) => t(`quiz.tier.${tier}`)).join(', ')}.
      </p>
    </div>
  );
}

const requested = (raw: string | undefined): string | undefined => raw;
