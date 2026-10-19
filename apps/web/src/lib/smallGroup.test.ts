import { beforeEach, describe, expect, it, vi } from 'vitest';

/** TASK-U (ADR 0039): no team mascot or per-team count under the minimum group, in every reader. */
const log = vi.hoisted(() => ({ calls: [] as { sql: string; params: unknown[] }[] }));
vi.mock('@/lib/db', () => ({
  withTenant: async (_t: string, fn: (c: unknown) => unknown) =>
    fn({
      query: async (sql: string, params: unknown[]) => {
        log.calls.push({ sql, params });
        return { rows: [] };
      },
    }),
  withServiceAccount: async () => ({ rows: [] }),
}));

const T = '33333333-3333-4333-8333-333333333333';
beforeEach(() => {
  log.calls = [];
});

describe('small-group guard', () => {
  it('hides a group under 5 and shows one of 5', async () => {
    const { isGroupHidden } = await import('./teamBadgeData');
    expect(isGroupHidden(4)).toBe(true);
    expect(isGroupHidden(0)).toBe(true);
    expect(isGroupHidden(5)).toBe(false);
  });

  it('the badge list asks the database for member_count >= the minimum', async () => {
    const { listTeamBadges, listHiddenTeamIds } = await import('./teamBadgeData');
    await listTeamBadges(T as never);
    await listHiddenTeamIds(T as never);
    const [shown, hidden] = log.calls;
    expect(shown?.sql).toMatch(/member_count >= \$2/);
    expect(shown?.params).toEqual([T, 5]);
    expect(hidden?.sql).toMatch(/member_count < \$2/);
    // The hidden list returns ids only: no tier, no counts.
    expect(hidden?.sql).not.toMatch(/dominant_tier|tortoise/);
  });

  it('the team export applies the same minimum', async () => {
    const src = (await import('node:fs')).readFileSync(
      new URL('./exportData.ts', `file://${__dirname}/`),
      'utf8',
    );
    expect(src).toMatch(/FROM team_badges\s+WHERE tenant_id = \$1 AND member_count >= \$2/);
  });
});
