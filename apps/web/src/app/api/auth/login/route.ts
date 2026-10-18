import { NextResponse, type NextRequest } from 'next/server';
import { activeProvider, loadMemberships } from '@/lib/authProvider';
import {
  SESSION_COOKIE,
  newSessionPayload,
  sessionCookieOptions,
  signSession,
} from '@/lib/session';
import { ADMIN_ROLES } from '@/lib/tenantAccess';
import { clientAddress, isLockedOut, recentFailures, recordAttempt } from '@/lib/loginThrottle';

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
  const address = clientAddress(req.headers);
  if (isLockedOut(await recentFailures(credentials.email, address))) return back('locked');
  const user = await activeProvider.authenticate(credentials);
  if (!user) {
    await recordAttempt(credentials.email, address, false);
    return back('invalid');
  }
  const memberships = await loadMemberships(user.id);
  // Same message as a wrong password: do not reveal that the credentials were right.
  if (!memberships.some((m) => ADMIN_ROLES.has(m.role))) {
    await recordAttempt(credentials.email, address, false);
    return back('invalid');
  }
  await recordAttempt(credentials.email, address, true);
  const token = await signSession(newSessionPayload(user, memberships));
  const res = redirectTo(safeNext(String(form.get('next') ?? '')));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
