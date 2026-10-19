import type { TenantId } from '@evolai/contracts';
import { requireClientContext } from '@/lib/clientContext';
import { loadClientSurvey } from '@/lib/clientData';
import { loadPublishedReport, logReportExport } from '@/lib/reportData';
import { pdfResponse } from '@/lib/reportPdfResponse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PDF of the published report in the team space (TASK-V, ADR 0042). The engagement comes from the
 * session's teams, never from the URL; only the published, not withdrawn snapshot is printed.
 * The download is written to the audit trail with the real actor (the owner during a view-as).
 */
export async function GET() {
  const { session, ctx } = await requireClientContext();
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  const published = survey
    ? await loadPublishedReport(ctx.tenantId as TenantId, survey.engagementId)
    : null;
  if (!published) return new Response('Not found', { status: 404 });
  await logReportExport(ctx.tenantId as TenantId, session.sub, published.reportId, {
    version: published.snapshot.version,
    format: 'pdf',
    surface: 'client',
  });
  return pdfResponse(published.snapshot);
}
