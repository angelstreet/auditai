import { describe, expect, it } from 'vitest';
import { invitationSchema, invitationStatusSchema, respondentSchema } from './invitation.js';

const ISO = '2026-10-14T19:00:00.000Z';
const LATER = '2026-10-21T19:00:00.000Z';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const ENG = '550e8400-e29b-41d4-a716-446655440001';
const TEAM = '550e8400-e29b-41d4-a716-446655440002';
const INV = '550e8400-e29b-41d4-a716-446655440003';

const baseInvitation = {
  id: INV,
  tenantId: TENANT,
  engagementId: ENG,
  teamId: TEAM,
  respondentPseudonym: 'pilot-employee-001',
  status: 'pending' as const,
  token: {
    reference: 'invitation-pilot-employee-001',
    signature: 'abcdefghijklmnopqrstuvwxyz123456',
  },
  opensAt: ISO,
  expiresAt: LATER,
  openCount: 0,
  submissionId: null,
  createdAt: ISO,
  updatedAt: null,
};

describe('invitationStatusSchema', () => {
  it('exposes the full invitation lifecycle', () => {
    expect([...invitationStatusSchema.options].sort()).toEqual([
      'declined',
      'expired',
      'in_progress',
      'opened',
      'pending',
      'revoked',
      'submitted',
    ]);
  });
});

describe('invitationSchema', () => {
  it('parses a valid invitation', () => {
    const inv = invitationSchema.parse(baseInvitation);
    expect(inv.status).toBe('pending');
    expect(inv.token.signature).toHaveLength(32);
  });

  it('rejects tokens with too-short signatures', () => {
    expect(() =>
      invitationSchema.parse({
        ...baseInvitation,
        token: { reference: 'invitation-pilot-employee-001', signature: 'short' },
      }),
    ).toThrow();
  });

  it('caps the open counter at 1000', () => {
    expect(() => invitationSchema.parse({ ...baseInvitation, openCount: 1001 })).toThrow();
  });
});

describe('respondentSchema', () => {
  const baseRespondent = {
    id: '550e8400-e29b-41d4-a716-446655440099',
    tenantId: TENANT,
    invitationId: INV,
    pseudonym: 'pilot-employee-001',
    preferredLocale: 'fr' as const,
    firstOpenedAt: ISO,
    lastSeenAt: ISO,
    finishedAt: null,
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a valid respondent', () => {
    const r = respondentSchema.parse(baseRespondent);
    expect(r.finishedAt).toBeNull();
  });

  it('only allows fr or en for preferredLocale', () => {
    expect(() => respondentSchema.parse({ ...baseRespondent, preferredLocale: 'de' })).toThrow();
  });
});
