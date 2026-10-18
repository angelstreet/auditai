import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import { isTenantAllowed } from '@/lib/tenantAccess';
import { withAudit } from '@/lib/invitationData';
import { isUuid } from '@/lib/invitationForm';
import { resolveBaseUrl, toCsv } from '@/lib/invitationTracking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CSV of links not yet completed: `link,team`. No names, no addresses, no status, no completion
 * information (FR-03). Session-checked here as well as by the middleware. `kind=reminders` limits it
 * to the invitations due a reminder now.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const tenantId = req.nextUrl.searchParams.get('tenant') ?? '';
  const engagementId = req.nextUrl.searchParams.get('engagement') ?? '';
  if (
    !session ||
    !isUuid(tenantId) ||
    !isUuid(engagementId) ||
    !isTenantAllowed(session, tenantId)
  ) {
    return new NextResponse(null, { status: 403 });
  }
  const baseUrl = resolveBaseUrl(
    process.env,
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    req.headers.get('x-forwarded-proto'),
  );
  const kind = req.nextUrl.searchParams.get('kind') === 'reminders' ? 'reminders' : 'all';
  const rows = await withAudit(tenantId, engagementId, session.sub, kind, baseUrl);
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
