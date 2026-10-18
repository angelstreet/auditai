import { NextResponse, type NextRequest } from 'next/server';
import { isCronAuthorized } from '@/lib/retentionCron';
import { runReminderPass } from '@/lib/invitationDelivery';
import { resolveBaseUrl } from '@/lib/invitationTracking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

/**
 * Vercel cron target for invitation reminders and address purging (TASK-N, ADR 0033). Same
 * `CRON_SECRET` bearer check as the retention route: anything else gets a bare 401.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get('authorization'))) {
    return new NextResponse(null, { status: 401 });
  }
  try {
    const baseUrl = resolveBaseUrl(
      process.env,
      req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
      req.headers.get('x-forwarded-proto'),
    );
    const result = await runReminderPass(baseUrl);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
