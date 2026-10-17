import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { listDeletionEvents } from '@/lib/deletionData';
import { listExportRequests } from '@/lib/exportData';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate } from '@auditai/i18n';
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
  const { t, locale } = getT();
  const when = (iso: string): string =>
    formatDate(locale, iso, { dateStyle: 'medium', timeStyle: 'short' });
  const tenants = await sessionTenantIds();
  const current = (tenants.find((x) => x === requested(searchParams.tenant)) ?? tenants[0]) as
    | TenantId
    | undefined;
  if (!current) {
    return (
      <main className="container">
        <Logo />
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
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
      <h1 style={{ marginTop: 'var(--space-4)' }}>{t('admin.data.title')}</h1>
      <p className="muted">{t('admin.data.intro', { label })}</p>
      <p>
        <Link className="btn-ghost" href="/board">
          {t('admin.common.backToBoard')}
        </Link>{' '}
        <Link className="btn-ghost" href="/admin/synergies">
          {t('admin.data.synergiesLink')}
        </Link>{' '}
        <Link className="btn-ghost" href="/admin/teams">
          {t('admin.data.teamsLink')}
        </Link>
      </p>

      <section className="card">
        <h2>{t('admin.data.exportTitle')}</h2>
        <p className="muted">{t('admin.data.exportBody')}</p>
        <ExportForm tenantId={current} />
      </section>

      <section className="card">
        <h2>{t('admin.data.eraseTitle')}</h2>
        <p className="muted">{t('admin.data.eraseBody')}</p>
        <DeleteForm tenantId={current} />
      </section>

      <section className="card">
        <h3>{t('admin.data.recentExports', { n: exports.length })}</h3>
        {exports.length === 0 ? (
          <p className="muted">{t('admin.data.noExports')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.data.colWhen')}</th>
                  <th>{t('admin.data.colKind')}</th>
                  <th>{t('admin.data.colStatus')}</th>
                  <th>{t('admin.data.colRows')}</th>
                  <th>{t('admin.data.colError')}</th>
                </tr>
              </thead>
              <tbody>
                {exports.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td>{when(e.createdAt)}</td>
                    <td>{enumLabel(t, 'exportKind', e.kind)}</td>
                    <td>{e.status}</td>
                    <td>{e.rowCount}</td>
                    <td className="muted">{e.error ?? t('common.dash')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>{t('admin.data.recentDeletions', { n: deletions.length })}</h3>
        {deletions.length === 0 ? (
          <p className="muted">{t('admin.data.noDeletions')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.data.colWhen')}</th>
                  <th>{t('admin.data.colScope')}</th>
                  <th>{t('admin.data.colPseudonym')}</th>
                  <th>{t('admin.data.colTarget')}</th>
                </tr>
              </thead>
              <tbody>
                {deletions.slice(0, 20).map((d) => (
                  <tr key={d.id}>
                    <td>{when(d.createdAt)}</td>
                    <td>{d.scope}</td>
                    <td>{d.respondentPseudonym ?? t('common.dash')}</td>
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
        .data-form label { display: flex; flex-direction: column; font-size: 12px;
          color: var(--color-muted); gap: 4px; min-width: 0; width: 100%; max-width: 420px; }
        .data-form input, .data-form select { width: 100%; box-sizing: border-box; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .data-table th, .data-table td { padding: 6px 8px; border-bottom: 1px solid var(--color-border);
          text-align: left; font-size: 12px; }
        .btn-ghost { display: inline-block; padding: 8px 14px; border: 1px solid var(--color-border);
          border-radius: 6px; text-decoration: none; color: inherit; margin-right: 6px; }
      `}</style>
    </main>
  );
}

const requested = (raw: string | undefined): string | undefined => raw;
