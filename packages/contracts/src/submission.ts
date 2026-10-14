import { z } from 'zod';
import {
  answerIdSchema,
  engagementIdSchema,
  invitationIdSchema,
  isoDateTimeSchema,
  questionnaireVersionIdSchema,
  questionItemIdSchema,
  submissionIdSchema,
  tenantIdSchema,
} from './ids.js';

/**
 * Submission and answer \u2014 the only place an employee contributes content. Submissions are
 * immutable after `submittedAt` is set; subsequent edits create a new submission row (PRD
 * \u00a714). Answers are typed against the question schema they belong to, validated at the
 * service layer.
 */

export const submissionStatusSchema = z.enum(['in_progress', 'submitted', 'abandoned', 'expired']);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const submissionSchema = z.object({
  id: submissionIdSchema,
  tenantId: tenantIdSchema,
  engagementId: engagementIdSchema,
  /** Frozen at start so item changes cannot retroactively change answers. */
  questionnaireVersionId: questionnaireVersionIdSchema,
  invitationId: invitationIdSchema,
  status: submissionStatusSchema,
  /** Locale the respondent completed the survey in. */
  locale: z.enum(['fr', 'en']),
  /** Total active duration in milliseconds, recorded by the client on close. */
  activeDurationMs: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 1000)
    .nullable(),
  startedAt: isoDateTimeSchema,
  submittedAt: isoDateTimeSchema.nullable(),
  /** Free-text feedback collected at the end of the survey (PRD \u00a77). */
  endComment: z.string().max(2000).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Submission = z.infer<typeof submissionSchema>;

/**
 * Answer value union \u2014 only one variant per question. The actual content is validated
 * against the question's kind in the service layer; this schema enforces shape.
 */
export const answerValueSchema = z.union([
  z.object({ kind: z.literal('single_choice'), choice: z.string().min(1).max(40) }),
  z.object({
    kind: z.literal('multi_choice'),
    choices: z.array(z.string().min(1).max(40)).min(1).max(10),
  }),
  z.object({ kind: z.literal('short_text'), text: z.string().min(1).max(2000) }),
  z.object({ kind: z.literal('scale_5'), value: z.number().int().min(1).max(5) }),
  z.object({ kind: z.literal('boolean'), value: z.boolean() }),
  z.object({
    kind: z.literal('scenario_choice'),
    choice: z.string().min(1).max(40),
    rationale: z.string().max(2000).nullable(),
  }),
]);

export type AnswerValue = z.infer<typeof answerValueSchema>;

/**
 * Answer \u2014 a single question's response. `confidence` is recorded separately so we can flag
 * "not sure" answers in scoring (PRD \u00a76.1).
 */
export const answerSchema = z.object({
  id: answerIdSchema,
  tenantId: tenantIdSchema,
  submissionId: submissionIdSchema,
  questionItemId: questionItemIdSchema,
  value: answerValueSchema,
  /** Self-reported confidence 1\u20135 (PRD \u00a76.1). Null when not collected. */
  confidence: z.number().int().min(1).max(5).nullable(),
  /** Optional free-text rationale; for scenario questions only. */
  rationale: z.string().max(2000).nullable(),
  /** Time spent on this question in milliseconds; recorded by the client. */
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 1000)
    .nullable(),
  /** Client-side sequence number to support resume without duplicates. */
  sequence: z.number().int().min(0).max(1_000),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Answer = z.infer<typeof answerSchema>;
