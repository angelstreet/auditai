import { NextResponse, type NextRequest } from 'next/server';
import { activeProvider, loadMemberships } from '@/lib/authProvider';
import {
  SESSION_COOKIE,
  newSessionPayload,
  sessionCookieOptions,
  signSession,
} from '@/lib/session';
import { ADMIN_ROLES } from '@/lib/tenantAccess';

export const dynamic = 'force-dynamic';

// Relative Location: behind a proxy or on 127.0.0.1, req.url's host is not the one the browser
// used, and a cross-host redirect would lose the cookie.
const redirectTo = (path: string) =>
  new NextResponse(null, { status: 303, headers: { location: path } });

/** Same-origin relative paths under /admin or /board only; anything else goes to /admin/data. */
const safeNext = (raw: string | null): string =>
  raw && /^\/(admin|board)(\/[A-Za-z0-9_\-./?=&%]*)?$/.test(raw) ? raw : '/admin/data';

const back = (error: string) => redirectTo(`/login?error=${error}`);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const credentials = {
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  };
  const user = await activeProvider.authenticate(credentials);
  if (!user) return back('invalid');
  const memberships = await loadMemberships(user.id);
  if (!memberships.some((m) => ADMIN_ROLES.has(m.role))) return back('no-access');
  const token = await signSession(newSessionPayload(user, memberships));
  const res = redirectTo(safeNext(String(form.get('next') ?? '')));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
