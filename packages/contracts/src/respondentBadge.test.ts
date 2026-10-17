import { describe, expect, it } from 'vitest';
import {
  mascotTierForScore,
  mascotTierOrder,
  mascotTierSchema,
  quizScoreSchema,
  respondentBadgeSchema,
  respondentBadgeWriteSchema,
  teamBadgeSchema,
} from './respondentBadge.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const PSEUDONYM = 'synthetic-quizzer-001';
const ENG_ID = 'a5555555-4555-4555-8555-555555555555';
const BADGE_ID = 'e0000000-0000-4000-8000-000000000001';
const TEAM_BADGE_ID = 'e0000000-0000-4000-8000-000000000002';
const TEAM_ID = 'a2222222-2222-4222-8222-222222222222';

describe('respondent badge (M14, PRD \u00a76)', () => {
  it('exposes the canonical mascot tier order', () => {
    expect(mascotTierSchema.options).toEqual(['tortoise', 'fox', 'owl']);
    expect(mascotTierOrder).toEqual(['tortoise', 'fox', 'owl']);
  });

  it('maps a quiz score to the right tier', () => {
    expect(mascotTierForScore(1)).toBe('tortoise');
    expect(mascotTierForScore(50)).toBe('tortoise');
    expect(mascotTierForScore(51)).toBe('fox');
    expect(mascotTierForScore(80)).toBe('fox');
    expect(mascotTierForScore(81)).toBe('owl');
    expect(mascotTierForScore(100)).toBe('owl');
  });

  it('rejects out-of-range quiz scores', () => {
    expect(quizScoreSchema.safeParse(0).success).toBe(false);
    expect(quizScoreSchema.safeParse(101).success).toBe(false);
    expect(quizScoreSchema.safeParse(50.5).success).toBe(false);
    expect(quizScoreSchema.safeParse(73).success).toBe(true);
  });

  it('parses a fully-populated respondent badge row', () => {
    const row = respondentBadgeSchema.parse({
      id: BADGE_ID,
      tenantId: TENANT,
      respondentPseudonym: PSEUDONYM,
      engagementId: ENG_ID,
      quizScore: 73,
      mascotTier: 'fox',
      sourceAnswers: [{ questionCode: 'ai_last_30d', value: 'weekly' }],
      isCurrent: true,
      assignedAt: '2026-10-17T10:00:00.000Z',
      retentionAt: '2027-10-17T10:00:00.000Z',
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    });
    expect(row.mascotTier).toBe('fox');
    expect(row.quizScore).toBe(73);
  });

  it('write schema defaults optional engagement + empty sourceAnswers', () => {
    const row = respondentBadgeWriteSchema.parse({
      tenantId: TENANT,
      respondentPseudonym: PSEUDONYM,
      quizScore: 92,
    });
    expect(row.engagementId).toBeNull();
    expect(row.sourceAnswers).toEqual([]);
  });

  it('rejects a write with an unknown mascot tier', () => {
    const result = respondentBadgeSchema.safeParse({
      id: BADGE_ID,
      tenantId: TENANT,
      respondentPseudonym: PSEUDONYM,
      engagementId: ENG_ID,
      quizScore: 50,
      mascotTier: 'panda',
      sourceAnswers: [],
      isCurrent: true,
      assignedAt: '2026-10-17T10:00:00.000Z',
      retentionAt: '2027-10-17T10:00:00.000Z',
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('parses a team badge rollup', () => {
    const row = teamBadgeSchema.parse({
      id: TEAM_BADGE_ID,
      tenantId: TENANT,
      teamId: TEAM_ID,
      dominantTier: 'fox',
      memberCount: 12,
      tortoiseCount: 4,
      foxCount: 6,
      owlCount: 2,
      computedAt: '2026-10-17T10:00:00.000Z',
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    });
    expect(row.memberCount).toBe(12);
    expect(row.foxCount + row.tortoiseCount + row.owlCount).toBeLessThanOrEqual(row.memberCount);
  });

  it('rejects a negative member count', () => {
    const result = teamBadgeSchema.safeParse({
      id: TEAM_BADGE_ID,
      tenantId: TENANT,
      teamId: TEAM_ID,
      dominantTier: 'fox',
      memberCount: -1,
      tortoiseCount: 0,
      foxCount: 0,
      owlCount: 0,
      computedAt: '2026-10-17T10:00:00.000Z',
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
