import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { engagementLabelFor, listAnalysesForEngagement } from '@/lib/auditorData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import type { EngagementId, TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string };
}

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
};

const SENSITIVITY_LABEL: Record<'public' | 'internal' | 'sensitive', string> = {
  public: 'Public',
  internal: 'Internal',
  sensitive: 'Sensitive',
};

export default async function AnalysesListPage({ params, searchParams }: PageProps) {
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="container admin">
        <Logo />
        <h1 id="empty-title">Analyses \u2014 no tenants</h1>
        <p>
          No tenants are configured. Run <code>pnpm local:reset</code> to seed synthetic data.
        </p>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((t) => t === requested) === undefined) {
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
      <section aria-labelledby="missing-title" className="container admin">
        <Logo />
        <h1 id="missing-title">Engagement not found</h1>
        <p>
          <code>{params.id}</code> is not in tenant <strong>{tenantName}</strong>. Pick a different
          tenant or go back to the{' '}
          <Link href={`/admin/engagements?tenant=${tenantId}`}>engagements list</Link>.
        </p>
      </section>
    );
  }

  const approvedCount = summaries.filter((s) => s.approvedAt !== null).length;
  const pendingCount = summaries.length - approvedCount;

  return (
    <section aria-labelledby="analyses-title" className="container admin">
      <Logo />
      <h1 id="analyses-title" style={{ marginTop: 'var(--space-4)' }}>
        Analyses \u2014 {label.organisation}
      </h1>
      <p className="muted">
        Tenant <strong>{tenantName}</strong> \u00b7 engagement <code>{params.id}</code> \u00b7
        status <strong>{label.status}</strong>. {summaries.length} analysis row(s) ({pendingCount}{' '}
        pending, {approvedCount} approved).
      </p>
      <p>
        <Link href={`/admin/engagements?tenant=${tenantId}`}>\u2190 Back to engagements</Link>
        {' \u00b7 '}
        <Link href={`/admin/engagements/${params.id}/opportunities?tenant=${tenantId}`}>
          View opportunities
        </Link>
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Pseudonym</th>
            <th scope="col">Sensitivity</th>
            <th scope="col">Themes</th>
            <th scope="col">Prompts</th>
            <th scope="col">Model route</th>
            <th scope="col">Submitted</th>
            <th scope="col">Approved</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {summaries.length === 0 ? (
            <tr>
              <td colSpan={8}>
                No analyses for this engagement yet. Run{' '}
                <code>pnpm --filter @auditai/ai run smoke</code> to populate them.
              </td>
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
                  <span className="muted">{s.invitationStatus}</span>
                </th>
                <td>{SENSITIVITY_LABEL[s.sensitivity]}</td>
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
                    <span className="muted">pending</span>
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/engagements/${params.id}/analyses/${s.analysisId}?tenant=${tenantId}`}
                  >
                    Review
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
