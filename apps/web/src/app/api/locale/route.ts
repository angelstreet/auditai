import { NextResponse, type NextRequest } from 'next/server';
import { verifyInviteToken } from '@/lib/invitationToken';
import { findTenantForInvitation } from '@/lib/db';
import { getOrCreateState, setLocale } from '@/lib/surveyState';
import { isSupportedLocale, supportedLocales } from '@auditai/i18n';

interface Body {
  token: string;
  locale: string;
}

export async function POST(req: NextRequest) {
  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  if (typeof parsed.token !== 'string' || typeof parsed.locale !== 'string') {
    return NextResponse.json({ ok: false, error: 'bad_payload' }, { status: 400 });
  }
  if (!isSupportedLocale(parsed.locale)) {
    return NextResponse.json(
      { ok: false, error: 'unsupported_locale', supported: supportedLocales },
      { status: 422 },
    );
  }
  try {
    verifyInviteToken(parsed.token);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }
  const reference = parsed.token.split('.')[0] as string;
  const resolved = await findTenantForInvitation(reference);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'invitation_not_found' }, { status: 404 });
  }
  const state = await getOrCreateState(resolved.tenantId, resolved.invitationId);
  if (!state.submissionId) {
    return NextResponse.json({ ok: false, error: 'submission_not_ready' }, { status: 500 });
  }
  await setLocale(resolved.tenantId, state.submissionId, parsed.locale);
  return NextResponse.json({ ok: true, locale: parsed.locale });
}
