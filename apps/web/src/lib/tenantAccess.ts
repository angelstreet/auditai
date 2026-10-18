import { VIEW_AS_OWNER_ROLE, type SessionPayload, type ViewAs } from './session';

/** Roles that may use the /admin surface and its export / erase actions. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['platform_owner', 'auditor']);

/** Team-scoped client roles served by the /client surface (TASK-P, ADR 0035). */
export const CLIENT_ROLES: ReadonlySet<string> = new Set(['team_referent']);

/**
 * Tenant ids the session user holds an admin-capable membership in, each once. Empty while the
 * owner views the app as a client persona: the staff surface is closed for the whole view-as, so
 * every admin page, action and API that goes through this list refuses (ADR 0035).
 */
export const allowedTenantIds = (session: SessionPayload): string[] =>
  session.viewAs
    ? []
    : [...new Set(session.tenants.filter((t) => ADMIN_ROLES.has(t.role)).map((t) => t.id))];

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

/** Tenants on which the session user is platform owner, i.e. may start a view-as. */
export const ownedTenantIds = (session: SessionPayload): string[] => [
  ...new Set(session.tenants.filter((t) => t.role === VIEW_AS_OWNER_ROLE).map((t) => t.id)),
];

/** Only a platform owner, and never from inside a view-as, may pick a persona. */
export const canViewAs = (session: SessionPayload): boolean =>
  !session.viewAs && ownedTenantIds(session).length > 0;

/**
 * Who the request acts as, derived from the signed session only (ADR 0035).
 *
 * - `staff`: auditor or platform owner on their own view.
 * - `client`: a team referent, either a real one (`viewAs` null, may act) or the owner viewing as
 *   one (`viewAs` set, read only). Scope is one tenant and the referent's teams.
 * - `none`: signed in but no surface (should not happen: login refuses such users).
 */
export type EffectiveContext =
  | { readonly kind: 'staff'; readonly tenantIds: readonly string[] }
  | {
      readonly kind: 'client';
      readonly role: string;
      readonly tenantId: string;
      readonly teamIds: readonly string[];
      readonly readOnly: boolean;
      readonly viewAs: ViewAs | null;
    }
  | { readonly kind: 'none' };

export const effectiveContext = (session: SessionPayload): EffectiveContext => {
  const v = session.viewAs;
  if (v) {
    return {
      kind: 'client',
      role: v.role,
      tenantId: v.tenantId,
      teamIds: [v.teamId],
      readOnly: true,
      viewAs: v,
    };
  }
  const staff = allowedTenantIds(session);
  if (staff.length > 0) return { kind: 'staff', tenantIds: staff };
  const client = session.tenants.filter((t) => CLIENT_ROLES.has(t.role) && t.teamId);
  const first = client[0];
  if (!first) return { kind: 'none' };
  return {
    kind: 'client',
    role: first.role,
    tenantId: first.id,
    teamIds: [...new Set(client.filter((t) => t.id === first.id).map((t) => t.teamId as string))],
    readOnly: false,
    viewAs: null,
  };
};
