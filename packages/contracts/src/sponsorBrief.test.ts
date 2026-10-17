import { describe, expect, it } from 'vitest';
import {
  sponsorBriefSchema,
  sponsorBriefWriteSchema,
  sponsorDepartmentSchema,
  sponsorModelRegionSchema,
  sponsorOnsiteAppetiteSchema,
  sponsorResidencySchema,
  sponsorSensitivitySchema,
  maturityScoreSchema,
} from './sponsorBrief.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const ID = 'b0000000-0000-4000-8000-000000000001';

describe('sponsor brief schema (M12, FR-08)', () => {
  it('exposes the canonical enums', () => {
    expect(sponsorDepartmentSchema.options).toEqual([
      'operations',
      'sales',
      'finance',
      'legal',
      'engineering',
      'people',
    ]);
    expect(sponsorSensitivitySchema.options).toEqual([
      'internal_only',
      'public_web',
      'customer_pii',
      'regulated',
    ]);
    expect(sponsorOnsiteAppetiteSchema.options).toEqual([
      'full_pilot',
      'limited_team',
      'remote_only',
    ]);
    expect(sponsorModelRegionSchema.options).toEqual([
      'eu_only',
      'us_enterprise',
      'self_hosted',
      'no_constraint',
    ]);
    expect(sponsorResidencySchema.options).toEqual(['eu_frankfurt', 'us', 'client_vpc']);
  });

  it('accepts a fully-populated brief', () => {
    const row = sponsorBriefSchema.parse({
      id: ID,
      tenantId: TENANT,
      sponsorUserId: USER,
      topPriorityWorkflow: 'Reduce source-checking time on outbound deliverables',
      departmentsInScope: ['operations', 'sales'],
      dataSensitivityBoundary: ['internal_only'],
      annualBudgetEur: 45000,
      onsiteAppetite: 'limited_team',
      approvedModelRegions: ['eu_only'],
      dataResidency: ['eu_frankfurt'],
      promptInjectionReview: 'external_auditor',
      leadershipLiteracy: 2,
      operationalAdoption: 1,
      policyGovernance: 3,
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
    });
    expect(row.annualBudgetEur).toBe(45000);
    expect(row.departmentsInScope).toEqual(['operations', 'sales']);
  });

  it('write schema defaults optional fields to sensible empty values', () => {
    const row = sponsorBriefWriteSchema.parse({
      tenantId: TENANT,
      sponsorUserId: null,
    });
    expect(row.topPriorityWorkflow).toBe('');
    expect(row.departmentsInScope).toEqual([]);
    expect(row.dataSensitivityBoundary).toEqual([]);
    expect(row.annualBudgetEur).toBeNull();
    expect(row.onsiteAppetite).toBeNull();
    expect(row.approvedModelRegions).toEqual([]);
    expect(row.dataResidency).toEqual([]);
    expect(row.promptInjectionReview).toBeNull();
    expect(row.leadershipLiteracy).toBeNull();
    expect(row.operationalAdoption).toBeNull();
    expect(row.policyGovernance).toBeNull();
  });

  it('rejects a maturity score outside 0..5', () => {
    expect(maturityScoreSchema.safeParse(-1).success).toBe(false);
    expect(maturityScoreSchema.safeParse(6).success).toBe(false);
    expect(maturityScoreSchema.safeParse(2.5).success).toBe(false);
  });

  it('rejects an unknown department', () => {
    const result = sponsorBriefWriteSchema.safeParse({
      tenantId: TENANT,
      sponsorUserId: null,
      departmentsInScope: ['marketing'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative budget', () => {
    const result = sponsorBriefWriteSchema.safeParse({
      tenantId: TENANT,
      sponsorUserId: null,
      annualBudgetEur: -1,
    });
    expect(result.success).toBe(false);
  });
});
