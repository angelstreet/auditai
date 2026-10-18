import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { getLatestSponsorBrief } from '@/lib/sponsorBriefData';
import { IntakeForm } from './IntakeForm';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { PageTitle } from '@evolai/ui';
import { formatCurrency, formatNumber } from '@evolai/i18n';
import { getT } from '@/lib/i18n';
import type { MessageKey } from '@evolai/i18n';
import type { TenantId } from '@evolai/contracts';

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
      <div className="wide">
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </div>
    );
  }
  const [label, latest] = await Promise.all([tenantLabel(current), getLatestSponsorBrief(current)]);
  return (
    <div className="wide">
      <PageTitle title={t('intake.title')} subtitle={t('intake.intro')} />
      <Box
        sx={{
          display: 'grid',
          gap: 4,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
        }}
      >
        <IntakeForm tenantId={current} />
        <Paper
          component="aside"
          variant="outlined"
          sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, position: { md: 'sticky' }, top: { md: 16 } }}
        >
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
            {t('intake.summary')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            {t('intake.summaryIntro')}
          </Typography>
          {latest ? (
            <dl className="dl-grid">
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
        </Paper>
      </Box>
    </div>
  );
}
