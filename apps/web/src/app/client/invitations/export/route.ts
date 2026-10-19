import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import { loadClientSurvey } from '@/lib/clientData';
import { teamLinksWithAudit } from '@/lib/invitationData';
import { resolveBaseUrl, toCsv } from '@/lib/invitationTracking';
import { effectiveContext } from '@/lib/tenantAccess';
import { auditViewAs } from '@/lib/viewAsAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CSV of every link of the referent's teams (`link,team`), whatever its state (ADR 0039): no name,
 * no address, no status, and no per-status variant, because the referent knows which link went to
 * whom. Any query string is ignored. Tenant and teams come from the signed session.
 */
export async function GET(req: NextRequest) {
  const kind = 'team';
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 403 });
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return new NextResponse(null, { status: 403 });
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
  const rows = await teamLinksWithAudit(
    ctx.tenantId,
    survey.engagementId,
    session.sub,
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
