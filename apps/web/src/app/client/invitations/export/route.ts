import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import { loadClientSurvey } from '@/lib/clientData';
import { withAudit } from '@/lib/invitationData';
import { resolveBaseUrl, toCsv } from '@/lib/invitationTracking';
import { effectiveContext } from '@/lib/tenantAccess';
import { auditViewAs } from '@/lib/viewAsAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CSV of the referent's own open links (`link,team`), or of those due a reminder. Same columns as
 * the admin export (FR-03): no name, no address, no completion status. Tenant and teams come from
 * the signed session; there is no id in the URL to guess.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 403 });
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return new NextResponse(null, { status: 403 });
  const kind = req.nextUrl.searchParams.get('kind') === 'reminders' ? 'reminders' : 'all';
  if (ctx.viewAs) {
    await auditViewAs(session, ctx.viewAs, 'view_as.request', {
      path: req.nextUrl.pathname,
      kind,
    });
  }
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey) return new NextResponse(null, { status: 404 });
  const baseUrl = resolveBaseUrl(
    process.env,
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    req.headers.get('x-forwarded-proto'),
  );
  const rows = await withAudit(
    ctx.tenantId,
    survey.engagementId,
    session.sub,
    kind,
    baseUrl,
    ctx.teamIds,
  );
  const csv = toCsv(
    ['link', 'team'],
    rows.map((r) => [r.link, r.teamName]),
  );
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="invitations-${kind}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
