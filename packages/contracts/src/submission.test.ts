import { describe, expect, it } from 'vitest';
import {
  answerSchema,
  answerValueSchema,
  submissionSchema,
  submissionStatusSchema,
} from './submission.js';

const ISO = '2026-10-14T19:00:00.000Z';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const ENG = '550e8400-e29b-41d4-a716-446655440001';
const INV = '550e8400-e29b-41d4-a716-446655440002';
const SUB = '550e8400-e29b-41d4-a716-446655440003';
const VER = '550e8400-e29b-41d4-a716-446655440004';
const ITEM = '550e8400-e29b-41d4-a716-446655440005';
const ANS = '550e8400-e29b-41d4-a716-446655440006';

const baseSubmission = {
  id: SUB,
  tenantId: TENANT,
  engagementId: ENG,
  questionnaireVersionId: VER,
  invitationId: INV,
  status: 'in_progress' as const,
  locale: 'fr' as const,
  activeDurationMs: null,
  startedAt: ISO,
  submittedAt: null,
  endComment: null,
  createdAt: ISO,
  updatedAt: null,
};

describe('submissionStatusSchema', () => {
  it('exposes the four submission states', () => {
    expect([...submissionStatusSchema.options].sort()).toEqual([
      'abandoned',
      'expired',
      'in_progress',
      'submitted',
    ]);
  });
});

describe('submissionSchema', () => {
  it('parses a valid in-progress submission', () => {
    const s = submissionSchema.parse(baseSubmission);
    expect(s.submittedAt).toBeNull();
  });

  it('rejects durations longer than an hour', () => {
    expect(() =>
      submissionSchema.parse({ ...baseSubmission, activeDurationMs: 60 * 60 * 1000 + 1 }),
    ).toThrow();
  });

  it('requires an en or fr locale', () => {
    expect(() => submissionSchema.parse({ ...baseSubmission, locale: 'de' })).toThrow();
  });
});

describe('answerValueSchema', () => {
  it.each([
    ['single_choice', { kind: 'single_choice', choice: 'use_it' }],
    ['multi_choice', { kind: 'multi_choice', choices: ['a', 'b'] }],
    ['short_text', { kind: 'short_text', text: 'v\u00e9rification manuelle' }],
    ['scale_5', { kind: 'scale_5', value: 4 }],
    ['boolean', { kind: 'boolean', value: false }],
    ['scenario_choice', { kind: 'scenario_choice', choice: 'check_source', rationale: null }],
  ])('parses a %s answer', (_label, value) => {
    expect(answerValueSchema.parse(value)).toEqual(value);
  });

  it('rejects scale values outside 1\u20135', () => {
    expect(() => answerValueSchema.parse({ kind: 'scale_5', value: 0 })).toThrow();
    expect(() => answerValueSchema.parse({ kind: 'scale_5', value: 6 })).toThrow();
  });

  it('requires multi_choice to carry at least one option', () => {
    expect(() => answerValueSchema.parse({ kind: 'multi_choice', choices: [] })).toThrow();
  });

  it('rejects free-text answers longer than 2000 chars', () => {
    expect(() => answerValueSchema.parse({ kind: 'short_text', text: 'a'.repeat(2001) })).toThrow();
  });
});

describe('answerSchema', () => {
  const baseAnswer = {
    id: ANS,
    tenantId: TENANT,
    submissionId: SUB,
    questionItemId: ITEM,
    value: { kind: 'single_choice', choice: 'use_it' },
    confidence: 4,
    rationale: null,
    durationMs: 12000,
    sequence: 1,
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a valid answer', () => {
    const a = answerSchema.parse(baseAnswer);
    expect(a.confidence).toBe(4);
  });

  it('requires confidence within 1\u20135', () => {
    expect(() => answerSchema.parse({ ...baseAnswer, confidence: 0 })).toThrow();
    expect(() => answerSchema.parse({ ...baseAnswer, confidence: 6 })).toThrow();
    expect(() => answerSchema.parse({ ...baseAnswer, confidence: null })).not.toThrow();
  });
});
