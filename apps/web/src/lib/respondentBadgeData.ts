import type {
  MascotTier,
  QuizAnswer,
  QuizScore,
  RespondentBadge,
  RespondentBadgeWrite,
  TenantId,
} from '@evolai/contracts';
import {
  mascotTierForScore,
  quizScoreSchema,
  type MascotTier as MascotTierType,
} from '@evolai/contracts';
import { withTenant } from './db';

/**
 * Respondent-badge data layer (M14, PRD §6, §9, §15).
 *
 * `writeRespondentBadge` is the only write path. It:
 *
 *   * validates the payload (including the score range);
 *   * computes the mascot tier centrally via `mascotTierForScore`;
 *   * flips the previous "current" badge for this pseudonym to
 *     `is_current = FALSE` in the same transaction so the team rollup
 *     always sees exactly one current badge per respondent;
 *   * writes one new row with `is_current = TRUE`.
 *
 * `getCurrentBadgeForPseudonym` returns the latest `is_current` row
 * (or `null`). The respondent-facing page reads through this helper.
 *
 * No raw quiz_score is ever returned to the client here: the
 * respondent page is a server component that renders only the
 * mascotTier. The score is preserved on the row for the analyst.
 */

interface RespondentBadgeRow {
  id: string;
  tenant_id: string;
  respondent_pseudonym: string;
  engagement_id: string | null;
  quiz_score: number;
  mascot_tier: MascotTier;
  source_answers: QuizAnswer[];
  is_current: boolean;
  assigned_at: string;
  retention_at: string;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: RespondentBadgeRow): RespondentBadge => ({
  id: r.id,
  tenantId: r.tenant_id as RespondentBadge['tenantId'],
  respondentPseudonym: r.respondent_pseudonym,
  engagementId: (r.engagement_id ?? null) as RespondentBadge['engagementId'],
  quizScore: r.quiz_score as QuizScore,
  mascotTier: r.mascot_tier as MascotTierType,
  sourceAnswers: r.source_answers ?? [],
  isCurrent: r.is_current,
  assignedAt: r.assigned_at,
  retentionAt: r.retention_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const writeRespondentBadge = async (
  tenantId: TenantId,
  payload: RespondentBadgeWrite,
): Promise<RespondentBadge> => {
  const parsedScore = quizScoreSchema.safeParse(payload.quizScore);
  if (!parsedScore.success) {
    throw new Error(
      `invalid quiz_score=${payload.quizScore}: ${parsedScore.error.issues
        .map((i) => i.message)
        .join('; ')}`,
    );
  }
  const tier: MascotTier = mascotTierForScore(parsedScore.data);
  return withTenant(tenantId, async (client) => {
    // Demote the previous current row for this pseudonym so the team
    // rollup still sees exactly one active badge per respondent.
    await client.query(
      `UPDATE respondent_badges
          SET is_current = FALSE, updated_at = now()
        WHERE tenant_id = $1 AND respondent_pseudonym = $2 AND is_current = TRUE`,
      [tenantId, payload.respondentPseudonym],
    );
    const insert = await client.query<RespondentBadgeRow>(
      `INSERT INTO respondent_badges (
          tenant_id, respondent_pseudonym, engagement_id,
          quiz_score, mascot_tier, source_answers,
          is_current, assigned_at, retention_at,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, TRUE, now(), now() + interval '365 days', now(), now()
        )
        RETURNING id, tenant_id, respondent_pseudonym, engagement_id,
                  quiz_score, mascot_tier, source_answers, is_current,
                  assigned_at, retention_at, created_at, updated_at`,
      [
        tenantId,
        payload.respondentPseudonym,
        payload.engagementId,
        parsedScore.data,
        tier,
        JSON.stringify(payload.sourceAnswers),
      ],
    );
    if (insert.rows.length === 0) {
      throw new Error('respondent_badges insert did not return a row');
    }
    const inserted = insert.rows[0] as RespondentBadgeRow;
    return fromRow(inserted);
  });
};

export const getCurrentBadgeForPseudonym = async (
  tenantId: TenantId,
  pseudonym: string,
): Promise<RespondentBadge | null> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RespondentBadgeRow>(
      `SELECT id, tenant_id, respondent_pseudonym, engagement_id,
              quiz_score, mascot_tier, source_answers, is_current,
              assigned_at, retention_at, created_at, updated_at
         FROM respondent_badges
        WHERE tenant_id = $1
          AND respondent_pseudonym = $2
          AND is_current = TRUE
        ORDER BY assigned_at DESC
        LIMIT 1`,
      [tenantId, pseudonym],
    );
    const row = rows[0];
    return row ? fromRow(row) : null;
  });
};
