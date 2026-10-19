import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-T (ADR 0038): the set-up actions take the tenant and the actor from the signed session,
 * refuse another organisation, refuse launch and close without the dialog's confirmation, and call
 * the data layer (which writes the audit row) exactly once per accepted action.
 */
const state = vi.hoisted(() => ({
  cookie: '' as string,
  calls: [] as { fn: string; args: unknown[] }[],
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'evolai_session' && state.cookie ? { value: state.cookie } : undefined,
  }),
  headers: () => new Headers({ 'x-evolai-path': '/admin/engagements/new' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock('@/lib/setupData', () => {
  const rec =
    (fn: string, result: unknown = undefined) =>
    async (...args: unknown[]) => {
      state.calls.push({ fn, args });
      return result;
    };
  return {
    createEngagement: rec('createEngagement', '99999999-9999-4999-8999-999999999999'),
    updateEngagement: rec('updateEngagement'),
    changeEngagementStatus: rec('changeEngagementStatus', 'in_field'),
    createTeam: rec('createTeam', 'x'),
    updateTeam: rec('updateTeam'),
  };
});

const MINE = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const ENG = '55555555-5555-4555-8555-555555555555';
const TEAM = '66666666-6666-4666-8666-666666666666';
const USER = '77777777-7777-4777-8777-777777777777';

const fd = (o: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  const { newSessionPayload, signSession } = await import('./session');
  state.cookie = await signSession(
    newSessionPayload({ id: USER, name: 'Auditor' }, [{ id: MINE, role: 'auditor' }]),
  );
});
beforeEach(() => {
  state.calls = [];
});

const idle = { ok: false, code: 'idle' };

describe('set-up actions', () => {
  it('create an engagement for the session tenant, as the session user, then redirect to it', async () => {
    const { createEngagementAction } = await import('@/app/admin/engagements/actions');
    await expect(
      createEngagementAction(
        idle,
        fd({ tenantId: MINE, name: 'Spring audit', locale: 'fr', opensOn: '', closesOn: '' }),
      ),
    ).rejects.toThrow(`redirect:/admin/engagements/99999999-9999-4999-8999-999999999999/settings`);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]?.args.slice(0, 2)).toEqual([MINE, USER]);
  });

  it('refuse another organisation without touching data', async () => {
    const a = await import('@/app/admin/engagements/actions');
    const r = await Promise.all([
      a.createEngagementAction(idle, fd({ tenantId: OTHER, name: 'x', locale: 'fr' })),
      a.updateEngagementAction(
        idle,
        fd({ tenantId: OTHER, engagementId: ENG, name: 'x', locale: 'fr' }),
      ),
      a.changeStatusAction(
        idle,
        fd({ tenantId: OTHER, engagementId: ENG, change: 'launch', confirm: 'yes' }),
      ),
      a.createTeamAction(idle, fd({ tenantId: OTHER, name: 'T', expectedHeadcount: '4' })),
      a.updateTeamAction(
        idle,
        fd({ tenantId: OTHER, teamId: TEAM, name: 'T', expectedHeadcount: '4' }),
      ),
    ]);
    for (const out of r) expect(out).toEqual({ ok: false, code: 'forbidden' });
    expect(state.calls).toEqual([]);
  });

  it('refuse launch and close without the confirmation', async () => {
    const { changeStatusAction } = await import('@/app/admin/engagements/actions');
    const out = await changeStatusAction(
      idle,
      fd({ tenantId: MINE, engagementId: ENG, change: 'launch' }),
    );
    expect(out).toEqual({ ok: false, code: 'confirm_required' });
    expect(state.calls).toEqual([]);
    const ok = await changeStatusAction(
      idle,
      fd({ tenantId: MINE, engagementId: ENG, change: 'close', confirm: 'yes' }),
    );
    expect(ok).toEqual({ ok: true, code: 'closed' });
    expect(state.calls[0]?.fn).toBe('changeEngagementStatus');
    expect(state.calls[0]?.args).toEqual([MINE, USER, ENG, 'close']);
  });

  it('check team name and size before calling the data layer', async () => {
    const a = await import('@/app/admin/engagements/actions');
    expect(
      await a.createTeamAction(idle, fd({ tenantId: MINE, name: ' ', expectedHeadcount: '4' })),
    ).toEqual({
      ok: false,
      code: 'bad_name',
    });
    expect(
      await a.createTeamAction(idle, fd({ tenantId: MINE, name: 'Ops', expectedHeadcount: '-2' })),
    ).toEqual({
      ok: false,
      code: 'bad_size',
    });
    expect(state.calls).toEqual([]);
    expect(
      await a.updateTeamAction(
        idle,
        fd({ tenantId: MINE, teamId: TEAM, name: 'Équipe pilote', expectedHeadcount: '12' }),
      ),
    ).toEqual({
      ok: true,
      code: 'team_saved',
    });
    expect(state.calls[0]?.args).toEqual([
      MINE,
      USER,
      TEAM,
      { name: 'Équipe pilote', expectedHeadcount: 12 },
    ]);
  });
});
