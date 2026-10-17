import { redirect } from 'next/navigation';
import EngagementRow from '@/components/admin/EngagementRow';
import TenantSwitcher from '@/components/admin/TenantSwitcher';
import { Logo } from '@/components/Logo';
import { listEngagements, tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

const PERCENT_FORMAT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 0,
});

interface SearchParams {
  tenant?: string;
}

export default async function AdminEngagementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="admin-empty-title" className="admin">
        <h1 id="admin-empty-title">Admin \u2014 no tenants</h1>
        <p>No tenants are configured yet. Run \`pnpm local:reset\` to seed synthetic data.</p>
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
        EvolAI \u2014 audit engagements
      </h1>
      <p className="muted">Data from Postgres; the M4 schema drives the queries.</p>
      <TenantSwitcher currentTenantId={current} />
      <p>
        Viewing <strong>{label}</strong>. Overall completion:{' '}
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
              <EngagementRow key={summary.engagement.id} summary={summary} tenantId={current} />
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
