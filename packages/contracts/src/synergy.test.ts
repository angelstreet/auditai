import { describe, expect, it } from 'vitest';
import {
  synergyIdSchema,
  synergyKeySchema,
  synergySchema,
  synergyStatusSchema,
  synergyStatusTransitionSchema,
  synergyWriteSchema,
} from './synergy.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ENG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ANALYSIS_A = 'a3333333-4333-4333-8333-aaaaaaaaaa01';
const ANALYSIS_B = 'a3333333-4333-4333-8333-bbbbbbbbbb01';
const SYNERGY_ID = '10000000-0000-4000-8000-000000000001';
const KEY = 'literacy:source_checking';

describe('synergy schema (M13, FR-14)', () => {
  it('exposes the canonical status enum', () => {
    expect(synergyStatusSchema.options).toEqual(['detected', 'surfaced', 'dismissed', 'archived']);
  });

  it('rejects a synergy key with whitespace or punctuation', () => {
    expect(synergyKeySchema.safeParse('has space').success).toBe(false);
    expect(synergyKeySchema.safeParse('has/slash').success).toBe(false);
    expect(synergyKeySchema.safeParse('a').success).toBe(false);
    expect(synergyKeySchema.safeParse(KEY).success).toBe(true);
  });

  it('parses a fully-populated synergy row', () => {
    const row = synergySchema.parse({
      id: SYNERGY_ID,
      tenantId: TENANT,
      axis: 'literacy',
      themeLabel: 'Source-checking practice',
      synergyKey: KEY,
      sourceAnalysisIds: [ANALYSIS_A, ANALYSIS_B],
      sourceEngagementIds: [ENG_A, ENG_B],
      occurrenceCount: 2,
      proposedFollowupPrompt:
        'Where in your workflow does the team verify a cited number before it ships?',
      status: 'detected',
      detectedAt: '2026-10-17T10:00:00.000Z',
      surfacedAt: null,
      dismissedAt: null,
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    });
    expect(row.occurrenceCount).toBe(2);
    expect(row.sourceEngagementIds).toEqual([ENG_A, ENG_B]);
  });

  it('requires at least two source analyses in both shapes', () => {
    const baseWrite = {
      tenantId: TENANT,
      axis: 'literacy' as const,
      themeLabel: 'Source-checking practice',
      synergyKey: KEY,
      proposedFollowupPrompt: 'A follow-up question of adequate length to satisfy the validator.',
    };
    expect(
      synergyWriteSchema.safeParse({ ...baseWrite, sourceAnalysisIds: [ANALYSIS_A] }).success,
    ).toBe(false);
    expect(
      synergyWriteSchema.safeParse({
        ...baseWrite,
        sourceAnalysisIds: [ANALYSIS_A, ANALYSIS_B],
      }).success,
    ).toBe(true);
  });

  it('rejects a too-short follow-up prompt', () => {
    const result = synergyWriteSchema.safeParse({
      tenantId: TENANT,
      axis: 'literacy',
      themeLabel: 'Source-checking practice',
      synergyKey: KEY,
      sourceAnalysisIds: [ANALYSIS_A, ANALYSIS_B],
      proposedFollowupPrompt: 'too short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown axis', () => {
    const result = synergyWriteSchema.safeParse({
      tenantId: TENANT,
      axis: 'compliance',
      themeLabel: 'Source-checking practice',
      synergyKey: KEY,
      sourceAnalysisIds: [ANALYSIS_A, ANALYSIS_B],
      proposedFollowupPrompt: 'A follow-up question of adequate length to satisfy the validator.',
    });
    expect(result.success).toBe(false);
  });

  it('parses a SynergyId with the right brand shape', () => {
    const id = synergyIdSchema.parse(SYNERGY_ID);
    expect(id).toBe(SYNERGY_ID);
    expect(synergyIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('allows the canonical status transitions', () => {
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'detected', to: 'surfaced' }).success,
    ).toBe(true);
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'detected', to: 'dismissed' }).success,
    ).toBe(true);
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'surfaced', to: 'archived' }).success,
    ).toBe(true);
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'dismissed', to: 'surfaced' }).success,
    ).toBe(true);
  });

  it('rejects illegal transitions', () => {
    // No self-loop.
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'detected', to: 'detected' }).success,
    ).toBe(false);
    // Cannot leap directly to archived from detected.
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'detected', to: 'archived' }).success,
    ).toBe(false);
    // Archived is terminal.
    expect(
      synergyStatusTransitionSchema.safeParse({ from: 'archived', to: 'surfaced' }).success,
    ).toBe(false);
  });
});
