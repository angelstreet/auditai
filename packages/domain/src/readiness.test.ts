import { describe, expect, it } from 'vitest';
import { computeReadiness, levelFor, READINESS_THRESHOLDS } from './readiness.js';

const names = new Map([
  ['a', 'Team A'],
  ['b', 'Team B'],
  ['c', 'Team C'],
]);
const sub = (teamId: string, literacy?: number, practice?: number, readiness?: number) => ({
  teamId,
  axes: { literacy, practice, readiness },
});

describe('readiness score', () => {
  it('maps scores to levels at the documented thresholds', () => {
    expect(levelFor(0)).toBe('L0');
    expect(levelFor(14)).toBe('L0');
    expect(levelFor(15)).toBe('L1');
    expect(levelFor(54)).toBe('L2');
    expect(levelFor(55)).toBe('L3');
    expect(levelFor(84)).toBe('L4');
    expect(levelFor(100)).toBe('L5');
    expect(READINESS_THRESHOLDS.map((t) => t.from)).toEqual([0, 15, 35, 55, 70, 85]);
  });

  it('averages each axis and weights the axes equally', () => {
    const subs = Array.from({ length: 5 }, () => sub('a', 0.6, 0.3, 0.9));
    const r = computeReadiness(subs, names, 5);
    expect(r.overall?.people).toBe(5);
    expect(r.overall?.axes.map((a) => a.score)).toEqual([60, 30, 90]);
    expect(r.overall?.overall).toBe(60);
    expect(r.overall?.level).toBe('L3');
  });

  it('leaves an axis without answers out and scales the other weights', () => {
    const subs = Array.from({ length: 5 }, () => sub('a', 0.4, 0.8));
    const r = computeReadiness(subs, names, 5);
    expect(r.overall?.axes.find((a) => a.axis === 'readiness')?.score).toBeNull();
    expect(r.overall?.overall).toBe(60);
  });

  it('hides every group under the minimum and reports only a count', () => {
    const subs = [...Array.from({ length: 4 }, () => sub('a', 1, 1, 1))];
    const r = computeReadiness(subs, names, 5);
    expect(r.overall).toBeNull();
    expect(r.teams).toEqual([]);
    expect(r.hiddenTeams).toBe(1);
  });

  it('never lets overall minus visible teams reveal a small hidden team', () => {
    // A: 6 people, B: 5 people, C: 2 people. Showing A and B next to the overall (13) would
    // expose C's average by subtraction, so the smallest visible team is hidden too.
    const subs = [
      ...Array.from({ length: 6 }, () => sub('a', 0.5, 0.5, 0.5)),
      ...Array.from({ length: 5 }, () => sub('b', 0.7, 0.7, 0.7)),
      ...Array.from({ length: 2 }, () => sub('c', 0.1, 0.1, 0.1)),
    ];
    const r = computeReadiness(subs, names, 5);
    expect(r.overall?.people).toBe(13);
    expect(r.teams.map((t) => t.team)).toEqual(['Team A']);
    expect(r.hiddenTeams).toBe(2);
    const shown = r.teams.reduce((s, t) => s + t.people, 0);
    expect(13 - shown).toBeGreaterThanOrEqual(5);
  });

  it('shows teams at or above the minimum when nothing small is hidden', () => {
    const subs = [
      ...Array.from({ length: 5 }, () => sub('a', 0.2, 0.2, 0.2)),
      ...Array.from({ length: 7 }, () => sub('b', 0.9, 0.9, 0.9)),
    ];
    const r = computeReadiness(subs, names, 5);
    expect(r.teams.map((t) => [t.team, t.people, t.overall])).toEqual([
      ['Team A', 5, 20],
      ['Team B', 7, 90],
    ]);
    expect(r.hiddenTeams).toBe(0);
  });

  it('returns aggregates only: no per-person values anywhere in the output', () => {
    const own = [0.11, 0.23, 0.37, 0.41, 0.59, 0.67];
    const subs = own.map((v) => sub('a', v, 0.5, 0.5));
    const r = computeReadiness(subs, names, 5);
    const json = JSON.stringify(r);
    for (const v of own) expect(json).not.toContain(`"score":${Math.round(v * 100)},`);
    expect(Object.keys(r).sort()).toEqual([
      'hiddenTeams',
      'minGroupSize',
      'overall',
      'teams',
      'weights',
    ]);
  });

  it('clamps out-of-range and ignores non-finite inputs', () => {
    const subs = [
      ...Array.from({ length: 4 }, () => sub('a', 2, Number.NaN, -1)),
      sub('a', 0, 0.5, 0),
    ];
    const r = computeReadiness(subs, names, 5);
    expect(r.overall?.axes.map((a) => a.score)).toEqual([80, 50, 0]);
  });
});
