import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { listDeletionEvents } from '@/lib/deletionData';
import { listExportRequests } from '@/lib/exportData';
import { DeleteForm, ExportForm } from './DataAdminClient';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

/**
 * /admin/data \u2014 M15 slice B.
 *
 * Two widgets:
 *   - **Export** \u2014 picks one of the six `ExportKind`s and renders the first
 *     1,200 chars of the CSV in a `<pre>` for visual diff (synthetic seed).
 *   - **Erase** \u2014 right-to-erasure for a single pseudonym. Writes
 *     `deletion_events` + `audit_log` rows.
 *
 * The recent export_requests + deletion_events tables give the analyst a
 * trail without leaving the page.
 */
export default async function DataPage({ searchParams }: PageProps) {
  const tenants = await sessionTenantIds();
  const current = (tenants.find((t) => t === requested(searchParams.tenant)) ?? tenants[0]) as
    | TenantId
    | undefined;
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
  const [label, exports, deletions] = await Promise.all([
    tenantLabel(current),
    listExportRequests(current),
    listDeletionEvents(current),
  ]);
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>Data exports + retention</h1>
      <p className="muted">
        Tenant <strong>{label}</strong>. M15 slice B closes FR-09 for the audit team: every export
        and every right-to-erasure is recorded in
        <code>export_requests</code> and <code>deletion_events</code>.
      </p>
      <p>
        <Link className="btn-ghost" href="/board">
          \u2190 Portfolio board
        </Link>{' '}
        <Link className="btn-ghost" href="/admin/synergies">
          Synergies
        </Link>{' '}
        <Link className="btn-ghost" href="/admin/teams">
          Teams
        </Link>
      </p>

      <section className="card">
        <h2>1. Export a tenant table</h2>
        <p className="muted">
          CSV \u2014 RFC 4180 escaping. Each export is one row in
          <code>export_requests</code> with the row count and the actor.
        </p>
        <ExportForm tenantId={current} />
      </section>

      <section className="card">
        <h2>2. Right-to-erasure (single pseudonym)</h2>
        <p className="muted">
          Removes everything held for that pseudonym in this tenant (invitation, respondent,
          submission, answers, analyses, badges, derived draft opportunities) and trims synergies.
          Writes one <code>deletion_events</code> row per kind and one <code>audit_log</code> row;
          both keep only a hash of the pseudonym.
        </p>
        <DeleteForm tenantId={current} />
      </section>

      <section className="card">
        <h3>Recent exports ({exports.length})</h3>
        {exports.length === 0 ? (
          <p className="muted">No exports yet for this tenant.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {exports.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td>{stamp(e.createdAt)}</td>
                    <td>{e.kind}</td>
                    <td>{e.status}</td>
                    <td>{e.rowCount}</td>
                    <td className="muted">{e.error ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Recent deletions ({deletions.length})</h3>
        {deletions.length === 0 ? (
          <p className="muted">No deletions yet for this tenant.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Scope</th>
                  <th>Pseudonym</th>
                  <th>Target kind</th>
                </tr>
              </thead>
              <tbody>
                {deletions.slice(0, 20).map((d) => (
                  <tr key={d.id}>
                    <td>{stamp(d.createdAt)}</td>
                    <td>{d.scope}</td>
                    <td>{d.respondentPseudonym ?? '\u2014'}</td>
                    <td>{d.targetKind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        .card { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 16px 18px; margin: 14px 0; }
        .card h2 { margin: 0 0 8px; font-size: 18px; }
        .card h3 { margin: 0 0 8px; font-size: 15px; }
        .data-form { display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
          margin-top: 12px; }
        .data-form label { display: flex; flex-direction: column; font-size: 12px; min-width: 0; max-width: 100%;
          color: var(--color-muted); gap: 4px; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .data-table th, .data-table td { padding: 6px 8px; border-bottom: 1px solid var(--color-border);
          text-align: left; font-size: 12px; }
        .btn-ghost { display: inline-block; padding: 8px 14px; border: 1px solid var(--color-border);
          border-radius: 6px; text-decoration: none; color: inherit; margin-right: 6px; }
      `}</style>
    </main>
  );
}

/** pg returns Date objects; render a short UTC stamp (React cannot render a Date). */
const stamp = (v: unknown): string =>
  new Date(v as string).toISOString().slice(0, 16).replace('T', ' ');

const requested = (raw: string | undefined): string | undefined => raw;
