import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, isSupportedLocale } from '@evolai/i18n';

export const dynamic = 'force-dynamic';

/**
 * First visit to an invitation link (TASK-T, ADR 0038): store the engagement language as the
 * interface language, then go back to the link. Only the language code and a `/s/<token>` path are
 * accepted, so this cannot be used as an open redirect. `?l=1` tells the page not to come back here.
 */
export function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') ?? '';
  const to = req.nextUrl.searchParams.get('to') ?? '';
  if (!isSupportedLocale(locale) || !/^\/s\/[A-Za-z0-9_.-]+$/.test(to)) {
    return new NextResponse(null, { status: 400 });
  }
  const res = new NextResponse(null, { status: 303, headers: { location: `${to}?l=1` } });
  res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return res;
}
