import type { TenantId } from '@evolai/contracts';
import { getSession, sessionTenantFor } from '@/lib/authServer';
import { isUuid } from '@/lib/invitationForm';
import { loadPublishedReport, logReportExport } from '@/lib/reportData';
import { pdfResponse } from '@/lib/reportPdfResponse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PDF of the published report, for the auditor to send to the sponsor (TASK-V, ADR 0042). Staff
 * only (the session picks the organisation); only the version the client sees is printed, never
 * a draft. Each download is written to the audit trail, without the content.
 */
export async function GET(req: Request, { params }: { params: { engagementId: string } }) {
  const tenant = new URL(req.url).searchParams.get('tenant') ?? undefined;
  const tenantId = await sessionTenantFor(tenant);
  const session = await getSession();
  if (!tenantId || !session || !isUuid(params.engagementId)) {
    return new Response('Not found', { status: 404 });
  }
  const published = await loadPublishedReport(tenantId as TenantId, params.engagementId);
  if (!published) return new Response('Not found', { status: 404 });
  await logReportExport(tenantId as TenantId, session.sub, published.reportId, {
    version: published.snapshot.version,
    format: 'pdf',
    surface: 'admin',
  });
  return pdfResponse(published.snapshot);
}
