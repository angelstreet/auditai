import { Logo } from '@/components/Logo';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { getLatestSponsorBrief } from '@/lib/sponsorBriefData';
import { IntakeForm } from './IntakeForm';
import { OPPORTUNITY_STATUS_LABELS } from '@auditai/contracts';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

const formatEur = (n: number | null): string =>
  n === null ? '\u2014' : `€${n.toLocaleString('en')}`;

export default async function IntakePage({ searchParams }: PageProps) {
  const tenants = await listTenantIds();
  const requested = searchParams.tenant;
  const current = (tenants.find((t) => t === requested) ?? tenants[0]) as TenantId | undefined;
  if (!current) {
    return (
      <main className="container">
        <Logo />
        <p>
          No tenants configured. Run <code>pnpm local:reset</code> to seed.
        </p>
      </main>
    );
  }
  const [label, latest] = await Promise.all([tenantLabel(current), getLatestSponsorBrief(current)]);
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>Sponsor intake</h1>
      <p className="muted">
        Tenant <strong>{label}</strong>. This form writes a new <code>sponsor_briefs</code>
        row. Re-submitting creates a new brief (the latest is shown in the live summary).
      </p>
      <div className="grid">
        <IntakeForm tenantId={current} />
        <aside className="summary">
          <h3>Live summary</h3>
          <p className="muted">
            What gets written to <code>sponsor_briefs</code> on save.
          </p>
          {latest ? (
            <dl>
              <dt>Tenant</dt>
              <dd>{label}</dd>
              <dt>Top priority</dt>
              <dd>{latest.topPriorityWorkflow || '\u2014'}</dd>
              <dt>Departments</dt>
              <dd>{latest.departmentsInScope.join(', ') || '\u2014'}</dd>
              <dt>Sensitivity</dt>
              <dd>{latest.dataSensitivityBoundary.join(', ') || '\u2014'}</dd>
              <dt>Budget</dt>
              <dd>{formatEur(latest.annualBudgetEur)}</dd>
              <dt>On-site</dt>
              <dd>{latest.onsiteAppetite ?? '\u2014'}</dd>
              <dt>Model region</dt>
              <dd>{latest.approvedModelRegions.join(', ') || '\u2014'}</dd>
              <dt>Residency</dt>
              <dd>{latest.dataResidency.join(', ') || '\u2014'}</dd>
              <dt>Prompt-injection</dt>
              <dd>{latest.promptInjectionReview ?? '\u2014'}</dd>
              <dt>Maturity (avg)</dt>
              <dd>
                {[latest.leadershipLiteracy, latest.operationalAdoption, latest.policyGovernance]
                  .filter((n): n is number => n !== null)
                  .reduce((a, b, _, arr) => a + b / arr.length, 0)
                  .toFixed(1)}{' '}
                / 5
              </dd>
            </dl>
          ) : (
            <p className="muted">No brief submitted yet for this tenant.</p>
          )}
          <p className="muted" style={{ marginTop: 16 }}>
            Status pills on the board (M12):{' '}
            {Object.values(OPPORTUNITY_STATUS_LABELS).join(' \u00b7 ')}.
          </p>
        </aside>
      </div>
      <style>{`
        .grid { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
        .summary { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 18px 20px; position: sticky; top: 16px; }
        .summary h3 { margin: 0 0 8px; font-size: 15px; }
        .summary dl { display: grid; grid-template-columns: 110px 1fr; row-gap: 6px; column-gap: 12px; margin: 0; }
        .summary dt { color: var(--color-muted); font-size: 12px; }
        .summary dd { margin: 0; font-size: 13px; font-weight: 500; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
