import { PageTitle } from '@evolai/ui';
import { sessionTenantIds } from '@/lib/authServer';
import {
  CODE_SEARCH_LIMIT,
  findRespondentCodes,
  listDeletionEvents,
  listLinkBatches,
} from '@/lib/deletionData';
import { listPrivacyRequests } from '@/lib/privacyRequests';
import { parseDay } from '@/lib/auditTrail';
import { isUuid } from '@/lib/invitationForm';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { listExportRequests } from '@/lib/exportData';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate, type MessageKey } from '@evolai/i18n';
import { DeleteForm, ExportForm, HandleRequestForm } from './DataAdminClient';
import type { TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string; code?: string; batch?: string; from?: string; to?: string };
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
  const batchId = searchParams.batch && isUuid(searchParams.batch) ? searchParams.batch : undefined;
  const from = parseDay(searchParams.from);
  const to = parseDay(searchParams.to);
  const searched = Boolean(batchId || from || to);
  const [exports, deletions, batches, requests, found] = await Promise.all([
    listExportRequests(current),
    listDeletionEvents(current),
    listLinkBatches(current),
    listPrivacyRequests(current),
    searched ? findRespondentCodes(current, { batchId, from, to }) : null,
  ]);
  const initialCode = /^[a-z0-9-]{8,64}$/.test(searchParams.code ?? '')
    ? (searchParams.code ?? '')
    : '';
  return (
    <div className="wide">
      <PageTitle title={t('admin.data.title')} subtitle={t('admin.data.intro')} />

      <section className="card">
        <h2>{t('admin.data.exportTitle')}</h2>
        <p className="muted">{t('admin.data.exportBody')}</p>
        <ExportForm tenantId={current} />
      </section>

      <section className="card" id="erase">
        <h2>{t('admin.data.eraseTitle')}</h2>
        <p className="muted">{t('admin.data.eraseBody')}</p>
        <DeleteForm key={initialCode} tenantId={current} initialCode={initialCode} />
      </section>

      <section className="card" aria-labelledby="find-title">
        <h2 id="find-title">{t('trust.data.findTitle')}</h2>
        <p className="muted">{t('trust.data.findIntro')}</p>
        <Stack
          component="form"
          method="get"
          action="/admin/data"
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 3, alignItems: { sm: 'flex-start' }, mb: 3 }}
        >
          <input type="hidden" name="tenant" value={current} />
          <TextField
            select
            name="batch"
            label={t('trust.data.batch')}
            defaultValue={batchId ?? ''}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="">{t('trust.data.allBatches')}</MenuItem>
            {batches.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {t('trust.data.batchOption', {
                  when: formatDate(locale, b.createdAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                  n: b.count,
                })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            name="from"
            label={t('trust.data.from')}
            defaultValue={from ?? ''}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            name="to"
            label={t('trust.data.to')}
            defaultValue={to ?? ''}
            InputLabelProps={{ shrink: true }}
          />
          <Button type="submit" variant="outlined" sx={{ minHeight: 56 }}>
            {t('trust.data.search')}
          </Button>
        </Stack>
        {found ? (
          found.rows.length === 0 ? (
            <p>{t('trust.data.noneFound')}</p>
          ) : (
            <>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label={t('trust.data.findTitle')}
              >
                <table className="data-table" data-testid="code-results">
                  <thead>
                    <tr>
                      <th>{t('trust.data.colCode')}</th>
                      <th>{t('trust.data.colTeam')}</th>
                      <th>{t('trust.data.colStatus')}</th>
                      <th>{t('trust.data.colDate')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {found.rows.map((r) => (
                      <tr key={r.code}>
                        <td>
                          <code>{r.code}</code>
                        </td>
                        <td>{r.teamName}</td>
                        <td>{t(`trust.data.status.${r.status}` as MessageKey)}</td>
                        <td>{when(r.createdAt)}</td>
                        <td>
                          <Button
                            size="small"
                            variant="text"
                            href={`/admin/data?tenant=${current}&code=${encodeURIComponent(r.code)}#erase`}
                            aria-label={t('trust.data.useCodeAria', { code: r.code })}
                          >
                            {t('trust.data.use')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {found.truncated ? (
                <p className="muted">{t('trust.data.limit', { n: CODE_SEARCH_LIMIT })}</p>
              ) : null}
            </>
          )
        ) : null}
      </section>

      <section className="card" aria-labelledby="requests-title">
        <h2 id="requests-title">{t('trust.data.requestsTitle')}</h2>
        <p className="muted">{t('trust.data.requestsIntro')}</p>
        {requests.length === 0 ? (
          <p>{t('trust.data.requestsNone')}</p>
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t('trust.data.requestsTitle')}
          >
            <table className="data-table" data-testid="privacy-requests">
              <thead>
                <tr>
                  <th>{t('admin.data.colWhen')}</th>
                  <th>{t('trust.data.colKind')}</th>
                  <th>{t('trust.data.colCode')}</th>
                  <th>{t('trust.data.colMessage')}</th>
                  <th>{t('admin.data.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{when(r.createdAt)}</td>
                    <td>
                      {t(
                        r.kind === 'erase'
                          ? 'trust.data.kindErase'
                          : r.kind === 'withdraw'
                            ? 'trust.data.kindWithdraw'
                            : 'trust.data.kindQuestion',
                      )}
                    </td>
                    <td>{r.code ? <code>{r.code}</code> : t('common.dash')}</td>
                    <td>
                      {r.message ?? t('common.dash')}
                      {r.replyTo ? <div className="muted">{r.replyTo}</div> : null}
                    </td>
                    <td>
                      {r.status === 'open' ? (
                        <HandleRequestForm tenantId={current} id={r.id} />
                      ) : (
                        t('trust.data.handled')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
