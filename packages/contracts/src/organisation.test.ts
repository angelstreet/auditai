import { describe, expect, it } from 'vitest';
import { departmentSchema, organisationSchema } from './organisation.js';

const ISO = '2026-10-14T19:00:00.000Z';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const ORG = '550e8400-e29b-41d4-a716-446655440001';
const DEPT = '550e8400-e29b-41d4-a716-446655440002';

const validOrg = {
  id: ORG,
  tenantId: TENANT,
  legalName: 'Acme s\u00e0rl',
  tradingName: 'Acme',
  country: 'FR',
  sector: 'consulting',
  createdAt: ISO,
  updatedAt: null,
};

describe('organisationSchema', () => {
  it('parses a valid organisation', () => {
    const o = organisationSchema.parse(validOrg);
    expect(o.country).toBe('FR');
    expect(o.sector).toBe('consulting');
  });

  it('requires an ISO 3166-1 alpha-2 country', () => {
    expect(() => organisationSchema.parse({ ...validOrg, country: 'fr' })).toThrow();
    expect(() => organisationSchema.parse({ ...validOrg, country: 'FRA' })).toThrow();
    expect(() => organisationSchema.parse({ ...validOrg, country: 'F1' })).toThrow();
  });

  it('allows null tradingName and sector', () => {
    const o = organisationSchema.parse({
      ...validOrg,
      tradingName: null,
      sector: null,
    });
    expect(o.tradingName).toBeNull();
    expect(o.sector).toBeNull();
  });

  it('rejects empty legal names', () => {
    expect(() => organisationSchema.parse({ ...validOrg, legalName: '' })).toThrow();
  });
});

describe('departmentSchema', () => {
  const validDept = {
    id: DEPT,
    tenantId: TENANT,
    organisationId: ORG,
    name: 'Operations',
    code: 'ops',
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a valid department', () => {
    const d = departmentSchema.parse(validDept);
    expect(d.code).toBe('ops');
  });

  it('requires snake_case department codes', () => {
    expect(() => departmentSchema.parse({ ...validDept, code: 'Ops' })).toThrow();
    expect(() => departmentSchema.parse({ ...validDept, code: 'has space' })).toThrow();
  });
});
