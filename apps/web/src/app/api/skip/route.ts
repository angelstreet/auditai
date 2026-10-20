import { NextResponse, type NextRequest } from 'next/server';
import { ensureQuestionItemId } from '@/lib/questionItems';
import { resolveRespondent } from '@/lib/respondentRequest';
import { getOrCreateState, isSubmitted, recordSkip } from '@/lib/surveyState';
import { SYNTHETIC_QUESTIONS } from '@/lib/syntheticTemplate';

/** POST /api/skip — remember that the person passed on a question; never overwrites an answer. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown; index?: unknown } | null;
  const index = body?.index;
  if (typeof index !== 'number' || !Number.isInteger(index) || !SYNTHETIC_QUESTIONS[index]) {
    return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 });
  }
  const resolved = await resolveRespondent(body?.token, '/api/skip');
  if ('response' in resolved) return resolved.response;
  const { invite } = resolved;
  const state = await getOrCreateState(invite.tenantId, invite.invitationId);
  if (!state.submissionId) {
    return NextResponse.json({ ok: false, error: 'submission_not_ready' }, { status: 500 });
  }
  if (await isSubmitted(invite.tenantId, state.submissionId)) {
    return NextResponse.json({ ok: false, error: 'already_submitted' }, { status: 409 });
  }
  const code = SYNTHETIC_QUESTIONS[index]?.code as string;
  const questionId = await ensureQuestionItemId(invite.tenantId, code);
  if (!questionId)
    return NextResponse.json({ ok: false, error: 'question_not_seeded' }, { status: 500 });
  await recordSkip(invite.tenantId, state.submissionId, questionId, index);
  return NextResponse.json({ ok: true });
}
