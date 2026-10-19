import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  defaultHorizon,
  impactLevelFromScore,
  quadrantFor,
  rankOpportunities,
  uniqueLines,
} from './reportPlan.js';

const checkpoints = {
  d30: { text: 'Check first use', owner: 'Sponsor' },
  d60: { text: 'Measure early results', owner: 'Sponsor' },
  d90: { text: 'Keep, adapt or stop', owner: 'Sponsor' },
};

describe('report plan', () => {
  it('maps impact scores and quadrants', () => {
    expect(impactLevelFromScore(0.1)).toBe('low');
    expect(impactLevelFromScore(0.5)).toBe('medium');
    expect(impactLevelFromScore(0.9)).toBe('high');
    expect(quadrantFor('high', 'low')).toBe('quick_win');
    expect(quadrantFor('medium', 'high')).toBe('big_bet');
    expect(quadrantFor('low', 'low')).toBe('fill_in');
    expect(quadrantFor('low', 'medium')).toBe('reconsider');
  });

  it('times steps by effort, and a high risk waits one horizon', () => {
    expect(defaultHorizon('low', 'low')).toBe('d30');
    expect(defaultHorizon('low', 'high')).toBe('d60');
    expect(defaultHorizon('medium', 'medium')).toBe('d60');
    expect(defaultHorizon('high', 'high')).toBe('d90');
  });

  it('ranks by 2 x impact - effort, keeping input order on ties', () => {
    const ranked = rankOpportunities([
      {
        id: 'a',
        title: 'A',
        axis: null,
        impactScore: null,
        steps: [{ impact: 'low', effort: 'high' }],
      },
      {
        id: 'b',
        title: 'B',
        axis: null,
        impactScore: 0.9,
        steps: [{ impact: 'low', effort: 'low' }],
      },
      { id: 'c', title: 'C', axis: null, impactScore: null, steps: [] },
      { id: 'd', title: 'D', axis: null, impactScore: null, steps: [] },
    ]);
    expect(ranked.map((r) => [r.id, r.rank, r.quadrant])).toEqual([
      ['b', 1, 'quick_win'],
      ['c', 2, 'big_bet'],
      ['d', 3, 'big_bet'],
      ['a', 4, 'reconsider'],
    ]);
  });

  it('takes the highest step impact and the lowest step effort', () => {
    const [r] = rankOpportunities([
      {
        id: 'x',
        title: 'X',
        axis: 'practice',
        impactScore: null,
        steps: [
          { impact: 'medium', effort: 'high' },
          { impact: 'high', effort: 'medium' },
        ],
      },
    ]);
    expect(r).toMatchObject({
      impact: 'high',
      effort: 'medium',
      quadrant: 'big_bet',
      axis: 'practice',
    });
  });

  it('builds the 30/60/90 plan from accepted steps plus one checkpoint per horizon', () => {
    const plan = buildPlan(
      [
        { id: '1', title: 'Rules for AI', owner: 'Security', horizon: 'd30' },
        { id: '2', title: 'Automate report', owner: 'Data', horizon: 'd90' },
      ],
      checkpoints,
    );
    expect(plan.map((p) => [p.horizon, p.text])).toEqual([
      ['d30', 'Rules for AI'],
      ['d30', 'Check first use'],
      ['d60', 'Measure early results'],
      ['d90', 'Automate report'],
      ['d90', 'Keep, adapt or stop'],
    ]);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  it('deduplicates lines case-insensitively', () => {
    expect(uniqueLines([' An approved tool', 'an approved tool', '', 'IT agrees'])).toEqual([
      'An approved tool',
      'IT agrees',
    ]);
  });
});
