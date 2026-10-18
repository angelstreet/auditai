import { redirect } from 'next/navigation';
import EngagementRow from '@/components/admin/EngagementRow';
import TenantSwitcher from '@/components/admin/TenantSwitcher';
import { listEngagements } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { formatNumber } from '@evolai/i18n';
import { PageTitle, StatTiles } from '@evolai/ui';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface SearchParams {
  tenant?: string;
}

export default async function AdminEngagementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="admin-empty-title" className="wide admin">
        <h1 id="admin-empty-title">{t('admin.common.noTenantsTitle')}</h1>
        <p>{t('admin.common.noTenantsBody', { command: 'pnpm local:reset' })}</p>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) {
    redirect('/admin/engagements');
  }
  if (requested && tenants.find((t) => t === requested) === undefined) {
    redirect(`/admin/engagements?tenant=${current}`);
  }

  const summaries = await listEngagements(current);

  const totalExpected = summaries.reduce((acc, s) => acc + s.expectedHeadcount, 0);
  const totalSubmitted = summaries.reduce((acc, s) => acc + s.invitationsSubmitted, 0);
  const totalRatio = totalExpected === 0 ? 0 : totalSubmitted / totalExpected;

  return (
    <section aria-labelledby="admin-title" className="wide admin">
      <PageTitle
        id="admin-title"
        title={t('admin.engagements.title')}
        subtitle={t('admin.engagements.dataFrom')}
      />
      <TenantSwitcher currentTenantId={current} />
      <StatTiles
        items={[
          {
            label: t('admin.engagements.statCompletion'),
            value: formatNumber(locale, totalRatio, { style: 'percent', maximumFractionDigits: 0 }),
          },
          {
            label: t('admin.engagements.statResponses'),
            value: t('admin.engagements.statResponsesValue', {
              submitted: totalSubmitted,
              expected: totalExpected,
            }),
          },
          { label: t('admin.engagements.statEngagements'), value: summaries.length },
        ]}
      />
      <table>
        <thead>
          <tr>
            <th scope="col">{t('admin.engagements.colEngagement')}</th>
            <th scope="col">{t('admin.engagements.colStatus')}</th>
            <th scope="col">{t('admin.engagements.colHeadcount')}</th>
            <th scope="col">{t('admin.engagements.colInvitations')}</th>
            <th scope="col">{t('admin.engagements.colSubmitted')}</th>
            <th scope="col">{t('admin.engagements.colOpened')}</th>
            <th scope="col">{t('admin.engagements.colPending')}</th>
            <th scope="col">{t('admin.engagements.colRevoked')}</th>
            <th scope="col">{t('admin.engagements.colCompletion')}</th>
            <th scope="col">{t('admin.engagements.colCloses')}</th>
          </tr>
        </thead>
        <tbody>
          {summaries.length === 0 ? (
            <tr>
              <td colSpan={10}>{t('admin.engagements.none')}</td>
            </tr>
          ) : (
            summaries.map((summary) => (
              <EngagementRow key={summary.engagement.id} summary={summary} tenantId={current} />
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
