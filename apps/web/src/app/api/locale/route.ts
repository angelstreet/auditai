import { NextResponse, type NextRequest } from 'next/server';
import { parseInviteToken } from '@/lib/invitationToken';
import { setLocale } from '@/lib/surveyState';
import { isSupportedLocale, supportedLocales } from '@auditai/i18n';

/**
 * POST /api/locale \u2014 update the locale the respondent chose on the welcome screen.
 */
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
    parseInviteToken(parsed.token);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }
  setLocale(parsed.token.split('.')[0] as string, parsed.locale);
  return NextResponse.json({ ok: true, locale: parsed.locale });
}
