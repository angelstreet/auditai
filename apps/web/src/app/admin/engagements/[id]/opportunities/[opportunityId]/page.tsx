import { redirect } from 'next/navigation';
import Link from 'next/link';
import { enumLabel, getT } from '@/lib/i18n';
import { aroundLink } from '@/lib/richText';
import { formatDate, formatNumber } from '@auditai/i18n';

import { engagementLabelFor, listAuditLogForTarget } from '@/lib/auditorData';
import { getOpportunity } from '@/lib/opportunityData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { TransitionForm } from './TransitionForm';
import {
  nextOpportunityStatuses,
  type EngagementId,
  type OpportunityId,
  type TenantId,
} from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; opportunityId: string };
  searchParams: { tenant?: string };
}

export default async function OpportunityDetailPage({ params, searchParams }: PageProps) {
  const { t, locale } = getT();
  const formatDateTime = (iso: string | null): string =>
    iso ? formatDate(locale, iso, { dateStyle: 'medium', timeStyle: 'short' }) : t('common.dash');
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
    redirect(
      `/admin/engagements/${params.id}/opportunities/${params.opportunityId}?tenant=${current}`,
    );
  }
  const tenantId = current as TenantId;
  const engagementId = params.id as EngagementId;
  const opportunityId = params.opportunityId as OpportunityId;
  const [opp, label, auditLog, tenantName] = await Promise.all([
    getOpportunity(tenantId, opportunityId),
    engagementLabelFor(tenantId, engagementId),
    listAuditLogForTarget(tenantId, 'opportunity', opportunityId, 25),
    tenantLabel(tenantId),
  ]);

  if (!opp) {
    const [notFoundBefore, notFoundAfter] = aroundLink((vars) =>
      t('admin.oppDetail.notFoundBody', { ...vars, id: params.opportunityId, tenant: tenantName }),
    );
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.oppDetail.notFound')}</h1>
        <p>
          {notFoundBefore}
          <Link href={`/admin/engagements/${params.id}/opportunities?tenant=${tenantId}`}>
            {t('admin.oppDetail.listLink')}
          </Link>
          {notFoundAfter}
        </p>
      </section>
    );
  }

  const next = nextOpportunityStatuses(opp.status);

  return (
    <section aria-labelledby="opp-detail-title" className="wide admin">
      <h1 id="opp-detail-title">{opp.title}</h1>
      <p className="muted">
        {t('admin.oppDetail.meta', {
          org: label?.organisation ?? params.id,
          tenant: tenantName,
          status: t(`status.${opp.status}`),
        })}
        {opp.analysisId ? (
          <>
            {' \u00b7 '}
            <Link
              href={`/admin/engagements/${params.id}/analyses/${opp.analysisId}?tenant=${tenantId}`}
            >
              {t('admin.oppDetail.sourceAnalysis')}
            </Link>
          </>
        ) : null}
      </p>
      <p>
        <Link href={`/admin/engagements/${params.id}/opportunities?tenant=${tenantId}`}>
          {t('admin.common.backToOpportunities')}
        </Link>
      </p>

      <h2 className="section-title">{t('admin.oppDetail.description')}</h2>
      {opp.description ? (
        <pre className="card prewrap">{opp.description}</pre>
      ) : (
        <p className="muted">{t('admin.oppDetail.noDescription')}</p>
      )}

      <h2 className="section-title">{t('admin.oppDetail.metadata')}</h2>
      <ul>
        <li>
          {t('admin.oppDetail.axis', {
            value: opp.axis ? enumLabel(t, 'axis', opp.axis) : t('common.dash'),
          })}
        </li>
        <li>{t('admin.oppDetail.impact', { value: impact(opp.impactScore) })}</li>
        <li>
          {t('admin.oppDetail.createdBy', {
            who: String(opp.createdBy),
            when: formatDateTime(opp.createdAt),
          })}
        </li>
        <li>{t('admin.oppDetail.updatedAt', { when: formatDateTime(opp.updatedAt) })}</li>
        <li>{t('admin.oppDetail.archivedAt', { when: formatDateTime(opp.archivedAt) })}</li>
      </ul>

      <h2 className="section-title">{t('admin.oppDetail.transition')}</h2>
      {next.length === 0 ? (
        <p className="muted">
          {t('admin.oppDetail.noTransition', { status: t(`status.${opp.status}`) })}
        </p>
      ) : (
        <TransitionForm
          tenantId={tenantId}
          opportunityId={opportunityId}
          current={opp.status}
          options={next}
        />
      )}

      <h2 className="section-title">{t('admin.analysis.auditTrail', { n: auditLog.length })}</h2>
      {auditLog.length === 0 ? (
        <p className="muted">{t('admin.analysis.noAudit')}</p>
      ) : (
        <ul>
          {auditLog.map((row) => (
            <li key={row.id}>
              {t('admin.analysis.auditLine', {
                when: formatDateTime(row.createdAt),
                action: row.action,
                actor: String(row.actorUserId),
                payload: JSON.stringify(row.payload),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
