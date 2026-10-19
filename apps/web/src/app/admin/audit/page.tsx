import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AppIcon, PageTitle } from '@evolai/ui';
import { formatDate, type MessageKey } from '@evolai/i18n';
import { sessionTenantIds } from '@/lib/authServer';
import {
  AUDIT_GROUP_KEYS,
  AUDIT_LIMIT,
  actionKey,
  listAuditTrail,
  parseDay,
  parseGroup,
} from '@/lib/auditTrail';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string; group?: string; from?: string; to?: string };
}

/** /admin/audit: who did what, in plain words, with filters and a CSV (TASK-U, ADR 0040). */
export default async function AuditPage({ searchParams }: PageProps) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  const current = tenants.find((x) => x === searchParams.tenant) ?? tenants[0];
  if (!current) {
    return (
      <div className="wide">
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </div>
    );
  }
  const group = parseGroup(searchParams.group);
  const from = parseDay(searchParams.from);
  const to = parseDay(searchParams.to);
  const { entries, truncated } = await listAuditTrail(current, { group, from, to });
  const what = (action: string): string => {
    const key = `trust.audit.action.${actionKey(action)}` as MessageKey;
    const text = t(key);
    return text === key ? t('trust.audit.unknown') : text;
  };
  const qs = new URLSearchParams({ tenant: current, group });
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  return (
    <section className="wide" aria-labelledby="audit-title">
      <PageTitle
        id="audit-title"
        title={t('trust.audit.title')}
        subtitle={t('trust.audit.intro')}
        actions={
          <Button
            variant="outlined"
            href={`/admin/audit/export?${qs.toString()}`}
            startIcon={<AppIcon name="download" size={20} />}
          >
            {t('trust.audit.exportCsv')}
          </Button>
        }
      />
      <Stack
        component="form"
        method="get"
        action="/admin/audit"
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 3, mb: 5, alignItems: { sm: 'flex-start' } }}
      >
        <input type="hidden" name="tenant" value={current} />
        <TextField
          select
          name="group"
          label={t('trust.audit.filterGroup')}
          defaultValue={group}
          sx={{ minWidth: 240 }}
        >
          {AUDIT_GROUP_KEYS.map((g) => (
            <MenuItem key={g} value={g}>
              {t(`trust.audit.group.${g}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          name="from"
          label={t('trust.audit.filterFrom')}
          defaultValue={from ?? ''}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="date"
          name="to"
          label={t('trust.audit.filterTo')}
          defaultValue={to ?? ''}
          InputLabelProps={{ shrink: true }}
        />
        <Button type="submit" variant="contained" sx={{ minHeight: 56 }}>
          {t('trust.audit.apply')}
        </Button>
        <Button variant="text" href={`/admin/audit?tenant=${current}`} sx={{ minHeight: 56 }}>
          {t('trust.audit.reset')}
        </Button>
      </Stack>
      <p className="muted" aria-live="polite">
        {t('trust.audit.count', { n: entries.length })}
        {truncated ? ` ${t('trust.audit.limit', { n: AUDIT_LIMIT })}` : ''}
      </p>
      {entries.length === 0 ? (
        <p>{t('trust.audit.empty')}</p>
      ) : (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={t('trust.audit.title')}
        >
          <table className="data-table" data-testid="audit-table">
            <thead>
              <tr>
                <th>{t('trust.audit.colWhen')}</th>
                <th>{t('trust.audit.colWho')}</th>
                <th>{t('trust.audit.colWhat')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(locale, e.at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{e.who}</td>
                  <td>{what(e.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
