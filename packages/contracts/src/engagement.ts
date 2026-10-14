import { z } from 'zod';
import {
  engagementIdSchema,
  isoDateTimeSchema,
  localeSchema,
  questionnaireVersionIdSchema,
  templateIdSchema,
  tenantIdSchema,
  teamIdSchema,
} from './ids.js';

/**
 * Audit engagement \u2014 a bounded piece of audit work scoped to one or more teams, one survey
 * template version and one locale. The engagement carries the privacy configuration that drives
 * the survey UI (PRD \u00a76.3, \u00a716).
 */

export const engagementStatusSchema = z.enum([
  'draft',
  'scheduled',
  'in_field',
  'analysis',
  'review',
  'closed',
  'archived',
]);
export type EngagementStatus = z.infer<typeof engagementStatusSchema>;

/**
 * The privacy threshold below which group maturity breakdowns are not shown (PRD \u00a76.3,
 * \u00a722). We default to the conservative end of the range the PRD sketches.
 */
export const engagementPrivacySchema = z.object({
  /** Minimum number of *submitted* responses required to render a maturity breakdown. */
  minResponsesForGroupBreakdown: z.number().int().min(3).max(50),
  /** Whether team managers can see individual maturity scores by default. Default false. */
  managerSeesIndividualMaturity: z.boolean().default(false),
  /** Whether the audit may reuse anonymised submissions for the benchmark knowledge base. */
  benchmarkCandidate: z.boolean(),
  /** Locale the engagement was negotiated in; drives the privacy notice copy. */
  noticeLocale: localeSchema,
});
export type EngagementPrivacy = z.infer<typeof engagementPrivacySchema>;

export const engagementSchema = z.object({
  id: engagementIdSchema,
  tenantId: tenantIdSchema,
  /** Engagement may span multiple teams; teams live inside the same tenant and organisation. */
  teamIds: z.array(teamIdSchema).min(1).max(50),
  /** The questionnaire version the field uses. Frozen once the engagement leaves `draft`. */
  questionnaireVersionId: questionnaireVersionIdSchema,
  /** The owning template id, retained for the audit trail even after the version is frozen. */
  templateId: templateIdSchema,
  status: engagementStatusSchema,
  /** ISO timestamps for scheduling windows. */
  opensAt: isoDateTimeSchema.nullable(),
  closesAt: isoDateTimeSchema.nullable(),
  /** Locale the consultant negotiates with the client. */
  locale: localeSchema,
  privacy: engagementPrivacySchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Engagement = z.infer<typeof engagementSchema>;
