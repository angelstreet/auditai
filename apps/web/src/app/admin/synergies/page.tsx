import { EmptyState, PageTitle } from '@evolai/ui';
import { sessionTenantIds } from '@/lib/authServer';
import { listSynergies } from '@/lib/synergyData';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate } from '@evolai/i18n';
import { TransitionSynergyForm } from './TransitionSynergyForm';
import type { TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

const SYNERGY_TONE: Record<string, string> = {
  detected: 'pill-detected',
  surfaced: 'pill-surfaced',
  dismissed: 'pill-dismissed',
  archived: 'pill-archived',
};

export default async function SynergiesPage({ searchParams }: PageProps) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  const requested = searchParams.tenant;
  const current = (tenants.find((t) => t === requested) ?? tenants[0]) as TenantId | undefined;
  if (!current) {
    return (
      <div className="wide">
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </div>
    );
  }
  const synergies = await listSynergies(current);
  return (
    <div className="wide">
      <PageTitle title={t('admin.synergies.title')} subtitle={t('admin.synergies.intro')} />
      {synergies.length === 0 ? (
        <EmptyState title={t('admin.synergies.none')} />
      ) : (
        <ul className="card-list">
          {synergies.map((s) => (
            <li key={s.id} className="card">
              <header>
                <span className={`pill ${SYNERGY_TONE[s.status] ?? ''}`}>
                  {enumLabel(t, 'synergyStatus', s.status)}
                </span>
                <strong>{s.themeLabel}</strong>
                <span className="tag">{enumLabel(t, 'axis', s.axis)}</span>
              </header>
              <p>{s.proposedFollowupPrompt}</p>
              <dl className="dl-grid">
                <dt>{t('admin.synergies.detected')}</dt>
                <dd>{formatDate(locale, s.detectedAt)}</dd>
                <dt>{t('admin.synergies.surfaced')}</dt>
                <dd>{s.surfacedAt ? formatDate(locale, s.surfacedAt) : t('common.dash')}</dd>
                <dt>{t('admin.synergies.dismissed')}</dt>
                <dd>{s.dismissedAt ? formatDate(locale, s.dismissedAt) : t('common.dash')}</dd>
                <dt>{t('admin.synergies.occurrences')}</dt>
                <dd>
                  {t('admin.synergies.occurrencesValue', {
                    engagements: s.occurrenceCount,
                    analyses: s.sourceAnalysisIds.length,
                  })}
                </dd>
                <dt>{t('admin.synergies.sources')}</dt>
                <dd>
                  <code className="muted">
                    {s.sourceEngagementIds.map((e) => e.slice(0, 8)).join(', ')}
                  </code>
                </dd>
              </dl>
              {s.status !== 'archived' ? (
                <TransitionSynergyForm
                  tenantId={current}
                  synergyId={s.id}
                  currentStatus={s.status}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
