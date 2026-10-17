import { z } from 'zod';
import { tenantIdSchema, userIdSchema, isoDateTimeSchema } from './ids.js';

/**
 * Sponsor intake brief (M12, FR-08, PRD §4, §9, §15).
 *
 * One row per sponsor intake submission. The form is multi-step; the write
 * shape below is the final payload after every step. The intake never
 * captures real names; only the pseudonym + the brief itself.
 */

export const sponsorDepartmentSchema = z.enum([
  'operations',
  'sales',
  'finance',
  'legal',
  'engineering',
  'people',
]);
export type SponsorDepartment = z.infer<typeof sponsorDepartmentSchema>;

export const sponsorSensitivitySchema = z.enum([
  'internal_only',
  'public_web',
  'customer_pii',
  'regulated',
]);
export type SponsorSensitivity = z.infer<typeof sponsorSensitivitySchema>;

export const sponsorOnsiteAppetiteSchema = z.enum(['full_pilot', 'limited_team', 'remote_only']);
export type SponsorOnsiteAppetite = z.infer<typeof sponsorOnsiteAppetiteSchema>;

export const sponsorModelRegionSchema = z.enum([
  'eu_only',
  'us_enterprise',
  'self_hosted',
  'no_constraint',
]);
export type SponsorModelRegion = z.infer<typeof sponsorModelRegionSchema>;

export const sponsorResidencySchema = z.enum(['eu_frankfurt', 'us', 'client_vpc']);
export type SponsorResidency = z.infer<typeof sponsorResidencySchema>;

export const sponsorPromptInjectionReviewSchema = z.enum([
  'external_auditor',
  'internal',
  'none_yet',
]);
export type SponsorPromptInjectionReview = z.infer<typeof sponsorPromptInjectionReviewSchema>;

/** A 0..5 self-assessment for one maturity axis. */
export const maturityScoreSchema = z.number().int().min(0).max(5);
export type MaturityScore = z.infer<typeof maturityScoreSchema>;

/** The sponsor brief wire shape. */
export const sponsorBriefSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  sponsorUserId: userIdSchema.nullable(),
  topPriorityWorkflow: z.string().max(2_000).default(''),
  departmentsInScope: z.array(sponsorDepartmentSchema).default([]),
  dataSensitivityBoundary: z.array(sponsorSensitivitySchema).default([]),
  annualBudgetEur: z.number().min(0).nullable(),
  onsiteAppetite: sponsorOnsiteAppetiteSchema.nullable(),
  approvedModelRegions: z.array(sponsorModelRegionSchema).default([]),
  dataResidency: z.array(sponsorResidencySchema).default([]),
  promptInjectionReview: sponsorPromptInjectionReviewSchema.nullable(),
  leadershipLiteracy: maturityScoreSchema.nullable(),
  operationalAdoption: maturityScoreSchema.nullable(),
  policyGovernance: maturityScoreSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type SponsorBrief = z.infer<typeof sponsorBriefSchema>;

/** The write shape the intake form posts to the server action. */
export const sponsorBriefWriteSchema = z.object({
  tenantId: tenantIdSchema,
  sponsorUserId: userIdSchema.nullable().default(null),
  topPriorityWorkflow: z.string().max(2_000).default(''),
  departmentsInScope: z.array(sponsorDepartmentSchema).default([]),
  dataSensitivityBoundary: z.array(sponsorSensitivitySchema).default([]),
  annualBudgetEur: z.number().min(0).nullable().default(null),
  onsiteAppetite: sponsorOnsiteAppetiteSchema.nullable().default(null),
  approvedModelRegions: z.array(sponsorModelRegionSchema).default([]),
  dataResidency: z.array(sponsorResidencySchema).default([]),
  promptInjectionReview: sponsorPromptInjectionReviewSchema.nullable().default(null),
  leadershipLiteracy: maturityScoreSchema.nullable().default(null),
  operationalAdoption: maturityScoreSchema.nullable().default(null),
  policyGovernance: maturityScoreSchema.nullable().default(null),
});
export type SponsorBriefWrite = z.infer<typeof sponsorBriefWriteSchema>;
