import { describe, expect, it } from 'vitest';
import { reportSnapshotSchema, type ReportSnapshot } from './report.js';

const base: ReportSnapshot = {
  version: 1,
  locale: 'en',
  title: 'Demo audit',
  organisation: 'Demo Client',
  publishedAt: '2026-10-19T10:00:00.000Z',
  summary: 'Short summary.',
  summaryCitations: ['practice|weekly reporting'],
  readiness: {
    overall: { people: 6, overall: 50, level: 'L2', axes: [] },
    teams: [],
    hiddenTeams: 1,
    weights: { literacy: 1 / 3, practice: 1 / 3, readiness: 1 / 3 },
    minGroupSize: 5,
  },
  findings: [
    { key: 'practice|weekly reporting', axis: 'practice', label: 'Weekly reporting', people: 6 },
  ],
  opportunities: [],
  steps: [],
  risks: [],
  prerequisites: [],
  plan: [],
  methodology: 'Survey and review.',
  minGroupSize: 5,
  catalogueVersion: '2026-10-19.1',
};

describe('report snapshot', () => {
  it('accepts an aggregate snapshot', () => {
    expect(reportSnapshotSchema.parse(base)).toEqual(base);
  });

  it('rejects any extra field, so quotes or answers cannot ride along', () => {
    expect(() => reportSnapshotSchema.parse({ ...base, quotes: ['x'] })).toThrow();
    expect(() =>
      reportSnapshotSchema.parse({
        ...base,
        findings: [{ ...base.findings[0], quote: 'verbatim text' }],
      }),
    ).toThrow();
    expect(() =>
      reportSnapshotSchema.parse({
        ...base,
        readiness: { ...base.readiness, respondents: [{ code: 'r1', score: 40 }] },
      }),
    ).toThrow();
  });
});
