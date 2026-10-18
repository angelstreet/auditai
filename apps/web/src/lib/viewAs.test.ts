import { describe, expect, it } from 'vitest';
import {
  isValidViewAs,
  newSessionPayload,
  remainingMaxAge,
  signSession,
  verifySession,
  withViewAs,
  type ViewAs,
} from './session';
import {
  allowedTenantIds,
  canViewAs,
  effectiveContext,
  isTenantAllowed,
  ownedTenantIds,
  pickTenant,
} from './tenantAccess';

/** TASK-P (ADR 0035): the view-as state is signed, re-validated and closes the staff surface. */
const SECRET = 'unit-test-secret-0123456789';
const T_OWNED = '33333333-3333-4333-8333-333333333333';
const T_OTHER = '11111111-1111-4111-8111-111111111111';
const TEAM = 'c2222222-2222-4222-8222-222222222222';
const PERSONA = 'c9999999-9999-4999-8999-999999999999';

const owner = newSessionPayload(
  { id: 'owner', name: 'Owner' },
  [
    { id: T_OTHER, role: 'auditor' },
    { id: T_OWNED, role: 'auditor' },
    { id: T_OWNED, role: 'platform_owner' },
  ],
  1000,
);
const auditor = newSessionPayload(
  { id: 'aud', name: 'Aud' },
  [{ id: T_OWNED, role: 'auditor' }],
  1000,
);
const referent = newSessionPayload(
  { id: 'ref', name: 'Ref' },
  [{ id: T_OWNED, role: 'team_referent', teamId: TEAM }],
  1000,
);
const viewAs: ViewAs = {
  role: 'team_referent',
  tenantId: T_OWNED,
  teamId: TEAM,
  personaId: PERSONA,
  label: 'Sam Synthetic',
  tenantLabel: 'Synthetic client C',
  teamLabel: 'Synthetic pilot team',
};

/** Re-sign an arbitrary payload, as an attacker who somehow held the secret's output would. */
const forge = (p: object) => signSession(p as never, SECRET);

describe('view-as in the signed session', () => {
  it('round-trips for a platform owner and keeps the sign-in expiry', async () => {
    const next = withViewAs(owner, viewAs);
    expect(next.exp).toBe(owner.exp);
    expect(next.iat).toBe(owner.iat);
    const verified = await verifySession(await signSession(next, SECRET), SECRET, 1001);
    expect(verified?.viewAs).toEqual(viewAs);
  });

  it('expires with the session', async () => {
    const token = await signSession(withViewAs(owner, viewAs), SECRET);
    expect(await verifySession(token, SECRET, owner.exp)).toBeNull();
    expect(remainingMaxAge(owner, owner.exp - 10)).toBe(10);
    expect(remainingMaxAge(owner, owner.exp + 10)).toBe(0);
  });

  it('rejects a cookie whose viewAs was edited client-side (signature)', async () => {
    const token = await signSession(owner, SECRET);
    const [body, sig] = token.split('.') as [string, string];
    const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    json.viewAs = viewAs;
    const tampered = `${Buffer.from(JSON.stringify(json)).toString('base64url')}.${sig}`;
    expect(await verifySession(tampered, SECRET, 1001)).toBeNull();
  });

  it('rejects a correctly signed viewAs for a non-owner (auditor, referent)', async () => {
    expect(await verifySession(await forge({ ...auditor, viewAs }), SECRET, 1001)).toBeNull();
    expect(await verifySession(await forge({ ...referent, viewAs }), SECRET, 1001)).toBeNull();
  });

  it('rejects a viewAs on a tenant the owner does not own, or with a bad shape', async () => {
    const other = { ...viewAs, tenantId: T_OTHER };
    expect(await verifySession(await forge({ ...owner, viewAs: other }), SECRET, 1001)).toBeNull();
    for (const bad of [
      { ...viewAs, role: 'auditor' },
      { ...viewAs, role: 'platform_owner' },
      { ...viewAs, teamId: 'not-a-uuid' },
      { ...viewAs, label: 'x'.repeat(201) },
      'string',
      null,
    ]) {
      expect(isValidViewAs(bad, owner.tenants)).toBe(false);
      expect(await verifySession(await forge({ ...owner, viewAs: bad }), SECRET, 1001)).toBeNull();
    }
  });

  it('clearing viewAs restores the plain owner session', () => {
    expect(withViewAs(withViewAs(owner, viewAs), null)).toEqual(owner);
  });
});

describe('effective context', () => {
  it('owner on their own view is staff, tenants listed once', () => {
    expect(allowedTenantIds(owner)).toEqual([T_OTHER, T_OWNED]);
    expect(effectiveContext(owner)).toEqual({ kind: 'staff', tenantIds: [T_OTHER, T_OWNED] });
    expect(canViewAs(owner)).toBe(true);
    expect(ownedTenantIds(owner)).toEqual([T_OWNED]);
  });

  it('while viewing as, the staff surface is closed and the context is read only', () => {
    const s = withViewAs(owner, viewAs);
    expect(allowedTenantIds(s)).toEqual([]);
    expect(isTenantAllowed(s, T_OWNED)).toBe(false);
    expect(isTenantAllowed(s, T_OTHER)).toBe(false);
    expect(pickTenant(s, T_OWNED)).toBeNull();
    expect(canViewAs(s)).toBe(false);
    expect(effectiveContext(s)).toEqual({
      kind: 'client',
      role: 'team_referent',
      tenantId: T_OWNED,
      teamIds: [TEAM],
      readOnly: true,
      viewAs,
    });
  });

  it('a real referent gets their own tenant and team, may act, may not view as', () => {
    expect(effectiveContext(referent)).toEqual({
      kind: 'client',
      role: 'team_referent',
      tenantId: T_OWNED,
      teamIds: [TEAM],
      readOnly: false,
      viewAs: null,
    });
    expect(allowedTenantIds(referent)).toEqual([]);
    expect(canViewAs(referent)).toBe(false);
    expect(canViewAs(auditor)).toBe(false);
  });

  it('a referent membership without a team gives no surface', () => {
    const s = newSessionPayload({ id: 'x', name: 'X' }, [{ id: T_OWNED, role: 'team_referent' }]);
    expect(effectiveContext(s)).toEqual({ kind: 'none' });
  });
});
