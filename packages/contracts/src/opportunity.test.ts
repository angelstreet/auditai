import { describe, expect, it } from 'vitest';
import {
  impactScoreSchema,
  nextOpportunityStatuses,
  OPPORTUNITY_STATUS_LABELS,
  opportunitySchema,
  opportunityStatusSchema,
  opportunityStatusTransitionSchema,
  opportunityWriteSchema,
} from './opportunity.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ENG = 'a5555555-4555-4555-8555-555555555555';
const ANALYSIS = 'b0000000-0000-4000-8000-000000000001';
const USER = '99999999-9999-4999-8999-999999999999';
const OPP = 'c0000000-0000-4000-8000-000000000001';

describe('opportunity schema (M10, FR-08)', () => {
  it('exposes the five workflow states', () => {
    expect(opportunityStatusSchema.options).toEqual([
      'draft',
      'approved',
      'in_progress',
      'delivered',
      'archived',
    ]);
  });

  it('parses a draft opportunity linked to an analysis', () => {
    const row = opportunitySchema.parse({
      id: OPP,
      tenantId: TENANT,
      engagementId: ENG,
      analysisId: ANALYSIS,
      status: 'draft',
      title: 'Reduce source-checking overhead',
      description: 'Group B reports ~3.5h/week on source checking.',
      axis: 'literacy',
      impactScore: 0.42,
      ownerUserId: null,
      createdBy: USER,
      createdAt: '2026-10-15T06:00:00.000Z',
      updatedAt: '2026-10-15T06:00:00.000Z',
      archivedAt: null,
    });
    expect(row.impactScore).toBe(0.42);
    expect(row.archivedAt).toBeNull();
  });

  it('accepts an unlinked (analysisId = null) draft', () => {
    const row = opportunitySchema.parse({
      id: OPP,
      tenantId: TENANT,
      engagementId: ENG,
      analysisId: null,
      status: 'draft',
      title: 'Manual draft — link later',
      description: '',
      axis: null,
      impactScore: null,
      ownerUserId: null,
      createdBy: USER,
      createdAt: '2026-10-15T06:00:00.000Z',
      updatedAt: '2026-10-15T06:00:00.000Z',
      archivedAt: null,
    });
    expect(row.analysisId).toBeNull();
  });

  it('rejects an impact score above 1', () => {
    const result = impactScoreSchema.safeParse(1.5);
    expect(result.success).toBe(false);
  });

  it('rejects a title shorter than 3 characters', () => {
    const result = opportunitySchema.safeParse({
      id: OPP,
      tenantId: TENANT,
      engagementId: ENG,
      analysisId: null,
      status: 'draft',
      title: 'no',
      description: '',
      axis: null,
      impactScore: null,
      ownerUserId: null,
      createdBy: USER,
      createdAt: '2026-10-15T06:00:00.000Z',
      updatedAt: '2026-10-15T06:00:00.000Z',
      archivedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it('write request defaults status to draft and analysisId to null', () => {
    const result = opportunityWriteSchema.safeParse({
      engagementId: ENG,
      title: 'Reduce source-checking overhead',
      description: 'Group B reports ~3.5h/week on source checking.',
      axis: 'literacy',
      impactScore: 0.42,
      createdBy: USER,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
      expect(result.data.analysisId).toBeNull();
    }
  });
});

describe('opportunity status workflow (M11, FR-08)', () => {
  it('exposes the five workflow states', () => {
    expect(opportunityStatusSchema.options).toEqual([
      'draft',
      'approved',
      'in_progress',
      'delivered',
      'archived',
    ]);
  });

  it('labels every status with a human-readable name', () => {
    expect(OPPORTUNITY_STATUS_LABELS.draft).toBe('Draft');
    expect(OPPORTUNITY_STATUS_LABELS.approved).toBe('Approved');
    expect(OPPORTUNITY_STATUS_LABELS.in_progress).toBe('In progress');
    expect(OPPORTUNITY_STATUS_LABELS.delivered).toBe('Delivered');
    expect(OPPORTUNITY_STATUS_LABELS.archived).toBe('Archived');
  });

  it('allows the happy path draft -> approved -> in_progress -> delivered', () => {
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'draft', to: 'approved' }).success,
    ).toBe(true);
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'approved', to: 'in_progress' }).success,
    ).toBe(true);
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'in_progress', to: 'delivered' }).success,
    ).toBe(true);
  });

  it('allows archive from any non-terminal state', () => {
    for (const from of ['draft', 'approved', 'in_progress', 'delivered'] as const) {
      expect(opportunityStatusTransitionSchema.safeParse({ from, to: 'archived' }).success).toBe(
        true,
      );
    }
  });

  it('rejects skipping states', () => {
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'draft', to: 'in_progress' }).success,
    ).toBe(false);
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'draft', to: 'delivered' }).success,
    ).toBe(false);
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'approved', to: 'delivered' }).success,
    ).toBe(false);
  });

  it('rejects reverse transitions', () => {
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'approved', to: 'draft' }).success,
    ).toBe(false);
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'in_progress', to: 'approved' }).success,
    ).toBe(false);
  });

  it('treats archived as terminal', () => {
    expect(nextOpportunityStatuses('archived')).toEqual([]);
    expect(
      opportunityStatusTransitionSchema.safeParse({ from: 'archived', to: 'draft' }).success,
    ).toBe(false);
  });

  it('nextOpportunityStatuses enumerates the buttons the UI should render', () => {
    expect(nextOpportunityStatuses('draft')).toEqual(['approved', 'archived']);
    expect(nextOpportunityStatuses('approved')).toEqual(['in_progress', 'archived']);
    expect(nextOpportunityStatuses('in_progress')).toEqual(['delivered', 'archived']);
    expect(nextOpportunityStatuses('delivered')).toEqual(['archived']);
  });
});
