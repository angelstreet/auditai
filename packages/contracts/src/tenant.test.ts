import { describe, expect, it } from 'vitest';
import { tenantPlanSchema, tenantSchema } from './tenant.js';

const ISO = '2026-10-14T19:00:00.000Z';
const BASE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  slug: 'pilot-tenant',
  displayName: 'Pilot tenant',
  plan: 'self_hosted' as const,
  dataRegion: 'EU',
  retentionDays: 365,
};

describe('tenantSchema', () => {
  it('parses a valid tenant', () => {
    const t = tenantSchema.parse({ ...BASE, createdAt: ISO, updatedAt: null });
    expect(t.slug).toBe('pilot-tenant');
    expect(t.retentionDays).toBe(365);
  });

  it('rejects uppercase slugs', () => {
    expect(() =>
      tenantSchema.parse({ ...BASE, slug: 'Bad-Slug', createdAt: ISO, updatedAt: null }),
    ).toThrow();
  });

  it('rejects negative or absurd retention days', () => {
    expect(() =>
      tenantSchema.parse({ ...BASE, retentionDays: 0, createdAt: ISO, updatedAt: null }),
    ).toThrow();
    expect(() =>
      tenantSchema.parse({ ...BASE, retentionDays: 9999, createdAt: ISO, updatedAt: null }),
    ).toThrow();
  });

  it('allows a null retentionDays for "no auto delete"', () => {
    const t = tenantSchema.parse({ ...BASE, retentionDays: null, createdAt: ISO, updatedAt: null });
    expect(t.retentionDays).toBeNull();
  });

  it('recognises the three deployment plans', () => {
    expect(tenantPlanSchema.parse('self_hosted')).toBe('self_hosted');
    expect(tenantPlanSchema.parse('consultant_managed')).toBe('consultant_managed');
    expect(tenantPlanSchema.parse('shared_hosted')).toBe('shared_hosted');
    expect(() => tenantPlanSchema.parse('unknown')).toThrow();
  });

  it('requires a timezone offset on the createdAt timestamp', () => {
    expect(() =>
      tenantSchema.parse({ ...BASE, createdAt: '2026-10-14T19:00:00', updatedAt: null }),
    ).toThrow();
  });
});
