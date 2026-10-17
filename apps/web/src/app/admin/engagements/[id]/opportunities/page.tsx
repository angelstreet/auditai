import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { engagementLabelFor } from '@/lib/auditorData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { listOpportunitiesForEngagement, opportunityStatusCounts } from '@/lib/opportunityData';
import { OPPORTUNITY_STATUS_LABELS, type EngagementId, type TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string };
}

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toISOString().slice(0, 10);
};

export default async function OpportunitiesListPage({ params, searchParams }: PageProps) {
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="container admin">
        <Logo />
        <h1 id="empty-title">Opportunities \u2014 no tenants</h1>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((t) => t === requested) === undefined) {
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
      <section aria-labelledby="missing-title" className="container admin">
        <Logo />
        <h1 id="missing-title">Engagement not found</h1>
        <p>
          <code>{params.id}</code> is not in tenant <strong>{tenantName}</strong>.
        </p>
      </section>
    );
  }

  const counts = opportunityStatusCounts(opportunities);

  return (
    <section aria-labelledby="opp-title" className="container admin">
      <Logo />
      <h1 id="opp-title" style={{ marginTop: 'var(--space-4)' }}>
        Opportunities \u2014 {label.organisation}
      </h1>
      <p className="muted">
        Tenant <strong>{tenantName}</strong> \u00b7 engagement <code>{params.id}</code> \u00b7{' '}
        {opportunities.length} opportunity record(s).
      </p>
      <p>
        <Link href={`/admin/engagements?tenant=${tenantId}`}>\u2190 Back to engagements</Link>
        {' \u00b7 '}
        <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
          View analyses
        </Link>
      </p>

      <ul
        aria-label="Status counts"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', listStyle: 'none', padding: 0 }}
      >
        {(['draft', 'approved', 'in_progress', 'delivered', 'archived'] as const).map((s) => (
          <li
            key={s}
            style={{
              background: 'var(--color-card)',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 13,
            }}
          >
            <strong>{counts[s]}</strong> {OPPORTUNITY_STATUS_LABELS[s]}
          </li>
        ))}
      </ul>

      <table>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Axis</th>
            <th scope="col">Impact</th>
            <th scope="col">Created</th>
            <th scope="col">Updated</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.length === 0 ? (
            <tr>
              <td colSpan={7}>
                No opportunities yet. Approve an analysis on the{' '}
                <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
                  analyses page
                </Link>{' '}
                and use <em>Create opportunity</em>.
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
                <td>{OPPORTUNITY_STATUS_LABELS[o.status]}</td>
                <td>
                  <code>{o.axis ?? '\u2014'}</code>
                </td>
                <td>{o.impactScore === null ? '\u2014' : o.impactScore.toFixed(3)}</td>
                <td>{formatDateTime(o.createdAt)}</td>
                <td>{formatDateTime(o.updatedAt)}</td>
                <td>
                  <Link
                    href={`/admin/engagements/${params.id}/opportunities/${o.id}?tenant=${tenantId}`}
                  >
                    Open
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
