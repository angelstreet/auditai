import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { TenantId, UserId } from '@auditai/contracts';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './session';
import { getT } from './i18n';
import { allowedTenantIds, isTenantAllowed, pickTenant } from './tenantAccess';

/** The verified session for this request, or null. */
export const getSession = async (): Promise<SessionPayload | null> =>
  verifySession(cookies().get(SESSION_COOKIE)?.value);

/** Pages and actions under /admin: redirect to /login when there is no valid session. */
export const requireSession = async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
};

/** Drop-in replacement for the old cross-tenant `listTenantIds()` on admin pages. */
export const sessionTenantIds = async (): Promise<readonly TenantId[]> => {
  const session = await requireSession();
  return allowedTenantIds(session) as TenantId[];
};

export const sessionTenantFor = async (requested: string | undefined): Promise<TenantId | null> => {
  const session = await requireSession();
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
  if (!isTenantAllowed(session, formTenantId)) {
    return { ok: false, message: t('auth.notMember') };
  }
  return { ok: true, actor: session.sub as UserId, tenantId: formTenantId as TenantId };
};
