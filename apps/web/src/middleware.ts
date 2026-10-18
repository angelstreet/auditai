import { NextResponse, type NextRequest } from 'next/server';
import { readSessionCookie, verifySession } from '@/lib/session';

/**
 * Gate for the auditor and client surfaces (ADR 0023, ADR 0035). /intake joins them (ADR 0036). Respondent routes
 * (/s, /quiz, /welcome, /privacy, /about) are deliberately outside the matcher. Pages and actions re-check the
 * session themselves; this is the first line, not the only one.
 */
export async function middleware(req: NextRequest) {
  let session = null;
  try {
    session = await verifySession(readSessionCookie((n) => req.cookies.get(n)));
  } catch {
    // Missing secret outside local dev: fail closed.
  }
  if (session) {
    // The path travels to server components for the view-as trail (ADR 0035). Set here, after
    // any client-supplied value is overwritten, so it cannot be forged.
    const headers = new Headers(req.headers);
    headers.set('x-evolai-path', req.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  }
  const next = req.nextUrl.pathname + req.nextUrl.search;
  // Build the redirect on the host the browser used (not req.nextUrl's bind host), so the
  // cookie scope stays the same and the Location is an absolute URL the middleware accepts.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  const login = new URL(`/login?next=${encodeURIComponent(next)}`, `${proto}://${host}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*', '/board', '/intake', '/client/:path*', '/client'],
};
