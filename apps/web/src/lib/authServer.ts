import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { TenantId, UserId } from '@evolai/contracts';
import { readSessionCookie, verifySession, type SessionPayload } from './session';
import { getT } from './i18n';
import { allowedTenantIds, effectiveContext, isTenantAllowed, pickTenant } from './tenantAccess';
import { auditViewAs, trailPath } from './viewAsAudit';

/** Request path set by the middleware, for the view-as trail. */
export const requestPath = (): string => trailPath(headers().get('x-evolai-path'));

/** The verified session for this request, or null. */
export const getSession = async (): Promise<SessionPayload | null> =>
  verifySession(readSessionCookie((n) => cookies().get(n)));

/** Pages and actions under /admin: redirect to /login when there is no valid session. */
export const requireSession = async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
};

/**
 * Staff pages (admin, board): a session in client context (a real referent, or the owner viewing
 * as one) is sent to the client surface. The server decides; hiding links is not the guard.
 */
const requireStaffSession = async (): Promise<SessionPayload> => {
  const session = await requireSession();
  if (effectiveContext(session).kind === 'client') redirect('/client');
  return session;
};

/** Drop-in replacement for the old cross-tenant `listTenantIds()` on admin pages. */
export const sessionTenantIds = async (): Promise<readonly TenantId[]> => {
  const session = await requireStaffSession();
  return allowedTenantIds(session) as TenantId[];
};

export const sessionTenantFor = async (requested: string | undefined): Promise<TenantId | null> => {
  const session = await requireStaffSession();
  return pickTenant(session, requested) as TenantId | null;
};

export type ActorResult =
  | { ok: true; actor: UserId; tenantId: TenantId }
  | { ok: false; message: string };

/**
 * For server actions. The actor always comes from the session. The form's tenantId is only a
 * selector and is rejected unless the session user is a member of that tenant.
 */
export const resolveActor = async (formTenantId: string): Promise<ActorResult> => {
  const { t } = getT();
  const session = await getSession();
  if (!session) return { ok: false, message: t('auth.notSignedIn') };
  if (session.viewAs) {
    // View-as is read only (ADR 0035): refuse before any tenant check, and keep a trail of it.
    await auditViewAs(session, session.viewAs, 'view_as.refused', { path: requestPath() }).catch(
      () => undefined,
    );
    return { ok: false, message: t('client.viewAs.readOnly') };
  }
  if (!isTenantAllowed(session, formTenantId)) {
    return { ok: false, message: t('auth.notMember') };
  }
  return { ok: true, actor: session.sub as UserId, tenantId: formTenantId as TenantId };
};
