import { z } from 'zod';
import {
  analysisIdSchema,
  engagementIdSchema,
  isoDateTimeSchema,
  opportunityIdSchema,
  tenantIdSchema,
  userIdSchema,
} from './ids.js';
import { competencyAxisSchema } from './template.js';

/**
 * Opportunity register entry (M10, FR-08).
 *
 * One row per opportunity the auditor (or later, the auto-suggested LLM) creates out of an
 * approved analysis. M10 only writes `draft` rows; the transitions to `approved` /
 * `in_progress` / `delivered` / `archived` come in M11+.
 */
export const opportunityStatusSchema = z.enum([
  'draft',
  'approved',
  'in_progress',
  'delivered',
  'archived',
]);
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;

/** Score on a 0..1 scale, three decimal places. */
export const impactScoreSchema = z.number().min(0).max(1).multipleOf(0.001);
export type ImpactScore = z.infer<typeof impactScoreSchema>;

export const opportunitySchema = z.object({
  id: opportunityIdSchema,
  tenantId: tenantIdSchema,
  engagementId: engagementIdSchema,
  // The analysis that surfaced this opportunity. Nullable so a draft can be written by hand
  // before it is linked back to AI output. M11+ adds the "must-link before approval" rule.
  analysisId: analysisIdSchema.nullable(),
  status: opportunityStatusSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(20_000).default(''),
  axis: competencyAxisSchema.nullable(),
  impactScore: impactScoreSchema.nullable(),
  ownerUserId: userIdSchema.nullable(),
  createdBy: userIdSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  archivedAt: isoDateTimeSchema.nullable(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/**
 * The shape of an opportunity write request (no id, no timestamps). The server fills those in.
 */
export const opportunityWriteSchema = z.object({
  engagementId: engagementIdSchema,
  analysisId: analysisIdSchema.nullable().default(null),
  status: opportunityStatusSchema.default('draft'),
  title: z.string().min(3).max(200),
  description: z.string().max(20_000).default(''),
  axis: competencyAxisSchema.nullable().default(null),
  impactScore: impactScoreSchema.nullable().default(null),
  ownerUserId: userIdSchema.nullable().default(null),
  createdBy: userIdSchema,
});
export type OpportunityWrite = z.infer<typeof opportunityWriteSchema>;

/**
 * Allowed status transitions (M11, FR-08, FR-12).
 *
 * The graph:
 *
 *   draft  ──> approved  ──> in_progress  ──> delivered
 *     │         │                │                │
 *     └─────────┴────────────────┴────────────────┴────> archived
 *
 * `archived` is a terminal state but reachable from any other state. `delivered` is also
 * terminal in the workflow; an opportunity that needs to come back into the loop is
 * archived (and a new opportunity is opened if appropriate). The auditor cannot un-archive
 * from the UI; undo is a new row in the audit log.
 */
const OPPORTUNITY_TRANSITIONS: Record<OpportunityStatus, ReadonlyArray<OpportunityStatus>> = {
  draft: ['approved', 'archived'],
  approved: ['in_progress', 'archived'],
  in_progress: ['delivered', 'archived'],
  delivered: ['archived'],
  archived: [],
};

export const opportunityStatusTransitionSchema = z
  .object({
    from: opportunityStatusSchema,
    to: opportunityStatusSchema,
  })
  .refine((v) => OPPORTUNITY_TRANSITIONS[v.from].includes(v.to), {
    message: 'transition is not permitted by the opportunity workflow',
  });
export type OpportunityStatusTransition = z.infer<typeof opportunityStatusTransitionSchema>;

/** The valid "next" statuses from a given current status (used by the UI to render buttons). */
export const nextOpportunityStatuses = (
  current: OpportunityStatus,
): ReadonlyArray<OpportunityStatus> => OPPORTUNITY_TRANSITIONS[current];

/** Human-readable label for the status (kept in the contracts package so the admin UI
 *  never has to duplicate the mapping). */
export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  in_progress: 'In progress',
  delivered: 'Delivered',
  archived: 'Archived',
};
