import { redirect } from 'next/navigation';
import Link from 'next/link';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate } from '@evolai/i18n';

import { engagementLabelFor, listAnalysesForEngagement } from '@/lib/auditorData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import type { EngagementId, TenantId } from '@evolai/contracts';
import { RunAnalysisForm } from './RunAnalysisForm';

export const dynamic = 'force-dynamic';
// The analysis runs inside the click's request: give it the time the pipeline is bounded to.
export const maxDuration = 60;

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string };
}

export default async function AnalysesListPage({ params, searchParams }: PageProps) {
  const { t, locale } = getT();
  const formatDateTime = (iso: string | null): string =>
    iso ? formatDate(locale, iso, { dateStyle: 'medium', timeStyle: 'short' }) : t('common.dash');
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="wide admin">
        <h1 id="empty-title">{t('admin.common.noTenantsTitle')}</h1>
        <p>{t('admin.common.noTenantsBody', { command: 'pnpm local:reset' })}</p>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((x) => x === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((x) => x === requested) === undefined) {
    redirect(`/admin/engagements/${params.id}/analyses?tenant=${current}`);
  }
  const tenantId = current as TenantId;
  const engagementId = params.id as EngagementId;
  const [label, summaries, tenantName] = await Promise.all([
    engagementLabelFor(tenantId, engagementId),
    listAnalysesForEngagement(tenantId, engagementId),
    tenantLabel(tenantId),
  ]);

  if (!label) {
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.common.engagementNotFound')}</h1>
        <p>
          {t('admin.common.notInTenant', { id: params.id, tenant: tenantName })}{' '}
          <Link href={`/admin/engagements?tenant=${tenantId}`}>
            {t('admin.common.backToEngagements')}
          </Link>
        </p>
      </section>
    );
  }

  const approvedCount = summaries.filter((s) => s.approvedAt !== null).length;
  const pendingCount = summaries.length - approvedCount;

  return (
    <section aria-labelledby="analyses-title" className="wide admin">
      <h1 id="analyses-title">{t('admin.analyses.title', { org: label.organisation })}</h1>
      <p className="muted">
        {t('admin.analyses.meta', {
          tenant: tenantName,
          id: params.id,
          status: enumLabel(t, 'engagementStatus', label.status),
          total: summaries.length,
          pending: pendingCount,
          approved: approvedCount,
        })}
      </p>
      <p>
        <Link href={`/admin/engagements?tenant=${tenantId}`}>
          {t('admin.common.backToEngagements')}
        </Link>
        {' \u00b7 '}
        <Link href={`/admin/engagements/${params.id}/opportunities?tenant=${tenantId}`}>
          {t('admin.analyses.viewOpps')}
        </Link>
        {' \u00b7 '}
        <Link href={`/admin/engagements/${params.id}/answers?tenant=${tenantId}`}>
          {t('admin.analyses.viewAnswers')}
        </Link>
      </p>
      <RunAnalysisForm tenantId={tenantId} engagementId={engagementId} />
      <table>
        <thead>
          <tr>
            <th scope="col">{t('admin.analyses.colPseudonym')}</th>
            <th scope="col">{t('admin.analyses.colSensitivity')}</th>
            <th scope="col">{t('admin.analyses.colThemes')}</th>
            <th scope="col">{t('admin.analyses.colPrompts')}</th>
            <th scope="col">{t('admin.analyses.colRoute')}</th>
            <th scope="col">{t('admin.analyses.colSubmitted')}</th>
            <th scope="col">{t('admin.analyses.colApproved')}</th>
            <th scope="col">{t('admin.analyses.colAction')}</th>
          </tr>
        </thead>
        <tbody>
          {summaries.length === 0 ? (
            <tr>
              <td colSpan={8}>{t('admin.analyses.none')}</td>
            </tr>
          ) : (
            summaries.map((s) => (
              <tr key={s.analysisId}>
                <th scope="row">
                  <Link
                    href={`/admin/engagements/${params.id}/analyses/${s.analysisId}?tenant=${tenantId}`}
                  >
                    {s.respondentPseudonym}
                  </Link>
                  <br />
                  <span className="muted">
                    {enumLabel(t, 'invitationStatus', s.invitationStatus)}
                  </span>
                </th>
                <td>{enumLabel(t, 'sensitivity', s.sensitivity)}</td>
                <td>{s.themeCount}</td>
                <td>{s.promptCount}</td>
                <td>
                  <code>{s.modelRoute}</code>
                </td>
                <td>{formatDateTime(s.submittedAt)}</td>
                <td>
                  {s.approvedAt ? (
                    <>
                      <strong>{formatDateTime(s.approvedAt)}</strong>
                      <br />
                      <span className="muted">{s.approvedBy}</span>
                    </>
                  ) : (
                    <span className="muted">{t('admin.common.pending')}</span>
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/engagements/${params.id}/analyses/${s.analysisId}?tenant=${tenantId}`}
                  >
                    {t('admin.analyses.review')}
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
