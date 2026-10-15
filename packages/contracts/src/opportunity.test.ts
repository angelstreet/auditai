import { describe, expect, it } from 'vitest';
import {
  impactScoreSchema,
  opportunitySchema,
  opportunityStatusSchema,
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
