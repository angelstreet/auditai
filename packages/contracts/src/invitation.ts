import { z } from 'zod';
import {
  engagementIdSchema,
  invitationIdSchema,
  isoDateTimeSchema,
  respondentPseudonymSchema,
  tenantIdSchema,
  teamIdSchema,
} from './ids.js';

/**
 * Invitations, respondents, submissions, and answers \u2014 PRD \u00a75, \u00a714, \u00a716.
 *
 * Invitations are the only thing employees see. They carry a token the platform uses to grant
 * scoped read/write on a single submission; never open the tenant.
 */

export const invitationStatusSchema = z.enum([
  'pending',
  'opened',
  'in_progress',
  'submitted',
  'declined',
  'expired',
  'revoked',
]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

/**
 * The token shape is opaque to clients. We split the *reference* (used in URLs) from the
 * *secret* (sent via secure channel) so a leaked URL cannot be replayed without the secret.
 * For the MVP both halves live in the same row; the secret portion is hashed at rest.
 */
export const invitationTokenShapeSchema = z.object({
  /** Public reference \u2014 safe to log, safe to put in URLs. */
  reference: z.string().min(8).max(128),
  /** HMAC of the reference under the engagement's signing key, base64url. */
  signature: z.string().min(16).max(256),
});

export type InvitationTokenShape = z.infer<typeof invitationTokenShapeSchema>;

export const invitationSchema = z.object({
  id: invitationIdSchema,
  tenantId: tenantIdSchema,
  engagementId: engagementIdSchema,
  teamId: teamIdSchema,
  /** Pseudonym assigned to this invite; never the employee's real name. */
  respondentPseudonym: respondentPseudonymSchema,
  status: invitationStatusSchema,
  /** Public reference + signature used in the URL/token. */
  token: invitationTokenShapeSchema,
  opensAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  /** Number of times the invitation page has been opened \u2014 for analytics and abuse detection. */
  openCount: z.number().int().min(0).max(1_000).default(0),
  /** Optional pointer to the submission once the respondent starts. */
  submissionId: z.string().uuid().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Invitation = z.infer<typeof invitationSchema>;

/**
 * Respondent \u2014 the per-invitation audit-side record. Distinct from the invitation so we can
 * revoke access (e.g. on withdrawal) without losing the audit trail of what was attempted.
 */
export const respondentSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  invitationId: invitationIdSchema,
  /** The pseudonym the platform issued. */
  pseudonym: respondentPseudonymSchema,
  /** Locale the respondent last selected on the UI. */
  preferredLocale: z.enum(['fr', 'en']),
  /** First time the respondent opened the invite. */
  firstOpenedAt: isoDateTimeSchema.nullable(),
  /** Most recent open. */
  lastSeenAt: isoDateTimeSchema.nullable(),
  /** When the respondent finished (success or withdraw). */
  finishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Respondent = z.infer<typeof respondentSchema>;
