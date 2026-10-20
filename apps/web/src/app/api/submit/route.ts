import { NextResponse, type NextRequest } from 'next/server';
import { finishSurvey } from '@/lib/finishSurvey';
import { resolveRespondent } from '@/lib/respondentRequest';
import { totalQuestionCount } from '@/lib/syntheticTemplate';

/**
 * POST /api/submit — the one place a survey becomes submitted (never a page load: prefetch must
 * not change state). Idempotent; refuses with 409 `incomplete` while a question is still open.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const resolved = await resolveRespondent(body?.token, '/api/submit');
  if ('response' in resolved) return resolved.response;
  const { invite } = resolved;
  const result = await finishSurvey(invite.tenantId, invite.invitationId, totalQuestionCount());
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: 'incomplete', missingIndex: result.missingIndex },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
