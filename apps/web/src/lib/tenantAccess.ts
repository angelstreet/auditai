import type { SessionPayload } from './session';

/** Roles that may use the /admin surface and its export / erase actions. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['platform_owner', 'auditor']);

/** Tenant ids the session user holds an admin-capable membership in. */
export const allowedTenantIds = (session: SessionPayload): string[] =>
  session.tenants.filter((t) => ADMIN_ROLES.has(t.role)).map((t) => t.id);

/**
 * Membership check for a tenant id taken from a form or query string. The id is only ever a
 * *selector*: it is honoured only when the session already grants it.
 */
export const isTenantAllowed = (session: SessionPayload, tenantId: string): boolean =>
  allowedTenantIds(session).includes(tenantId);

/** Pick the requested tenant when permitted, else the first permitted one, else null. */
export const pickTenant = (
  session: SessionPayload,
  requested: string | undefined,
): string | null => {
  const allowed = allowedTenantIds(session);
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] ?? null;
};
