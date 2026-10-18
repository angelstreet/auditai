import { redirect } from 'next/navigation';
import Link from 'next/link';
import { enumLabel, getT } from '@/lib/i18n';
import { aroundLink } from '@/lib/richText';
import { formatDate, formatNumber } from '@auditai/i18n';

import { engagementLabelFor } from '@/lib/auditorData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { listOpportunitiesForEngagement, opportunityStatusCounts } from '@/lib/opportunityData';
import { type EngagementId, type TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string };
}

export default async function OpportunitiesListPage({ params, searchParams }: PageProps) {
  const { t, locale } = getT();
  const formatDateTime = (iso: string | null, long = false): string =>
    iso
      ? formatDate(locale, iso, long ? { dateStyle: 'medium', timeStyle: 'short' } : undefined)
      : t('common.dash');
  const impact = (n: number | null): string =>
    n === null
      ? t('common.dash')
      : formatNumber(locale, n, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="wide admin">
        <h1 id="empty-title">{t('admin.common.noTenantsTitle')}</h1>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((x) => x === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((x) => x === requested) === undefined) {
    redirect(`/admin/engagements/${params.id}/opportunities?tenant=${current}`);
  }
  const tenantId = current as TenantId;
  const engagementId = params.id as EngagementId;
  const [label, opportunities, tenantName] = await Promise.all([
    engagementLabelFor(tenantId, engagementId),
    listOpportunitiesForEngagement(tenantId, engagementId),
    tenantLabel(tenantId),
  ]);

  if (!label) {
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.common.engagementNotFound')}</h1>
        <p>{t('admin.common.notInTenant', { id: params.id, tenant: tenantName })}</p>
      </section>
    );
  }

  const counts = opportunityStatusCounts(opportunities);
  const [noneBefore, noneAfter] = aroundLink((vars) => t('admin.opps.none', vars));

  return (
    <section aria-labelledby="opp-title" className="wide admin">
      <h1 id="opp-title">{t('admin.opps.title', { org: label.organisation })}</h1>
      <p className="muted">
        {t('admin.opps.meta', { tenant: tenantName, id: params.id, n: opportunities.length })}
      </p>
      <p>
        <Link href={`/admin/engagements?tenant=${tenantId}`}>
          {t('admin.common.backToEngagements')}
        </Link>
        {' \u00b7 '}
        <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
          {t('admin.opps.viewAnalyses')}
        </Link>
      </p>

      <ul className="chips">
        {(['draft', 'approved', 'in_progress', 'delivered', 'archived'] as const).map((s) => (
          <li key={s} className="pill pill-muted">
            <strong>{counts[s]}</strong> {t(`status.${s}`)}
          </li>
        ))}
      </ul>

      <table>
        <thead>
          <tr>
            <th scope="col">{t('admin.opps.colTitle')}</th>
            <th scope="col">{t('admin.opps.colStatus')}</th>
            <th scope="col">{t('admin.opps.colAxis')}</th>
            <th scope="col">{t('admin.opps.colImpact')}</th>
            <th scope="col">{t('admin.opps.colCreated')}</th>
            <th scope="col">{t('admin.opps.colUpdated')}</th>
            <th scope="col">{t('admin.opps.colAction')}</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.length === 0 ? (
            <tr>
              <td colSpan={7}>
                {noneBefore}
                <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
                  {t('admin.opps.analysesPage')}
                </Link>
                {noneAfter}
              </td>
            </tr>
          ) : (
            opportunities.map((o) => (
              <tr key={o.id}>
                <th scope="row">
                  <Link
                    href={`/admin/engagements/${params.id}/opportunities/${o.id}?tenant=${tenantId}`}
                  >
                    {o.title}
                  </Link>
                  <br />
                  <span className="muted">{o.id}</span>
                </th>
                <td>{t(`status.${o.status}`)}</td>
                <td>
                  <code>{o.axis ? enumLabel(t, 'axis', o.axis) : t('common.dash')}</code>
                </td>
                <td>{impact(o.impactScore)}</td>
                <td>{formatDateTime(o.createdAt)}</td>
                <td>{formatDateTime(o.updatedAt)}</td>
                <td>
                  <Link
                    href={`/admin/engagements/${params.id}/opportunities/${o.id}?tenant=${tenantId}`}
                  >
                    {t('admin.opps.open')}
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
