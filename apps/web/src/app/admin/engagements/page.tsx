import { redirect } from 'next/navigation';
import EngagementRow from '@/components/admin/EngagementRow';
import TenantSwitcher from '@/components/admin/TenantSwitcher';
import { listEngagements, listTenantIds, tenantLabel } from '@/lib/adminData';

/**
 * Admin \u2014 list audit engagements with completion counts (PRD FR-01, FR-09).
 *
 * The page accepts a `?tenant=<uuid>` query parameter. When omitted, the first synthetic tenant
 * wins; an unknown value redirects to the default. The data is in-memory in M6 and becomes a
 * Postgres query in Phase 2 (the underlying schema already lives in `infra/db/migrations`).
 *
 * Tenant isolation is enforced server-side: `listEngagements(tenantId)` only returns rows whose
 * `tenant_id` matches. There is no client-side filter that could leak rows.
 */

const PERCENT_FORMAT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

interface SearchParams {
  tenant?: string;
}

export default function AdminEngagementsPage({ searchParams }: { searchParams: SearchParams }) {
  const tenants = listTenantIds();
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) {
    return (
      <section aria-labelledby="admin-empty-title">
        <h1 id="admin-empty-title">Admin \u2014 no tenants</h1>
        <p>No tenants are configured yet. Add one via the onboarding flow.</p>
      </section>
    );
  }
  if (requested && tenants.find((t) => t === requested) === undefined) {
    redirect(`/admin/engagements?tenant=${current}`);
  }

  const summaries = listEngagements(current);

  const totalExpected = summaries.reduce((acc, s) => acc + s.expectedHeadcount, 0);
  const totalSubmitted = summaries.reduce((acc, s) => acc + s.invitationsSubmitted, 0);
  const totalRatio = totalExpected === 0 ? 0 : totalSubmitted / totalExpected;

  return (
    <section aria-labelledby="admin-title" className="admin">
      <h1 id="admin-title">Admin \u2014 audit engagements</h1>
      <p className="muted">
        Synthetic fixtures; production data comes from Postgres (M4 schema) in Phase 2.
      </p>
      <TenantSwitcher currentTenantId={current} />
      <p>
        Viewing <strong>{tenantLabel(current)}</strong>. Overall completion:{' '}
        <strong>{PERCENT_FORMAT.format(totalRatio)}</strong>{' '}
        <span className="muted">
          ({totalSubmitted} / {totalExpected} expected responses)
        </span>
        .
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Engagement</th>
            <th scope="col">Status</th>
            <th scope="col">Expected headcount</th>
            <th scope="col">Invitations</th>
            <th scope="col">Submitted</th>
            <th scope="col">Opened</th>
            <th scope="col">Pending</th>
            <th scope="col">Revoked / expired</th>
            <th scope="col">Completion</th>
            <th scope="col">Closes</th>
          </tr>
        </thead>
        <tbody>
          {summaries.length === 0 ? (
            <tr>
              <td colSpan={10}>No engagements in this tenant.</td>
            </tr>
          ) : (
            summaries.map((summary) => (
              <EngagementRow key={summary.engagement.id} summary={summary} />
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
