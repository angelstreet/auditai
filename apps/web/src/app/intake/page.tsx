import { Logo } from '@/components/Logo';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { getLatestSponsorBrief } from '@/lib/sponsorBriefData';
import { IntakeForm } from './IntakeForm';
import { OPPORTUNITY_STATUS_LABELS } from '@auditai/contracts';
import { formatCurrency, formatNumber } from '@auditai/i18n';
import { getT } from '@/lib/i18n';
import type { MessageKey } from '@auditai/i18n';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

export function generateMetadata() {
  return { title: getT().t('meta.pages.intake') };
}

export default async function IntakePage({ searchParams }: PageProps) {
  const { t, locale } = getT();
  const dash = t('common.dash');
  const pick = (group: string, value: string): string => {
    const key = `intake.${group}.${value}`;
    const label = t(key as MessageKey);
    return label === key ? value : label;
  };
  const pickAll = (group: string, values: readonly string[]): string =>
    values.map((v) => pick(group, v)).join(', ');
  const formatEur = (n: number | null): string => (n === null ? dash : formatCurrency(locale, n));
  const tenants = await listTenantIds();
  const requested = searchParams.tenant;
  const current = (tenants.find((t) => t === requested) ?? tenants[0]) as TenantId | undefined;
  if (!current) {
    return (
      <main className="container">
        <Logo />
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </main>
    );
  }
  const [label, latest] = await Promise.all([tenantLabel(current), getLatestSponsorBrief(current)]);
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>{t('intake.title')}</h1>
      <p className="muted">{t('intake.intro', { label })}</p>
      <div className="grid">
        <IntakeForm tenantId={current} />
        <aside className="summary">
          <h3>{t('intake.summary')}</h3>
          <p className="muted">{t('intake.summaryIntro')}</p>
          {latest ? (
            <dl>
              <dt>{t('intake.tenant')}</dt>
              <dd>{label}</dd>
              <dt>{t('intake.topPriority')}</dt>
              <dd>{latest.topPriorityWorkflow || dash}</dd>
              <dt>{t('intake.departments')}</dt>
              <dd>{pickAll('dept', latest.departmentsInScope) || dash}</dd>
              <dt>{t('intake.sensitivity')}</dt>
              <dd>{pickAll('sens', latest.dataSensitivityBoundary) || dash}</dd>
              <dt>{t('intake.budget')}</dt>
              <dd>{formatEur(latest.annualBudgetEur)}</dd>
              <dt>{t('intake.onsite')}</dt>
              <dd>{latest.onsiteAppetite ? pick('onsiteOpt', latest.onsiteAppetite) : dash}</dd>
              <dt>{t('intake.modelRegion')}</dt>
              <dd>{pickAll('region', latest.approvedModelRegions) || dash}</dd>
              <dt>{t('intake.residency')}</dt>
              <dd>{pickAll('res', latest.dataResidency) || dash}</dd>
              <dt>{t('intake.promptInjection')}</dt>
              <dd>
                {latest.promptInjectionReview
                  ? pick('injection', latest.promptInjectionReview)
                  : dash}
              </dd>
              <dt>{t('intake.maturityAvg')}</dt>
              <dd>
                {t('intake.maturityValue', {
                  value: formatNumber(
                    locale,
                    [latest.leadershipLiteracy, latest.operationalAdoption, latest.policyGovernance]
                      .filter((n): n is number => n !== null)
                      .reduce((a, b, _, arr) => a + b / arr.length, 0),
                    { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                  ),
                })}
              </dd>
            </dl>
          ) : (
            <p className="muted">{t('intake.none')}</p>
          )}
          <p className="muted" style={{ marginTop: 16 }}>
            {t('intake.statusPills', {
              statuses: Object.keys(OPPORTUNITY_STATUS_LABELS)
                .map((k) => t(`status.${k as keyof typeof OPPORTUNITY_STATUS_LABELS}`))
                .join(' \u00b7 '),
            })}
          </p>
        </aside>
      </div>
      <style>{`
        .grid { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
        .summary { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 18px 20px; position: sticky; top: 16px; }
        .summary h3 { margin: 0 0 8px; font-size: 15px; }
        .summary dl { display: grid; grid-template-columns: 110px 1fr; row-gap: 6px; column-gap: 12px; margin: 0; }
        .summary dt { color: var(--color-muted); font-size: 12px; }
        .summary dd { margin: 0; font-size: 13px; font-weight: 500; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
