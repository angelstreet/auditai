import { describe, expect, it } from 'vitest';
import { aggregateThemes } from './clientData';
import { parseLinkCount } from './clientActions';

const theme = (label: string, axis = 'practice', summary = 'quote that must never leak') => ({
  id: 't',
  label,
  axis,
  summary,
});

describe('aggregateThemes (only approved, at least five people, no summary)', () => {
  const analyses = (n: number, themes: object[]) =>
    Array.from({ length: n }, (_, i) => ({ submissionId: `s${i}`, payload: { themes } }));

  it('hides a theme raised by fewer than five people', () => {
    expect(aggregateThemes(analyses(4, [theme('Repetitive tasks')]))).toEqual([]);
  });

  it('shows a theme raised by five people, merging case, without the summary', () => {
    const rows = [
      ...analyses(3, [theme('Repetitive tasks')]),
      ...analyses(2, [theme('repetitive TASKS')]).map((a, i) => ({ ...a, submissionId: `x${i}` })),
    ];
    const out = aggregateThemes(rows);
    expect(out).toEqual([{ axis: 'practice', label: 'Repetitive tasks', people: 5 }]);
    expect(JSON.stringify(out)).not.toContain('quote');
  });

  it('counts a person once even if a theme repeats in their analysis', () => {
    const rows = analyses(4, [theme('A'), theme('A')]);
    expect(aggregateThemes(rows)).toEqual([]);
  });

  it('ignores malformed payloads', () => {
    expect(aggregateThemes([{ submissionId: 's', payload: null }])).toEqual([]);
    expect(aggregateThemes([{ submissionId: 's', payload: { themes: 'x' } }])).toEqual([]);
  });
});

describe('parseLinkCount', () => {
  it('accepts 1 to 500 whole numbers only', () => {
    expect(parseLinkCount('5')).toBe(5);
    expect(parseLinkCount(' 500 ')).toBe(500);
    for (const bad of ['0', '501', '2.5', '', 'abc', null, '-1']) {
      expect(parseLinkCount(bad)).toBeNull();
    }
  });
});
