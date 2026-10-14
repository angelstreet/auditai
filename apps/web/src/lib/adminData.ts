import type {
  Engagement,
  EngagementId,
  EngagementStatus,
  Invitation,
  Organisation,
  TenantId,
} from '@auditai/contracts';

/**
 * Synthetic admin fixtures (M6).
 *
 * The Phase 1 admin page lists engagements with completion counts. M6 ships this against an
 * in-memory snapshot that mirrors the M4 seed (two tenants, two engagements, eight invitations
 * each) so the smoke test can exercise both the row count math and the tenant isolation. Phase 2
 * replaces this with a Postgres-backed query that joins \`engagements\`, \`invitations\` and
 * \`submissions\`.
 */

export interface AdminEngagementSummary {
  readonly engagement: Engagement;
  readonly organisation: Organisation;
  readonly expectedHeadcount: number;
  readonly invitationsTotal: number;
  readonly invitationsSubmitted: number;
  readonly invitationsOpened: number;
  readonly invitationsPending: number;
  readonly invitationsRevokedOrExpired: number;
  readonly completionRatio: number;
}

const ORG_A: Organisation = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as never,
  tenantId: '11111111-1111-4111-8111-111111111111' as TenantId,
  legalName: 'Synthetic Co A s\u00e0rl',
  tradingName: 'Synthetic Co A',
  country: 'FR',
  sector: 'consulting',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: null,
};

const ORG_B: Organisation = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' as never,
  tenantId: '22222222-2222-4222-8222-222222222222' as TenantId,
  legalName: 'Synthetic Co B s\u00e0rl',
  tradingName: 'Synthetic Co B',
  country: 'FR',
  sector: 'consulting',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: null,
};

const SYNTHETIC_PRIVACY = {
  minResponsesForGroupBreakdown: 5,
  managerSeesIndividualMaturity: false,
  benchmarkCandidate: false,
  noticeLocale: 'fr' as const,
};

const ENG_A: Engagement = {
  id: 'a5555555-4555-4555-8555-555555555555' as EngagementId,
  tenantId: ORG_A.tenantId,
  teamIds: ['a2222222-2222-4222-8222-222222222222' as never],
  templateId: 'a3333333-3333-4333-8333-333333333333' as never,
  questionnaireVersionId: 'a4444444-4444-4444-8444-444444444444' as never,
  status: 'in_field',
  opensAt: '2026-10-07T08:00:00.000Z',
  closesAt: '2026-10-21T20:00:00.000Z',
  locale: 'fr',
  privacy: SYNTHETIC_PRIVACY,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-13T12:00:00.000Z',
};

const ENG_B: Engagement = {
  id: 'b5555555-4555-4555-8555-555555555555' as EngagementId,
  tenantId: ORG_B.tenantId,
  teamIds: ['b2222222-2222-4222-8222-222222222222' as never],
  templateId: 'b3333333-3333-4333-8333-333333333333' as never,
  questionnaireVersionId: 'b4444444-4444-4444-8444-444444444444' as never,
  status: 'in_field',
  opensAt: '2026-10-07T08:00:00.000Z',
  closesAt: '2026-10-21T20:00:00.000Z',
  locale: 'fr',
  privacy: SYNTHETIC_PRIVACY,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-13T12:00:00.000Z',
};

const EXPECTED_HEADCOUNT: Record<string, number> = {
  [ENG_A.id]: 12,
  [ENG_B.id]: 9,
};

/**
 * Synthetic invitation fixtures. Tenant A has 8 invitations: 5 submitted, 1 opened, 1 pending,
 * 1 revoked. Tenant B has 8: 3 submitted, 2 opened, 2 pending, 1 expired.
 */
