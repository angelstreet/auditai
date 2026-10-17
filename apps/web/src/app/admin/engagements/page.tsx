import { redirect } from 'next/navigation';
import EngagementRow from '@/components/admin/EngagementRow';
import TenantSwitcher from '@/components/admin/TenantSwitcher';
import { Logo } from '@/components/Logo';
import { listEngagements, tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { formatNumber } from '@auditai/i18n';

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
      <section aria-labelledby="admin-empty-title" className="admin">
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

  const [summaries, label] = await Promise.all([listEngagements(current), tenantLabel(current)]);

  const totalExpected = summaries.reduce((acc, s) => acc + s.expectedHeadcount, 0);
  const totalSubmitted = summaries.reduce((acc, s) => acc + s.invitationsSubmitted, 0);
  const totalRatio = totalExpected === 0 ? 0 : totalSubmitted / totalExpected;

  return (
    <section aria-labelledby="admin-title" className="admin">
      <Logo />
      <h1 id="admin-title" style={{ marginTop: 'var(--space-4)' }}>
        {t('admin.engagements.title')}
      </h1>
      <p className="muted">{t('admin.engagements.dataFrom')}</p>
      <TenantSwitcher currentTenantId={current} />
      <p>
        {t('admin.engagements.viewing', {
          label,
          pct: formatNumber(locale, totalRatio, { style: 'percent', maximumFractionDigits: 0 }),
        })}{' '}
        <span className="muted">
          {t('admin.engagements.expected', { submitted: totalSubmitted, expected: totalExpected })}
        </span>
      </p>
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
