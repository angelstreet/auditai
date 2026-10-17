import { z } from 'zod';
import { engagementIdSchema, isoDateTimeSchema, tenantIdSchema } from './ids.js';

/**
 * Gamified literacy badge (M14, PRD \u00a76, \u00a79, \u00a715).
 *
 * The respondent-facing surface is the mascot (Tortoise / Fox / Owl)
 * \u2014 the raw quiz_score (1\u2013100) is internal. The auditor / analyst can
 * still see the score, but the team and org rollups never surface it
 * externally: only the dominant mascot tier is computed and stored.
 *
 * The respondent identity is a platform-issued pseudonym; no name, no
 * email, no respondent_id FK. Retention mirrors the tenant's
 * `retention_days` and a future cleanup worker purges rows past their
 * `retention_at`.
 */

export const mascotTierSchema = z.enum(['tortoise', 'fox', 'owl']);
export type MascotTier = z.infer<typeof mascotTierSchema>;

export const mascotTierOrder: ReadonlyArray<MascotTier> = ['tortoise', 'fox', 'owl'];

/** Score on the 1\u2013100 scale. Stored on the row so the analyst can audit; never surfaced. */
export const quizScoreSchema = z.number().int().min(1).max(100);
export type QuizScore = z.infer<typeof quizScoreSchema>;

/** One quiz answer captured by the form. Only `code` + `value` \u2014 no free text. */
export const quizAnswerSchema = z.object({
  questionCode: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
});
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;

/** Map a quiz_score onto a mascot tier. Centralised so server + data layer agree. */
export const mascotTierForScore = (score: QuizScore): MascotTier => {
  if (score <= 50) return 'tortoise';
  if (score <= 80) return 'fox';
  return 'owl';
};

/** One-line EN description per tier. Mirrors `@auditai/domain`'s `tierDescriptor`
 * so web consumers that import only contracts stay consistent. */
export const tierDescriptorFromType = (tier: MascotTier): string => {
  switch (tier) {
    case 'tortoise':
      return "You're at the start of the curve \u2014 a little exposure goes a long way.";
    case 'fox':
      return "You're a regular explorer \u2014 pragmatic, curious, learning as you go.";
    case 'owl':
      return "You're an engaged practitioner \u2014 keep sharing what works.";
  }
};

/** Wire shape of `respondent_badges`. */
export const respondentBadgeSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  respondentPseudonym: z.string().min(8).max(64),
  engagementId: engagementIdSchema.nullable(),
  quizScore: quizScoreSchema,
  mascotTier: mascotTierSchema,
  sourceAnswers: z.array(quizAnswerSchema).default([]),
  isCurrent: z.boolean().default(true),
  assignedAt: isoDateTimeSchema,
  retentionAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type RespondentBadge = z.infer<typeof respondentBadgeSchema>;

/** Write shape posted by the quiz form. The server fills ids + timestamps. */
export const respondentBadgeWriteSchema = z.object({
  tenantId: tenantIdSchema,
  respondentPseudonym: z.string().min(8).max(64),
  engagementId: engagementIdSchema.nullable().default(null),
  quizScore: quizScoreSchema,
  sourceAnswers: z.array(quizAnswerSchema).default([]),
});
export type RespondentBadgeWrite = z.infer<typeof respondentBadgeWriteSchema>;

/** Wire shape of `team_badges`. */
export const teamBadgeSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  teamId: z.string().uuid(),
  dominantTier: mascotTierSchema,
  memberCount: z.number().int().min(0),
  tortoiseCount: z.number().int().min(0),
  foxCount: z.number().int().min(0),
  owlCount: z.number().int().min(0),
  computedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type TeamBadge = z.infer<typeof teamBadgeSchema>;
