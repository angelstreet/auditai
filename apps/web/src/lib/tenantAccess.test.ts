import { describe, expect, it } from 'vitest';
import { newSessionPayload } from './session';
import { allowedTenantIds, isTenantAllowed, pickTenant } from './tenantAccess';

const s = newSessionPayload({ id: 'u', name: 'U' }, [
  { id: 'tA', role: 'auditor' },
  { id: 'tC', role: 'team_manager' },
]);

describe('tenant membership checks', () => {
  it('lists only admin-capable tenants', () => {
    expect(allowedTenantIds(s)).toEqual(['tA']);
  });
  it('rejects a tenant the user is not a member of', () => {
    expect(isTenantAllowed(s, 'tA')).toBe(true);
    expect(isTenantAllowed(s, 'tB')).toBe(false);
    expect(isTenantAllowed(s, 'tC')).toBe(false);
  });
  it('pickTenant falls back to the first allowed tenant, never a forged one', () => {
    expect(pickTenant(s, 'tB')).toBe('tA');
    expect(pickTenant(s, undefined)).toBe('tA');
    expect(pickTenant({ ...s, tenants: [] }, 'tA')).toBeNull();
  });
});
