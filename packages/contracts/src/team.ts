import { z } from 'zod';
import {
  departmentIdSchema,
  isoDateTimeSchema,
  organisationIdSchema,
  teamIdSchema,
  tenantIdSchema,
  userIdSchema,
} from './ids.js';
import { roleSchema } from './roles.js';

/**
 * Team \u2014 a working group inside a department. The team is the *unit of analysis* for the audit:
 * completion counts, maturity aggregates and the opportunity register are scoped to the team.
 *
 * Memberships are first-class rows, not embedded arrays: the auditor team, sponsor and referents
 * may overlap across teams, and query isolation (PRD \u00a716) is easier with rows.
 */
export const teamSchema = z.object({
  id: teamIdSchema,
  tenantId: tenantIdSchema,
  organisationId: organisationIdSchema,
  departmentId: departmentIdSchema,
  name: z.string().min(1).max(120),
  /** Display-only description surfaced in the admin UI. */
  description: z.string().max(500).nullable(),
  /** Expected headcount; informs the minimum-cohort gating for group maturity displays. */
  expectedHeadcount: z.number().int().min(0).max(10_000),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Team = z.infer<typeof teamSchema>;

/**
 * Membership \u2014 a user's role inside a tenant. We allow multiple roles per user *across*
 * tenants, never inside a single tenant: two roles in the same tenant would silently widen
 * privileges and complicate audits. The schema enforces the constraint structurally.
 */
export const membershipSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  /** A user can hold memberships across tenants; the userId is global. */
  userId: userIdSchema,
  /** Optional team scope \u2014 null for tenant-wide roles (sponsor, auditor). */
  teamId: teamIdSchema.nullable(),
  role: roleSchema,
  /** When the membership becomes valid; null = immediate. */
  startsAt: isoDateTimeSchema.nullable(),
  /** When the membership expires; null = open-ended. */
  endsAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Membership = z.infer<typeof membershipSchema>;
