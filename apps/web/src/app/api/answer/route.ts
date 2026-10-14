import { NextResponse, type NextRequest } from 'next/server';
import { parseInviteToken } from '@/lib/invitationToken';
import { recordAnswer } from '@/lib/surveyState';

/**
 * POST /api/answer \u2014 persist a single answer for the current question. The token is verified
 * synchronously; the in-memory store is process-local so resume works only within a single
 * deployment instance. Phase 2 will replace this with the submission row.
 */

interface Body {
  token: string;
  index: number;
  choice: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  if (
    typeof body.token !== 'string' ||
    typeof body.index !== 'number' ||
    typeof body.choice !== 'string'
  ) {
    return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 });
  }
  try {
    parseInviteToken(body.token);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }
  recordAnswer(body.token.split('.')[0] as string, body.index, body.choice);
  return NextResponse.json({ ok: true });
}
