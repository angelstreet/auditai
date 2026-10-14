import { type Capability, type Role, roleSchema } from '@auditai/contracts';
import { DomainError } from './ids.js';

/**
 * Role \u2192 capability matrix.
 *
 * Single source of truth for both the API guard layer and the database RLS policy checker
 * (the policy file in `infra/db` is generated from this map during M4). Roles are intentionally
 * coarse: a user wanting more than what their role grants needs a separate, named role
 * (e.g. `team_manager` + `auditor`).
 */
const roleCapabilities: Record<Role, ReadonlyArray<Capability>> = {
  platform_owner: [
    'tenant:read',
    'tenant:admin',
    'engagement:read',
    'engagement:write',
    'submission:read:aggregate',
    'submission:read:individual',
    'submission:write:own',
    'opportunity:read',
    'opportunity:write',
    'ai_run:approve',
    'ai_run:dispatch',
    'governance:review',
    'export:tenant',
    'export:benchmark_aggregate',
  ],
  client_sponsor: [
    'tenant:read',
    'engagement:read',
    'engagement:write',
    'submission:read:aggregate',
    'opportunity:read',
    'opportunity:write',
    'ai_run:approve',
    'governance:review',
    'export:tenant',
  ],
  team_manager: ['engagement:read', 'submission:read:aggregate', 'opportunity:read'],
  team_referent: ['engagement:read', 'submission:read:aggregate', 'opportunity:read'],
  auditor: [
    'engagement:read',
    'submission:read:aggregate',
    'submission:read:individual',
    'opportunity:read',
    'opportunity:write',
    'ai_run:dispatch',
    'governance:review',
  ],
  security_reviewer: [
    'tenant:read',
    'engagement:read',
    'submission:read:aggregate',
    'governance:review',
    'export:tenant',
  ],
  employee_respondent: ['submission:write:own'],
};

/**
 * Returns the capabilities granted to a given role. Used by the API guard and the auditor UI to
 * decide which buttons to show.
 */
export const capabilitiesForRole = (role: Role): ReadonlyArray<Capability> =>
  roleCapabilities[role];

/**
 * `roleHasCapability` is the central authorisation check. It accepts an *asserted* role
 * (already verified by signature) and a capability. It does NOT enforce tenant scope; that is
 * the database RLS policy's job. Defence in depth.
 */
export const roleHasCapability = (role: string, capability: Capability): boolean => {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) {
    throw new DomainError('unknown_role', `role "${role}" is not a recognised role`);
  }
  return capabilitiesForRole(parsed.data).includes(capability);
};
