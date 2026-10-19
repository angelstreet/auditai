import { beforeEach, describe, expect, it, vi } from 'vitest';

/** TASK-T (ADR 0038): the data layer scopes every query to the tenant and writes one audit row. */
const state = vi.hoisted(() => ({
  log: [] as { sql: string; params: unknown[] }[],
  status: 'draft',
  teams: 1,
  rows: {} as Record<string, unknown[]>,
}));

vi.mock('@/lib/db', () => {
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      state.log.push({ sql, params });
      if (/FROM engagements WHERE tenant_id = \$1 AND id = \$2 FOR UPDATE/.test(sql)) {
        return { rows: [{ status: state.status, privacy_json: {} }], rowCount: 1 };
      }
      if (/count\(\*\) AS n FROM engagement_teams/.test(sql)) {
        return { rows: [{ n: String(state.teams) }], rowCount: 1 };
      }
      if (/FROM engagements\s+WHERE tenant_id = \$1 ORDER BY created_at DESC/.test(sql)) {
        return {
          rows: [
            {
              template_id: 'tpl',
              questionnaire_version_id: 'qv',
              privacy_json: { minResponsesForGroupBreakdown: 5 },
            },
          ],
          rowCount: 1,
        };
      }
      if (/FROM organisations/.test(sql)) return { rows: [{ id: 'org' }], rowCount: 1 };
      if (/FROM departments/.test(sql)) return { rows: [{ id: 'dep' }], rowCount: 1 };
      if (/UPDATE teams/.test(sql)) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  return { withTenant: async (_t: string, fn: (c: typeof client) => unknown) => fn(client) };
});

const T = '33333333-3333-4333-8333-333333333333';
const U = '77777777-7777-4777-8777-777777777777';
const E = '55555555-5555-4555-8555-555555555555';

const audits = () =>
  state.log.filter((q) => /INSERT INTO audit_log/.test(q.sql)).map((q) => q.params.slice(0, 5));

beforeEach(() => {
  state.log = [];
  state.status = 'draft';
  state.teams = 1;
});

describe('setupData', () => {
  it('creates a draft engagement from the latest questionnaire and audits it', async () => {
    const { createEngagement } = await import('./setupData');
    const id = await createEngagement(T as never, U as never, {
      name: 'Spring audit',
      locale: 'fr',
      opensOn: '2026-10-19',
      closesOn: '2026-11-02',
      teamIds: [],
    });
    const insert = state.log.find((q) => /INSERT INTO engagements/.test(q.sql));
    expect(insert?.params[1]).toBe(T);
    expect(insert?.params).toContain('tpl');
    expect(insert?.params).toContain('2026-11-02T23:59:59.000Z');
    expect(audits()).toEqual([[T, U, 'engagement.create', 'engagement', id]]);
  });

  it('launches a draft with teams, and refuses without teams', async () => {
    const { changeEngagementStatus } = await import('./setupData');
    expect(await changeEngagementStatus(T as never, U as never, E, 'launch')).toBe('in_field');
    expect(audits()).toEqual([[T, U, 'engagement.launch', 'engagement', E]]);
    state.log = [];
    state.teams = 0;
    await expect(changeEngagementStatus(T as never, U as never, E, 'launch')).rejects.toMatchObject(
      {
        code: 'no_teams',
      },
    );
    expect(audits()).toEqual([]);
  });

  it('closes only a live engagement', async () => {
    const { changeEngagementStatus } = await import('./setupData');
    await expect(changeEngagementStatus(T as never, U as never, E, 'close')).rejects.toMatchObject({
      code: 'bad_status',
    });
    state.status = 'in_field';
    expect(await changeEngagementStatus(T as never, U as never, E, 'close')).toBe('closed');
  });

  it('does not edit a closed engagement', async () => {
    const { updateEngagement } = await import('./setupData');
    state.status = 'closed';
    await expect(
      updateEngagement(T as never, U as never, E, {
        name: 'x',
        locale: 'en',
        opensOn: null,
        closesOn: null,
        teamIds: [],
      }),
    ).rejects.toMatchObject({ code: 'bad_status' });
    expect(audits()).toEqual([]);
  });

  it('creates and renames teams inside the tenant, with an audit row each', async () => {
    const { createTeam, updateTeam } = await import('./setupData');
    const id = await createTeam(T as never, U as never, { name: ' Ops ', expectedHeadcount: 12 });
    const insert = state.log.find((q) => /INSERT INTO teams/.test(q.sql));
    expect(insert?.params.slice(1)).toEqual([T, 'org', 'dep', 'Ops', 12]);
    await updateTeam(T as never, U as never, id, { name: 'Équipe pilote', expectedHeadcount: 3 });
    const update = state.log.find((q) => /UPDATE teams/.test(q.sql));
    expect(update?.params).toEqual([T, id, 'Équipe pilote', 3]);
    expect(audits().map((a) => a[2])).toEqual(['team.create', 'team.update']);
    await expect(
      createTeam(T as never, U as never, { name: 'x', expectedHeadcount: 20000 }),
    ).rejects.toMatchObject({ code: 'bad_size' });
  });
});
