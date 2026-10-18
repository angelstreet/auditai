import { NextResponse, type NextRequest } from 'next/server';
import { InvalidInviteToken, verifyInviteToken } from '@/lib/invitationToken';
import { withServiceAccount } from '@/lib/db';
import { findInvitation, gateFor } from '@/lib/respondent';
import { getOrCreateState, isSubmitted, recordAnswer } from '@/lib/surveyState';
import { SYNTHETIC_QUESTIONS } from '@/lib/syntheticTemplate';
import { parseAnswerValue } from '@/lib/answerParser';
import { viewAsRefusal } from '@/lib/viewAsGuard';

interface Body {
  token: string;
  index: number;
  choice: string;
}

/**
 * POST /api/answer \u2014 persist a single answer against the M4 schema.
 *
 * 1. Verify the token (HMAC).
 * 2. Resolve the tenant + invitation via `findInvitation` (service-account lookup so RLS
 *    cannot deny it; the invitation row carries the tenant id we need).
 * 3. Get-or-create the submission row.
 * 4. Insert the answer with the synthetic question item id (the deterministic uuid we mint at
 *    seed time \u2014 see `infra/db/migrations/0003_seed_synthetic.sql`).
 */
export async function POST(req: NextRequest) {
  // The owner viewing as a client must not answer a survey for real (ADR 0035).
  if (await viewAsRefusal('/api/answer')) {
    return NextResponse.json({ ok: false, error: 'read_only' }, { status: 403 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  if (
    typeof body.token !== 'string' ||
    typeof body.index !== 'number' ||
    typeof body.choice !== 'string' ||
    body.index < 0 ||
    body.index >= SYNTHETIC_QUESTIONS.length
  ) {
    return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 });
  }
  try {
    verifyInviteToken(body.token);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }
  const reference = body.token.split('.')[0] as string;
  const resolved = await findInvitation(reference);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'invitation_not_found' }, { status: 404 });
  }
  if (gateFor(resolved, new Date()) !== 'ok') {
    return NextResponse.json({ ok: false, error: 'invitation_closed' }, { status: 410 });
  }
  const state = await getOrCreateState(resolved.tenantId, resolved.invitationId);
  if (!state.submissionId) {
    return NextResponse.json({ ok: false, error: 'submission_not_ready' }, { status: 500 });
  }
  // Answers are final once submitted.
  if (await isSubmitted(resolved.tenantId, state.submissionId)) {
    return NextResponse.json({ ok: false, error: 'already_submitted' }, { status: 409 });
  }
  const question = SYNTHETIC_QUESTIONS[body.index];
  if (!question) {
    return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 });
  }
  // Synthetic ids mirror the deterministic uuids the M4 seed inserts. Resolve the actual id by
  // (tenant, code) so renumbering questions does not break answer persistence.
  const questionRow = await lookupQuestionId(resolved.tenantId, question.code);
  if (!questionRow) {
    return NextResponse.json({ ok: false, error: 'question_not_seeded' }, { status: 500 });
  }
  const value = parseAnswerValue(question.kind, body.choice);
  await recordAnswer(resolved.tenantId, state.submissionId, questionRow, body.index, value);
  return NextResponse.json({ ok: true });
}

const lookupQuestionId = async (tenantId: string, code: string): Promise<string | null> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM question_items WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [tenantId, code],
    );
    return rows[0]?.id ?? null;
  });
};

// Silence the lint that the file does not use InvalidInviteToken; keep the symbol exported for
// the next handler.
void InvalidInviteToken;
