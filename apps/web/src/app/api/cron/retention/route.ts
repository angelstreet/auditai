import { NextResponse, type NextRequest } from 'next/server';
import { isCronAuthorized, runRetentionPass } from '@/lib/retentionCron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

/**
 * Vercel cron target for the FR-09 retention pass (TASK-K). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else gets a bare 401, so there is no public trigger.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get('authorization'))) {
    return new NextResponse(null, { status: 401 });
  }
  try {
    const result = await runRetentionPass();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
