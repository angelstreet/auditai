import { z } from 'zod';

/**
 * Roles drive server-side authorisation (PRD \u00a73). Memberships bind a user to a tenant-scoped
 * context with one of these roles. We deliberately keep the list short \u2014 every role is a *named*
 * job, never a privilege escalation knob.
 */
export const roleSchema = z.enum([
  'platform_owner',
  'client_sponsor',
  'team_manager',
  'team_referent',
  'auditor',
  'security_reviewer',
  'employee_respondent',
]);
export type Role = z.infer<typeof roleSchema>;

/**
 * Capabilities attach to a role. They are referenced from RLS policies, server-side guards and
 * UI gating. Adding a capability requires updating the matrix in @auditai/domain and the
 * permissions table in the database.
 */
export const capabilitySchema = z.enum([
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
]);
export type Capability = z.infer<typeof capabilitySchema>;
