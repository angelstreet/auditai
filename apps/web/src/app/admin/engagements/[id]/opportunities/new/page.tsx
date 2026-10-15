import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { engagementLabelFor, getAnalysis } from '@/lib/auditorData';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { CreateOpportunityForm } from './CreateOpportunityForm';
import { type AnalysisId, type EngagementId, type TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string; analysis?: string };
}

export default async function NewOpportunityPage({ params, searchParams }: PageProps) {
  const tenants = await listTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="container admin">
        <Logo />
        <h1 id="empty-title">New opportunity \u2014 no tenants</h1>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((t) => t === requested) === undefined) {
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
      <section aria-labelledby="missing-title" className="container admin">
        <Logo />
        <h1 id="missing-title">Engagement not found</h1>
      </section>
    );
  }

  if (!analysisId || !analysis) {
    return (
      <section aria-labelledby="missing-title" className="container admin">
        <Logo />
        <h1 id="missing-title">No analysis selected</h1>
        <p>
          The create-from-analysis flow needs an analysis id. Open the{' '}
          <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
            analyses page
          </Link>{' '}
          and click <em>Create opportunity</em> on an approved analysis.
        </p>
      </section>
    );
  }

  const defaultTitle = analysis.respondentPseudonym
    ? `Opportunity from ${analysis.respondentPseudonym}`
    : `Opportunity from ${analysis.analysisId.slice(0, 8)}`;

  return (
    <section aria-labelledby="new-title" className="container admin">
      <Logo />
      <h1 id="new-title" style={{ marginTop: 'var(--space-4)' }}>
        New opportunity \u2014 {label.organisation}
      </h1>
      <p className="muted">
        Tenant <strong>{tenantName}</strong> \u00b7 engagement <code>{params.id}</code> \u00b7
        source analysis <code>{analysis.analysisId}</code> \u00b7 sensitivity{' '}
        <strong>{analysis.sensitivity}</strong> \u00b7 model route{' '}
        <code>{analysis.modelRoute}</code>.
      </p>
      <p>
        <Link
          href={`/admin/engagements/${params.id}/analyses/${analysis.analysisId}?tenant=${tenantId}`}
        >
          \u2190 Back to analysis
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
