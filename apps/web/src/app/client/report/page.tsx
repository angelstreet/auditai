import type { TenantId } from '@evolai/contracts';
import Button from '@mui/material/Button';
import { AppIcon, EmptyState, PageTitle } from '@evolai/ui';
import PrintReportButton from '@/components/report/PrintReportButton';
import ReportView from '@/components/report/ReportView';
import { requireClientContext } from '@/lib/clientContext';
import { loadClientSurvey } from '@/lib/clientData';
import { getT } from '@/lib/i18n';
import { loadPublishedReport } from '@/lib/reportData';

export const dynamic = 'force-dynamic';

/**
 * The published audit report in the team space (TASK-V, ADR 0041). Read only. The engagement comes
 * from the session's teams, never from the URL, and only a published, not withdrawn snapshot is
 * read: a draft or a report in review never reaches this page. View-as sees the same thing.
 */
export default async function ClientReportPage() {
  const { ctx } = await requireClientContext();
  const { t } = getT();
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  const published = survey
    ? await loadPublishedReport(ctx.tenantId as TenantId, survey.engagementId)
    : null;
  return (
    <section aria-labelledby="client-report-title">
      <PageTitle
        id="client-report-title"
        title={t('report.view.clientTitle')}
        subtitle={t('report.view.clientSubtitle')}
      />
      {published ? (
        <ReportView
          snapshot={published.snapshot}
          actions={
            <>
              <Button
                href="/client/report/pdf"
                variant="contained"
                startIcon={<AppIcon name="download" size={20} />}
                sx={{ minHeight: 44 }}
                data-testid="report-download"
              >
                {t('report.view.download')}
              </Button>
              <PrintReportButton label={t('report.view.print')} />
            </>
          }
        />
      ) : (
        <EmptyState icon="pending" title={t('report.view.empty')} />
      )}
    </section>
  );
}
