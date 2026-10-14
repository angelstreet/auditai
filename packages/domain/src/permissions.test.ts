import { describe, expect, it } from 'vitest';
import { capabilitiesForRole, roleHasCapability } from './permissions.js';

describe('capabilitiesForRole', () => {
  it('grants auditor individual submission read', () => {
    expect(capabilitiesForRole('auditor')).toContain('submission:read:individual');
  });

  it('does not grant employee_respondent any aggregate read', () => {
    expect(capabilitiesForRole('employee_respondent')).not.toContain('submission:read:aggregate');
  });

  it('refuses manager from seeing individual scores by default', () => {
    expect(capabilitiesForRole('team_manager')).not.toContain('submission:read:individual');
  });

  it('refuses team_referent from creating opportunities', () => {
    expect(capabilitiesForRole('team_referent')).not.toContain('opportunity:write');
  });
});

describe('roleHasCapability', () => {
  it('returns true for granted capability', () => {
    expect(roleHasCapability('auditor', 'opportunity:write')).toBe(true);
  });

  it('returns false for ungranted capability', () => {
    expect(roleHasCapability('auditor', 'tenant:admin')).toBe(false);
  });

  it('throws on unknown roles', () => {
    expect(() => roleHasCapability('superuser', 'tenant:read')).toThrow(/not a recognised role/);
  });
});
