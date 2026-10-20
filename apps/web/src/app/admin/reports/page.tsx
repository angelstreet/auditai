import Link from 'next/link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { formatDate } from '@evolai/i18n';
import { EmptyState, PageTitle, StatusText } from '@evolai/ui';
import { StartReportForm } from '@/components/report/ReportForms';
import { sessionTenantFor } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { listReports } from '@/lib/reportData';

export const dynamic = 'force-dynamic';

/**
 * Audit reports of the current organisation (TASK-V, ADR 0041): one row per audit, its report
 * state and the version the client sees. Staff only (the session decides the organisation).
 */
export default async function ReportsPage({ searchParams }: { searchParams: { tenant?: string } }) {
  const { t, locale } = getT();
  const tenantId = await sessionTenantFor(searchParams.tenant);
  if (!tenantId) {
    return (
      <section className="wide admin" aria-labelledby="reports-title">
        <PageTitle id="reports-title" title={t('report.list.title')} />
        <EmptyState title={t('admin.common.noTenantsTitle')} />
      </section>
    );
  }
  const rows = await listReports(tenantId);
  const firstUnstarted = rows.findIndex((r) => r.reportId === null);
  return (
    <section className="wide admin" aria-labelledby="reports-title">
      <PageTitle
        id="reports-title"
        title={t('report.list.title')}
        subtitle={t('report.list.subtitle')}
      />
      {rows.length === 0 ? (
        <EmptyState icon="info" title={t('report.list.empty')} />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflowX: 'auto' }}>
          <Table aria-labelledby="reports-title">
            <TableHead>
              <TableRow>
                <TableCell>{t('report.list.colAudit')}</TableCell>
                <TableCell>{t('report.list.colState')}</TableCell>
                <TableCell>{t('report.list.colVisible')}</TableCell>
                <TableCell>{t('report.list.colUpdated')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.engagementId} hover data-testid="report-row">
                  <TableCell component="th" scope="row">
                    <Typography variant="body1" component="span">
                      {r.engagementName ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.status ? (
                      <StatusText status={r.status === 'published' ? 'success' : 'pending'}>
                        {t(`report.state.${r.status}`)}
                        {r.version ? ` · v${r.version}` : ''}
                      </StatusText>
                    ) : (
                      t('report.list.notStarted')
                    )}
                  </TableCell>
                  <TableCell>
                    {r.visibleVersion
                      ? t('report.list.visibleVersion', { version: r.visibleVersion })
                      : t('report.list.visibleNone')}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {r.updatedAt ? formatDate(locale, r.updatedAt) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {r.reportId ? (
                      <Link href={`/admin/reports/${r.engagementId}?tenant=${tenantId}`}>
                        {t('report.list.open')}
                      </Link>
                    ) : (
                      <StartReportForm
                        tenantId={tenantId}
                        engagementId={r.engagementId}
                        primary={i === firstUnstarted}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </section>
  );
}
