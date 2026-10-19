import { PageTitle } from '@evolai/ui';
import { sessionTenantIds } from '@/lib/authServer';
import { listDeletionEvents } from '@/lib/deletionData';
import { listExportRequests } from '@/lib/exportData';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate, type MessageKey } from '@evolai/i18n';
import { DeleteForm, ExportForm } from './DataAdminClient';
import type { TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

/**
 * /admin/data: exports and right-to-erasure.
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
  // Plain words for statuses and kinds; an unknown value shows as it is rather than breaking the page.
  const label = (group: string, value: string): string => {
    const key = `admin.setup.${group}.${value}` as MessageKey;
    const text = t(key);
    return text === key ? value : text;
  };
  const when = (iso: string): string =>
    formatDate(locale, iso, { dateStyle: 'medium', timeStyle: 'short' });
  const tenants = await sessionTenantIds();
  const current = (tenants.find((x) => x === requested(searchParams.tenant)) ?? tenants[0]) as
    | TenantId
    | undefined;
  if (!current) {
    return (
      <div className="wide">
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </div>
    );
  }
  const [exports, deletions] = await Promise.all([
    listExportRequests(current),
    listDeletionEvents(current),
  ]);
  return (
    <div className="wide">
      <PageTitle title={t('admin.data.title')} subtitle={t('admin.data.intro')} />

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
          <div className="table-scroll">
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
                    <td>{label('exportStatus', e.status)}</td>
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
          <div className="table-scroll">
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
                    <td>{label('scope', d.scope)}</td>
                    <td>{d.respondentPseudonym ?? t('common.dash')}</td>
                    <td>{label('targetKind', d.targetKind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const requested = (raw: string | undefined): string | undefined => raw;