const INVITATIONS: Invitation[] = (() => {
  const make = (
    tenantId: TenantId,
    engagementId: EngagementId,
    pseudonym: string,
    status: Invitation['status'],
  ): Invitation => ({
    id: `00000000-0000-4000-8000-${pseudonym.padEnd(12, '0')}` as never,
    tenantId,
    engagementId,
    teamId: '00000000-0000-4000-8000-000000000001' as never,
    respondentPseudonym: pseudonym,
    status,
    token: { reference: `inv-${pseudonym}`, signature: 'signature-placeholder' },
    opensAt: '2026-10-07T08:00:00.000Z',
    expiresAt: '2026-10-21T20:00:00.000Z',
    openCount: status === 'pending' ? 0 : status === 'opened' ? 1 : 1,
    submissionId: null,
    createdAt: '2026-10-07T08:00:00.000Z',
    updatedAt: null,
  });

  const tenantAPseudos = [
    'a-emp-001',
    'a-emp-002',
    'a-emp-003',
    'a-emp-004',
    'a-emp-005',
    'a-emp-006',
    'a-emp-007',
    'a-emp-008',
  ] as const;
  const tenantAStatuses: Invitation['status'][] = [
    'submitted',
    'submitted',
    'submitted',
    'submitted',
    'submitted',
    'opened',
    'pending',
    'revoked',
  ];

  const tenantBPseudos = [
    'b-emp-001',
    'b-emp-002',
    'b-emp-003',
    'b-emp-004',
    'b-emp-005',
    'b-emp-006',
    'b-emp-007',
    'b-emp-008',
  ] as const;
  const tenantBStatuses: Invitation['status'][] = [
    'submitted',
    'submitted',
    'submitted',
    'opened',
    'opened',
    'pending',
    'pending',
    'expired',
  ];

  const list: Invitation[] = [];
  tenantAPseudos.forEach((p, i) => {
    const status = tenantAStatuses[i] ?? 'pending';
    if (!status) return;
    list.push(make(ORG_A.tenantId, ENG_A.id, p, status));
  });
  tenantBPseudos.forEach((p, i) => {
    const status = tenantBStatuses[i] ?? 'pending';
    if (!status) return;
    list.push(make(ORG_B.tenantId, ENG_B.id, p, status));
  });
  return list;
})();

const ORG_BY_TENANT: Record<string, Organisation> = {
  [ORG_A.tenantId]: ORG_A,
  [ORG_B.tenantId]: ORG_B,
};

const ENG_BY_TENANT: Record<string, Engagement[]> = {
  [ORG_A.tenantId]: [ENG_A],
  [ORG_B.tenantId]: [ENG_B],
};

const INV_BY_TENANT: Record<string, Invitation[]> = {
  [ORG_A.tenantId]: INVITATIONS.filter((i) => i.tenantId === ORG_A.tenantId),
  [ORG_B.tenantId]: INVITATIONS.filter((i) => i.tenantId === ORG_B.tenantId),
};

export const listTenantIds = (): readonly TenantId[] => [ORG_A.tenantId, ORG_B.tenantId];

export const tenantLabel = (tenantId: TenantId): string => {
  const org = ORG_BY_TENANT[tenantId];
  if (!org) return tenantId;
  return org.tradingName ?? org.legalName;
};

export const summariseEngagement = (
  tenantId: TenantId,
  engagement: Engagement,
): AdminEngagementSummary => {
  const invitations = (INV_BY_TENANT[tenantId] ?? []).filter(
    (i) => i.engagementId === engagement.id,
  );
  const total = invitations.length;
  const submitted = invitations.filter((i) => i.status === 'submitted').length;
  const opened = invitations.filter(
    (i) => i.status === 'opened' || i.status === 'in_progress',
  ).length;
  const pending = invitations.filter((i) => i.status === 'pending').length;
  const revokedOrExpired = invitations.filter(
    (i) => i.status === 'revoked' || i.status === 'expired' || i.status === 'declined',
  ).length;
  const expected = EXPECTED_HEADCOUNT[engagement.id] ?? Math.max(total, 1);
  const completionRatio = expected === 0 ? 0 : Math.min(1, submitted / expected);
  const org = ORG_BY_TENANT[tenantId];
  if (!org) throw new Error(`unknown tenant ${tenantId}`);
  return {
    engagement,
    organisation: org,
    expectedHeadcount: expected,
    invitationsTotal: total,
    invitationsSubmitted: submitted,
    invitationsOpened: opened,
    invitationsPending: pending,
    invitationsRevokedOrExpired: revokedOrExpired,
    completionRatio,
  };
};

export const listEngagements = (tenantId: TenantId): AdminEngagementSummary[] => {
  const engagements = ENG_BY_TENANT[tenantId] ?? [];
  return engagements.map((engagement) => summariseEngagement(tenantId, engagement));
};

export const engagementStatusLabel = (status: EngagementStatus): string => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'scheduled':
      return 'Scheduled';
    case 'in_field':
      return 'In field';
    case 'analysis':
      return 'Analysis';
    case 'review':
      return 'Review';
    case 'closed':
      return 'Closed';
    case 'archived':
      return 'Archived';
  }
};
