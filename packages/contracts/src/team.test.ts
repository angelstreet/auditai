import { describe, expect, it } from 'vitest';
import { membershipSchema, teamSchema } from './team.js';

const ISO = '2026-10-14T19:00:00.000Z';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const ORG = '550e8400-e29b-41d4-a716-446655440001';
const DEPT = '550e8400-e29b-41d4-a716-446655440002';
const TEAM = '550e8400-e29b-41d4-a716-446655440003';
const USER = '550e8400-e29b-41d4-a716-446655440004';

describe('teamSchema', () => {
  const validTeam = {
    id: TEAM,
    tenantId: TENANT,
    organisationId: ORG,
    departmentId: DEPT,
    name: 'Pilot team',
    description: 'First team we onboard.',
    expectedHeadcount: 12,
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a valid team', () => {
    const t = teamSchema.parse(validTeam);
    expect(t.expectedHeadcount).toBe(12);
  });

  it('rejects negative or oversized headcounts', () => {
    expect(() => teamSchema.parse({ ...validTeam, expectedHeadcount: -1 })).toThrow();
    expect(() => teamSchema.parse({ ...validTeam, expectedHeadcount: 1_000_000 })).toThrow();
  });

  it('allows a null description', () => {
    const t = teamSchema.parse({ ...validTeam, description: null });
    expect(t.description).toBeNull();
  });
});

describe('membershipSchema', () => {
  const validMembership = {
    id: '550e8400-e29b-41d4-a716-446655440099',
    tenantId: TENANT,
    userId: USER,
    teamId: TEAM,
    role: 'team_referent' as const,
    startsAt: ISO,
    endsAt: null,
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a tenant-wide membership (teamId null)', () => {
    const m = membershipSchema.parse({ ...validMembership, teamId: null, role: 'client_sponsor' });
    expect(m.teamId).toBeNull();
    expect(m.role).toBe('client_sponsor');
  });

  it('rejects unknown roles', () => {
    expect(() => membershipSchema.parse({ ...validMembership, role: 'admin' })).toThrow();
  });

  it('accepts the full PRD role list', () => {
    const roles = [
      'platform_owner',
      'client_sponsor',
      'team_manager',
      'team_referent',
      'auditor',
      'security_reviewer',
      'employee_respondent',
    ] as const;
    for (const role of roles) {
      expect(() => membershipSchema.parse({ ...validMembership, role })).not.toThrow();
    }
  });
});
