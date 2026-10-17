import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { engagementLabelFor, listAuditLogForTarget } from '@/lib/auditorData';
import { getOpportunity } from '@/lib/opportunityData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { TransitionForm } from './TransitionForm';
import {
  OPPORTUNITY_STATUS_LABELS,
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

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
};

export default async function OpportunityDetailPage({ params, searchParams }: PageProps) {
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="container admin">
        <Logo />
        <h1 id="empty-title">Opportunity \u2014 no tenants</h1>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((t) => t === requested) === undefined) {
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
    return (
      <section aria-labelledby="missing-title" className="container admin">
        <Logo />
        <h1 id="missing-title">Opportunity not found</h1>
        <p>
          <code>{params.opportunityId}</code> is not in tenant <strong>{tenantName}</strong>. Go
          back to the{' '}
          <Link href={`/admin/engagements/${params.id}/opportunities?tenant=${tenantId}`}>
            opportunities list
          </Link>
          .
        </p>
      </section>
    );
  }

  const next = nextOpportunityStatuses(opp.status);

  return (
    <section aria-labelledby="opp-detail-title" className="container admin">
      <Logo />
      <h1 id="opp-detail-title" style={{ marginTop: 'var(--space-4)' }}>
        {opp.title}
      </h1>
      <p className="muted">
        Engagement <strong>{label?.organisation ?? params.id}</strong> \u00b7 tenant{' '}
        <strong>{tenantName}</strong> \u00b7 status{' '}
        <strong>{OPPORTUNITY_STATUS_LABELS[opp.status]}</strong>
        {opp.analysisId ? (
          <>
            {' \u00b7 '}
            <Link
              href={`/admin/engagements/${params.id}/analyses/${opp.analysisId}?tenant=${tenantId}`}
            >
              Source analysis
            </Link>
          </>
        ) : null}
      </p>
      <p>
        <Link href={`/admin/engagements/${params.id}/opportunities?tenant=${tenantId}`}>
          \u2190 Back to opportunities
        </Link>
      </p>

      <h2 style={{ marginTop: 'var(--space-5)' }}>Description</h2>
      {opp.description ? (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: 'var(--color-card)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--space-2)',
          }}
        >
          {opp.description}
        </pre>
      ) : (
        <p className="muted">No description yet.</p>
      )}

      <h2 style={{ marginTop: 'var(--space-5)' }}>Metadata</h2>
      <ul>
        <li>
          Axis: <code>{opp.axis ?? '\u2014'}</code>
        </li>
        <li>Impact score: {opp.impactScore === null ? '\u2014' : opp.impactScore.toFixed(3)}</li>
        <li>
          Created by: <code>{opp.createdBy}</code> on {formatDateTime(opp.createdAt)}
        </li>
        <li>Updated at: {formatDateTime(opp.updatedAt)}</li>
        <li>Archived at: {formatDateTime(opp.archivedAt)}</li>
      </ul>

      <h2 style={{ marginTop: 'var(--space-5)' }}>Status transition</h2>
      {next.length === 0 ? (
        <p className="muted">
          No further transitions allowed from{' '}
          <strong>{OPPORTUNITY_STATUS_LABELS[opp.status]}</strong>.
        </p>
      ) : (
        <TransitionForm
          tenantId={tenantId}
          opportunityId={opportunityId}
          current={opp.status}
          options={next}
        />
      )}

      <h2 style={{ marginTop: 'var(--space-5)' }}>Audit trail ({auditLog.length})</h2>
      {auditLog.length === 0 ? (
        <p className="muted">No audit log entries yet.</p>
      ) : (
        <ul>
          {auditLog.map((row) => (
            <li key={row.id}>
              <code>{formatDateTime(row.createdAt)}</code> \u00b7 <code>{row.action}</code> by{' '}
              <code>{row.actorUserId}</code> \u2014 payload{' '}
              <code>{JSON.stringify(row.payload)}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
