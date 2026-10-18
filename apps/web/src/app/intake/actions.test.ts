import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newSessionPayload, type SessionPayload } from '@/lib/session';
import { allowedTenantIds, isTenantAllowed, pickTenant } from '@/lib/tenantAccess';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const state = vi.hoisted(() => ({ session: null as unknown, created: [] as string[] }));

vi.mock('@/lib/i18n', () => ({ getT: () => ({ t: (k: string) => k }) }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/viewAsGuard', () => ({ viewAsRefusal: async () => null }));
vi.mock('@/lib/sponsorBriefData', () => ({
  createSponsorBrief: async (tenantId: string) => {
    state.created.push(tenantId);
    return { id: 'brief' };
  },
}));
vi.mock('@/lib/authServer', async () => {
  const access = await import('@/lib/tenantAccess');
  return {
    getSession: async () => state.session,
    resolveActor: async (tenantId: string) =>
      state.session && access.isTenantAllowed(state.session as SessionPayload, tenantId)
        ? { ok: true, actor: 'u', tenantId }
        : { ok: false, message: 'not a member' },
  };
});

const form = (extra: Record<string, string> = {}): FormData => {
  const fd = new FormData();
  fd.set('topPriorityWorkflow', 'Invoice triage');
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
};

const staffA = newSessionPayload({ id: 'u', name: 'U' }, [{ id: A, role: 'auditor' }]);

beforeEach(() => {
  state.created = [];
  state.session = staffA;
});

describe('intake tenant scoping (ADR 0037)', () => {
  it('writes to the session tenant and ignores a forged tenantId in the form', async () => {
    const { saveSponsorBriefAction } = await import('./actions');
    await saveSponsorBriefAction({ ok: false, message: '' }, form({ tenantId: B }));
    expect(state.created).toEqual([A]);
  });

  it('refuses a request without a session', async () => {
    state.session = null;
    const { saveSponsorBriefAction } = await import('./actions');
    const out = await saveSponsorBriefAction({ ok: false, message: '' }, form({ tenantId: A }));
    expect(out.ok).toBe(false);
    expect(state.created).toEqual([]);
  });

  it('refuses a session with no admin-capable tenant', async () => {
    state.session = newSessionPayload({ id: 'r', name: 'R' }, [
      { id: A, role: 'team_referent', teamId: 't' },
    ]);
    const { saveSponsorBriefAction } = await import('./actions');
    const out = await saveSponsorBriefAction({ ok: false, message: '' }, form());
    expect(out.ok).toBe(false);
    expect(state.created).toEqual([]);
  });
});

describe('the intake tenant picker', () => {
  it('a tenant-A user never resolves to tenant B, whatever is requested', () => {
    expect(pickTenant(staffA, undefined)).toBe(A);
    expect(pickTenant(staffA, B)).toBe(A);
    expect(isTenantAllowed(staffA, B)).toBe(false);
  });
  it('a tenant-B user never resolves to tenant A', () => {
    const staffB = newSessionPayload({ id: 'b', name: 'B' }, [{ id: B, role: 'auditor' }]);
    expect(pickTenant(staffB, A)).toBe(B);
    expect(allowedTenantIds(staffB)).toEqual([B]);
  });
});
