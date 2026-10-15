import { z } from 'zod';

/**
 * Shared identifier primitives and value-object schemas reused by every entity.
 *
 * `TenantId` is the *boundary* id (PRD \u00a714): every client-owned row carries one. Tenant IDs are
 * emitted by the platform, not by clients, so we model them as branded UUIDs to keep them out of
 * accidental cross-wiring with other ids.
 *
 * We rely on Zod's runtime validation plus TypeScript's type system to enforce shape. Branded
 * types add a phantom tag so a `TenantId` cannot be assigned to a `SubmissionId` even though both
 * are strings at runtime.
 */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const localeSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'must be an ISO-8601 date-time with timezone offset' });

export const uuidV4Schema = z.string().regex(UUID_V4_REGEX, 'must be a UUID v4');

/**
 * Branded string factory \u2014 wraps a Zod string schema with a phantom tag so TypeScript treats
 * `TenantId` and `OrganisationId` as incompatible types. The runtime representation is still a
 * plain string.
 */
export const brandedId = <Brand extends string>(_brand: Brand) => uuidV4Schema.brand<Brand>();

/** Returns true if the given string parses as a UUID v4 (used by tests). */
export const isUuidV4 = (value: string): boolean => UUID_V4_REGEX.test(value);

/**
 * `tenantIdSchema` is exported separately so domain code can refer to the boundary id without
 * having to know which brand the organisation id uses.
 */
export const tenantIdSchema = brandedId('TenantId');
export type TenantId = z.infer<typeof tenantIdSchema>;

export const organisationIdSchema = brandedId('OrganisationId');
export type OrganisationId = z.infer<typeof organisationIdSchema>;

export const departmentIdSchema = brandedId('DepartmentId');
export type DepartmentId = z.infer<typeof departmentIdSchema>;

export const teamIdSchema = brandedId('TeamId');
export type TeamId = z.infer<typeof teamIdSchema>;

export const userIdSchema = brandedId('UserId');
export type UserId = z.infer<typeof userIdSchema>;

export const engagementIdSchema = brandedId('EngagementId');
export type EngagementId = z.infer<typeof engagementIdSchema>;

export const templateIdSchema = brandedId('TemplateId');
export type TemplateId = z.infer<typeof templateIdSchema>;

export const questionnaireVersionIdSchema = brandedId('QuestionnaireVersionId');
export type QuestionnaireVersionId = z.infer<typeof questionnaireVersionIdSchema>;

export const questionItemIdSchema = brandedId('QuestionItemId');
export type QuestionItemId = z.infer<typeof questionItemIdSchema>;

export const invitationIdSchema = brandedId('InvitationId');
export type InvitationId = z.infer<typeof invitationIdSchema>;

export const submissionIdSchema = brandedId('SubmissionId');
export type SubmissionId = z.infer<typeof submissionIdSchema>;

export const answerIdSchema = brandedId('AnswerId');
export type AnswerId = z.infer<typeof answerIdSchema>;

export const analysisIdSchema = brandedId('AnalysisId');
export type AnalysisId = z.infer<typeof analysisIdSchema>;

export const opportunityIdSchema = brandedId('OpportunityId');
export type OpportunityId = z.infer<typeof opportunityIdSchema>;

export const auditLogIdSchema = brandedId('AuditLogId');
export type AuditLogId = z.infer<typeof auditLogIdSchema>;

/**
 * `respondentPseudonymSchema` is a non-identifying handle the platform issues for an employee so
 * the audit can reference the submission without storing the real name. PRD \u00a715 forbids
 * unnecessary personal data; pseudonyms are the default.
 */
export const respondentPseudonymSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'must be lowercase letters, digits and hyphens only');
export type RespondentPseudonym = z.infer<typeof respondentPseudonymSchema>;

/**
 * Pagination cursor (opaque base64url). We don't model ordering yet \u2014 the admin endpoints will
 * decide the field \u2014 but we ship the contract now so M5/M6 can adopt it without a breaking change.
 */
export const paginationCursorSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export type PaginationCursor = z.infer<typeof paginationCursorSchema>;
