import { describe, expect, it } from 'vitest';
import { engagementPrivacySchema, engagementSchema, engagementStatusSchema } from './engagement.js';

const ISO = '2026-10-14T19:00:00.000Z';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const TEAM = '550e8400-e29b-41d4-a716-446655440001';
const ENG = '550e8400-e29b-41d4-a716-446655440002';
const TPL = '550e8400-e29b-41d4-a716-446655440003';
const VER = '550e8400-e29b-41d4-a716-446655440004';

const privacy = {
  minResponsesForGroupBreakdown: 5,
  managerSeesIndividualMaturity: false,
  benchmarkCandidate: false,
  noticeLocale: 'fr' as const,
};

describe('engagementPrivacySchema', () => {
  it('enforces a minimum cohort threshold >= 3', () => {
    expect(() =>
      engagementPrivacySchema.parse({ ...privacy, minResponsesForGroupBreakdown: 2 }),
    ).toThrow();
  });

  it('caps the cohort threshold at 50', () => {
    expect(() =>
      engagementPrivacySchema.parse({ ...privacy, minResponsesForGroupBreakdown: 51 }),
    ).toThrow();
  });

  it('defaults managerSeesIndividualMaturity to false', () => {
    const p = engagementPrivacySchema.parse({
      minResponsesForGroupBreakdown: 5,
      benchmarkCandidate: false,
      noticeLocale: 'en',
    });
    expect(p.managerSeesIndividualMaturity).toBe(false);
  });
});

describe('engagementSchema', () => {
  const validEngagement = {
    id: ENG,
    tenantId: TENANT,
    teamIds: [TEAM],
    questionnaireVersionId: VER,
    templateId: TPL,
    status: 'draft' as const,
    opensAt: ISO,
    closesAt: ISO,
    locale: 'fr' as const,
    privacy,
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a valid engagement', () => {
    const e = engagementSchema.parse(validEngagement);
    expect(e.teamIds).toHaveLength(1);
    expect(e.status).toBe('draft');
  });

  it('requires at least one team and rejects more than 50', () => {
    expect(() => engagementSchema.parse({ ...validEngagement, teamIds: [] })).toThrow();
    const tooMany = Array.from({ length: 51 }, () => TEAM);
    expect(() => engagementSchema.parse({ ...validEngagement, teamIds: tooMany })).toThrow();
  });

  it('rejects unknown statuses', () => {
    expect(() => engagementSchema.parse({ ...validEngagement, status: 'running' })).toThrow();
  });

  it('exposes the canonical status lifecycle', () => {
    const lifecycle = engagementStatusSchema.options;
    expect(lifecycle).toEqual([
      'draft',
      'scheduled',
      'in_field',
      'analysis',
      'review',
      'closed',
      'archived',
    ]);
  });
});
