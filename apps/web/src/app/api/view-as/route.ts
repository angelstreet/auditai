import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import { listPersonas } from '@/lib/clientContext';
import { isUuid } from '@/lib/invitationForm';
import {
  SESSION_COOKIE,
  remainingMaxAge,
  sessionCookieOptions,
  signSession,
  withViewAs,
} from '@/lib/session';
import { ownedTenantIds } from '@/lib/tenantAccess';
import { auditViewAs } from '@/lib/viewAsAudit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const redirectTo = (path: string) =>
  new NextResponse(null, { status: 303, headers: { location: path } });
const forbidden = () => new NextResponse(null, { status: 403 });

/**
 * Start or stop "view as" (TASK-P, ADR 0035). Form field `persona`: a membership id from the
 * account menu, or `self` to go back. The server re-reads the persona from the database and only
 * accepts one in a tenant where the signed session holds platform owner; nothing else from the
 * form is used. The cookie is re-signed with the same expiry, so a view-as ends with the sign-in.
 */
export async function POST(req: NextRequest) {
  // Cross-site posts are refused outright (the cookie is SameSite=Lax as well).
  if (req.headers.get('sec-fetch-site') === 'cross-site') return forbidden();
  const session = await getSession();
  if (!session) return redirectTo('/login');
  let persona = '';
  try {
    persona = String((await req.formData()).get('persona') ?? '');
  } catch {
    return forbidden();
  }

  if (persona === 'self') {
    if (session.viewAs) await auditViewAs(session, session.viewAs, 'view_as.stop');
    const token = await signSession(withViewAs(session, null));
    const res = redirectTo('/admin/engagements');
    res.cookies.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      maxAge: remainingMaxAge(session),
    });
    return res;
  }

  // Only a platform owner on their own view may start one; never a referent, never nested.
  if (session.viewAs || ownedTenantIds(session).length === 0 || !isUuid(persona)) {
    return forbidden();
  }
  const [found] = await listPersonas(session, persona);
  if (!found) return forbidden();
  const next = withViewAs(session, found.viewAs);
  const token = await signSession(next);
  await auditViewAs(next, found.viewAs, 'view_as.start');
  const res = redirectTo('/client');
  res.cookies.set(SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: remainingMaxAge(session),
  });
  return res;
}
