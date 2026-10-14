import { describe, expect, it } from 'vitest';
import {
  engagementStatusLabel,
  listEngagements,
  listTenantIds,
  summariseEngagement,
  tenantLabel,
} from './adminData.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

describe('adminData', () => {
  it('exposes both synthetic tenants', () => {
    expect([...listTenantIds()].sort()).toEqual([TENANT_A, TENANT_B].sort());
  });

  it('returns a tenant label for each tenant', () => {
    expect(tenantLabel(TENANT_A as never)).toBe('Synthetic Co A');
    expect(tenantLabel(TENANT_B as never)).toBe('Synthetic Co B');
  });

  it('only lists engagements belonging to the requested tenant', () => {
    const a = listEngagements(TENANT_A as never);
    const b = listEngagements(TENANT_B as never);
    expect(a.every((s) => s.engagement.tenantId === TENANT_A)).toBe(true);
    expect(b.every((s) => s.engagement.tenantId === TENANT_B)).toBe(true);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('computes completion counts for tenant A', () => {
    const [summary] = listEngagements(TENANT_A as never);
    expect(summary).toBeDefined();
    expect(summary?.invitationsTotal).toBe(8);
    expect(summary?.invitationsSubmitted).toBe(5);
    expect(summary?.invitationsOpened).toBe(1);
    expect(summary?.invitationsPending).toBe(1);
    expect(summary?.invitationsRevokedOrExpired).toBe(1);
    expect(summary?.expectedHeadcount).toBe(12);
    expect(summary?.completionRatio).toBeCloseTo(5 / 12, 5);
  });

  it('computes completion counts for tenant B', () => {
    const [summary] = listEngagements(TENANT_B as never);
    expect(summary).toBeDefined();
    expect(summary?.invitationsTotal).toBe(8);
    expect(summary?.invitationsSubmitted).toBe(3);
    expect(summary?.invitationsOpened).toBe(2);
    expect(summary?.invitationsPending).toBe(2);
    expect(summary?.invitationsRevokedOrExpired).toBe(1);
    expect(summary?.expectedHeadcount).toBe(9);
    expect(summary?.completionRatio).toBeCloseTo(3 / 9, 5);
  });

  it('summariseEngagement throws on an unknown tenant', () => {
    const unknownTenant = '00000000-0000-4000-8000-000000000000';
    expect(() =>
      summariseEngagement(
        unknownTenant as never,
        listEngagements(TENANT_A as never)[0]!.engagement,
      ),
    ).toThrow(/unknown tenant/);
  });

  it('labels every engagement status', () => {
    for (const status of [
      'draft',
      'scheduled',
      'in_field',
      'analysis',
      'review',
      'closed',
      'archived',
    ] as const) {
      expect(engagementStatusLabel(status)).toMatch(/^[A-Z]/);
    }
  });
});
