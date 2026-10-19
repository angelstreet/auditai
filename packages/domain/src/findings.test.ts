import { describe, expect, it } from 'vitest';
import { aggregateFindings, findingKey } from './findings.js';

const a = (submissionId: string, ...labels: Array<[string, string]>) => ({
  submissionId,
  payload: {
    themes: labels.map(([axis, label]) => ({ axis, label, summary: 'x', quote: 'secret' })),
  },
});

describe('findings', () => {
  it('keeps themes raised by at least the minimum, counted once per person, labels only', () => {
    const rows = [
      ...['s1', 's2', 's3', 's4', 's5'].map((s) => a(s, ['practice', 'Weekly report'])),
      a('s1', ['practice', 'weekly report ']),
      a('s6', ['literacy', 'Rare theme']),
      { submissionId: 's7', payload: null },
      { submissionId: 's8', payload: { themes: [{ label: '' }, { axis: 3, label: 'No axis' }] } },
    ];
    const out = aggregateFindings(rows, 5);
    expect(out).toEqual([{ axis: 'practice', label: 'Weekly report', people: 5 }]);
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(aggregateFindings(rows, 1).map((f) => f.label)).toContain('No axis');
  });

  it('builds a stable, case-insensitive key', () => {
    expect(findingKey('practice', ' Weekly Report ')).toBe('practice|weekly report');
    expect(findingKey('x', 'y'.repeat(400))).toHaveLength(240);
  });
});
