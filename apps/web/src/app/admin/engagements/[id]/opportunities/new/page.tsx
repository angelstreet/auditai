import { redirect } from 'next/navigation';
import Link from 'next/link';
import { enumLabel, getT } from '@/lib/i18n';
import { aroundLink } from '@/lib/richText';

import { engagementLabelFor, getAnalysis } from '@/lib/auditorData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { CreateOpportunityForm } from './CreateOpportunityForm';
import { type AnalysisId, type EngagementId, type TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string; analysis?: string };
}

export default async function NewOpportunityPage({ params, searchParams }: PageProps) {
  const { t } = getT();
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
    redirect(`/admin/engagements/${params.id}/opportunities/new?tenant=${current}`);
  }
  const tenantId = current as TenantId;
  const engagementId = params.id as EngagementId;
  const analysisId = (searchParams.analysis ?? '') as AnalysisId;

  const [label, analysis, tenantName] = await Promise.all([
    engagementLabelFor(tenantId, engagementId),
    analysisId ? getAnalysis(tenantId, analysisId) : Promise.resolve(null),
    tenantLabel(tenantId),
  ]);

  if (!label) {
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.common.engagementNotFound')}</h1>
      </section>
    );
  }

  if (!analysisId || !analysis) {
    const [noAnalysisBefore, noAnalysisAfter] = aroundLink((vars) =>
      t('admin.oppNew.noAnalysisBody', vars),
    );
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.oppNew.noAnalysis')}</h1>
        <p>
          {noAnalysisBefore}
          <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
            {t('admin.opps.analysesPage')}
          </Link>
          {noAnalysisAfter}
        </p>
      </section>
    );
  }

  const defaultTitle = t('admin.oppNew.defaultFromPseudonym', {
    name: analysis.respondentPseudonym || analysis.analysisId.slice(0, 8),
  });

  return (
    <section aria-labelledby="new-title" className="wide admin">
      <h1 id="new-title">{t('admin.oppNew.title', { org: label.organisation })}</h1>
      <p className="muted">
        {t('admin.oppNew.meta', {
          tenant: tenantName,
          id: params.id,
          analysis: analysis.analysisId,
          sensitivity: enumLabel(t, 'sensitivity', analysis.sensitivity),
          route: analysis.modelRoute,
        })}
      </p>
      <p>
        <Link
          href={`/admin/engagements/${params.id}/analyses/${analysis.analysisId}?tenant=${tenantId}`}
        >
          {t('admin.oppNew.backToAnalysis')}
        </Link>
      </p>
      <CreateOpportunityForm
        tenantId={tenantId}
        analysisId={analysis.analysisId}
        defaultTitle={defaultTitle}
        engagementId={engagementId}
      />
    </section>
  );
}
