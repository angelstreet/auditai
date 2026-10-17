import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { listSynergies } from '@/lib/synergyData';
import { TransitionSynergyForm } from './TransitionSynergyForm';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

const SYNERGY_TONE: Record<string, string> = {
  detected: 'pill-detected',
  surfaced: 'pill-surfaced',
  dismissed: 'pill-dismissed',
  archived: 'pill-archived',
};

export default async function SynergiesPage({ searchParams }: PageProps) {
  const tenants = await sessionTenantIds();
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
  const [label, synergies] = await Promise.all([tenantLabel(current), listSynergies(current)]);
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>Detected synergies</h1>
      <p className="muted">
        Tenant <strong>{label}</strong>. The cross-team detector writes one row per recurrence of a
        maturity theme across &ge; 2 engagements in this tenant. Each row is append-only once
        detected; transitions (surface / dismiss / archive) are audited in
        <code>audit_log</code>.
      </p>
      <p>
        <Link className="btn-ghost" href="/board">
          ← Portfolio board
        </Link>
      </p>
      <p className="muted">
        <strong>{synergies.length}</strong> synergy row(s). Run{' '}
        <code>pnpm --filter @auditai/ai run synergy-smoke</code> after approving analyses to
        populate or refresh this list.
      </p>
      {synergies.length === 0 ? (
        <section className="empty-state">
          <p className="muted">
            No synergies detected yet. Approve analyses across two or more engagements in this
            tenant and re-run the detector.
          </p>
        </section>
      ) : (
        <ul className="synergy-list">
          {synergies.map((s) => (
            <li key={s.id} className={`synergy-row ${SYNERGY_TONE[s.status] ?? ''}`}>
              <header>
                <span className={`pill ${SYNERGY_TONE[s.status] ?? ''}`}>{s.status}</span>
                <strong>{s.themeLabel}</strong>
                <span className="axis-tag">{s.axis}</span>
              </header>
              <p className="prompt">{s.proposedFollowupPrompt}</p>
              <dl>
                <dt>Detected</dt>
                <dd>{s.detectedAt}</dd>
                <dt>Surfaced</dt>
                <dd>{s.surfacedAt ?? '—'}</dd>
                <dt>Dismissed</dt>
                <dd>{s.dismissedAt ?? '—'}</dd>
                <dt>Occurrences</dt>
                <dd>
                  {s.occurrenceCount} engagement(s), {s.sourceAnalysisIds.length} analysis /
                  analyses
                </dd>
                <dt>Source engagements</dt>
                <dd>
                  <code className="src-ids">
                    {s.sourceEngagementIds.map((e) => e.slice(0, 8)).join(', ')}
                  </code>
                </dd>
              </dl>
              {s.status !== 'archived' ? (
                <TransitionSynergyForm
                  tenantId={current}
                  synergyId={s.id}
                  currentStatus={s.status}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .empty-state { padding: 24px; border: 1px dashed var(--color-border); border-radius: 8px; }
        .synergy-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
        .synergy-row { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 16px 18px; }
        .synergy-row header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .synergy-row .prompt { font-size: 14px; color: var(--color-fg); margin: 6px 0 10px; }
        .synergy-row dl { display: grid; grid-template-columns: 160px 1fr; row-gap: 4px;
          column-gap: 12px; font-size: 12px; margin: 0 0 12px; }
        .synergy-row dt { color: var(--color-muted); }
        .synergy-row dd { margin: 0; font-weight: 500; font-family: var(--font-mono, monospace); }
        .synergy-row .src-ids { font-size: 11px; color: var(--color-muted); }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
        .pill-detected  { background: var(--color-brand-supporting); color: var(--color-brand-off-white); }
        .pill-surfaced  { background: var(--color-brand-teal); color: var(--color-brand-off-white); }
        .pill-dismissed { background: #c5c5c5; color: #1a1a1a; }
        .pill-archived  { background: #888; color: var(--color-brand-off-white); }
        .axis-tag { font-size: 10px; background: var(--color-bg); border: 1px solid var(--color-border);
          padding: 1px 6px; border-radius: 999px; color: var(--color-muted); }
        .btn-ghost { display: inline-block; padding: 8px 14px; border: 1px solid var(--color-border);
          border-radius: 6px; text-decoration: none; color: inherit; margin-right: 6px; }
      `}</style>
    </main>
  );
}
