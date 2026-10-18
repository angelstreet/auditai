import { NextResponse, type NextRequest } from 'next/server';
import { readSessionCookie, verifySession } from '@/lib/session';

/**
 * Gate for the auditor surface (ADR 0023). Respondent routes (/s, /intake, /quiz, /welcome,
 * /privacy, /about) are deliberately outside the matcher. Pages and actions re-check the
 * session themselves; this is the first line, not the only one.
 */
export async function middleware(req: NextRequest) {
  let session = null;
  try {
    session = await verifySession(readSessionCookie((n) => req.cookies.get(n)));
  } catch {
    // Missing secret outside local dev: fail closed.
  }
  if (session) return NextResponse.next();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  // Build the redirect on the host the browser used (not req.nextUrl's bind host), so the
  // cookie scope stays the same and the Location is an absolute URL the middleware accepts.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  const login = new URL(`/login?next=${encodeURIComponent(next)}`, `${proto}://${host}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/admin/:path*', '/board'] };
