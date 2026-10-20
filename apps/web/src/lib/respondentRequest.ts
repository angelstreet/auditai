import { NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/invitationToken';
import { findInvitation, gateFor, type InvitationRecord } from '@/lib/respondent';
import { viewAsRefusal } from '@/lib/viewAsGuard';

type Resolved = { invite: InvitationRecord } | { response: NextResponse };

const fail = (error: string, status: number): { response: NextResponse } => ({
  response: NextResponse.json({ ok: false, error }, { status }),
});

/** Shared checks for respondent POST routes: view-as, token, invitation, open gate. */
export const resolveRespondent = async (token: unknown, path: string): Promise<Resolved> => {
  if (await viewAsRefusal(path)) return fail('read_only', 403);
  if (typeof token !== 'string') return fail('bad_payload', 400);
  try {
    verifyInviteToken(token);
  } catch {
    return fail('invalid_token', 401);
  }
  const invite = await findInvitation(token.split('.')[0] as string);
  if (!invite) return fail('invitation_not_found', 404);
  if (gateFor(invite, new Date()) !== 'ok') return fail('invitation_closed', 410);
  return { invite };
};
