import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Mascot } from '@auditai/ui';
import { mascotTierOrder, type MascotTier, type TenantId } from '@auditai/contracts';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { formatDate } from '@auditai/i18n';
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
      <main className="container">
        <Logo />
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </main>
    );
  }
  const [label, teams, badges] = await Promise.all([
    tenantLabel(current),
    listTeamsInTenant(current),
    listTeamBadges(current),
  ]);
  const badgeByTeam = new Map(badges.map((b) => [b.teamId, b]));
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>{t('admin.teams.title')}</h1>
      <p className="muted">{t('admin.teams.intro', { label })}</p>
      <p>
        <Link className="btn-ghost" href="/board">
          {t('admin.common.backToBoard')}
        </Link>{' '}
        <Link className="btn-ghost" href="/quiz">
          {t('admin.teams.takeQuiz')}
        </Link>
      </p>
      {teams.length === 0 ? (
        <section className="empty-state">
          <p className="muted">{t('admin.teams.none')}</p>
        </section>
      ) : (
        <ul className="team-list">
          {teams.map((team) => {
            const b = badgeByTeam.get(team.id);
            const tier = b?.dominantTier ?? null;
            return (
              <li key={team.id} className={`team-row ${tier ? `tier-${tier}` : 'tier-none'}`}>
                <header>
                  <h3>{team.name}</h3>
                  {tier ? (
                    <span className={`pill tier-${tier}`}>{t(`quiz.tier.${tier}`)}</span>
                  ) : (
                    <span className="pill muted-pill">{t('admin.teams.noBadgesPill')}</span>
                  )}
                </header>
                {b ? (
                  <>
                    <Mascot
                      tier={tier as MascotTier}
                      size={96}
                      label={t(`quiz.mascotAlt.${tier as MascotTier}`)}
                    />
                    <p className="desc">{t(`quiz.tierDescriptor.${tier as MascotTier}`)}</p>
                    <dl>
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
      <style>{`
        .empty-state { padding: 24px; border: 1px dashed var(--color-border); border-radius: 8px; }
        .team-list { list-style: none; padding: 0; margin: 0; display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
        .team-row { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 16px 18px; }
        .team-row header { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; }
        .team-row header h3 { margin: 0; font-size: 16px; }
        .team-row .desc { font-size: 14px; color: var(--color-muted); margin: 8px 0 12px; }
        .team-row dl { display: grid; grid-template-columns: 100px 1fr;
          row-gap: 4px; column-gap: 12px; font-size: 12px; margin: 0; }
        .team-row dt { color: var(--color-muted); }
        .team-row dd { margin: 0; font-family: var(--font-mono, monospace); font-weight: 500; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .pill.tier-tortoise { background: var(--color-brand-supporting); color: var(--color-brand-off-white); }
        .pill.tier-fox      { background: var(--color-brand-teal); color: var(--color-brand-off-white); }
        .pill.tier-owl      { background: #6cc06c; color: #0b1c2c; }
        .pill.muted-pill    { background: #c5c5c5; color: #1a1a1a; }
        .footnote { margin-top: 24px; padding: 14px 16px; background: var(--color-card);
          border: 1px dashed var(--color-border); border-radius: 8px; font-size: 13px; }
        .btn-ghost { display: inline-block; padding: 8px 14px; border: 1px solid var(--color-border);
          border-radius: 6px; text-decoration: none; color: inherit; margin-right: 6px; }
      `}</style>
    </main>
  );
}

const requested = (raw: string | undefined): string | undefined => raw;
