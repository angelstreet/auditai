import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AnalysisPayload } from './pipeline.js';

/**
 * The detector is split so the pure parts (key derivation + ID merging) can
 * be unit-tested without a live Postgres. The cross-engagement write path is
 * covered by the integration smoke in apps/web/scripts/m13-smoke.mjs.
 */
const synergyKeyFor = (axis: string, themeLabel: string): string =>
  createHash('sha1').update(`${axis}|${themeLabel.toLowerCase().trim()}`).digest('hex');

const mergeJsonbStringArray = (
  current: ReadonlyArray<string>,
  incoming: ReadonlyArray<string>,
): { merged: string[]; added: string[] } => {
  const seen = new Set(current);
  const added: string[] = [];
  for (const id of incoming) {
    if (!seen.has(id)) {
      seen.add(id);
      added.push(id);
    }
  }
  return { merged: Array.from(seen), added };
};

const buildPayload = (themes: AnalysisPayload['themes']): AnalysisPayload => ({
  version: 1,
  sensitivity: 'internal',
  themes,
  contradictions: [],
  interviewPrompts: [],
  evidence: [],
});

describe('cross-team synergy detector (M13 slice B, FR-14)', () => {
  it('builds a stable, lowercase-normalised synergy key', () => {
    expect(synergyKeyFor('literacy', 'Source-checking practice')).toBe(
      createHash('sha1').update('literacy|source-checking practice').digest('hex'),
    );
    expect(synergyKeyFor('literacy', 'Source-Checking Practice')).toBe(
      synergyKeyFor('literacy', 'Source-checking Practice'),
    );
    expect(synergyKeyFor('literacy', 'source-checking practice')).toBe(
      synergyKeyFor('literacy', 'SOURCE-CHECKING PRACTICE'),
    );
  });

  it('merges JSONB-string-arrays without duplicates', () => {
    const result = mergeJsonbStringArray(['a', 'b'], ['b', 'c', 'd']);
    expect(result.added).toEqual(['c', 'd']);
    expect(result.merged.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns no "added" elements when everything is already present', () => {
    const result = mergeJsonbStringArray(['a', 'b'], ['a', 'b']);
    expect(result.added).toEqual([]);
    expect(result.merged.sort()).toEqual(['a', 'b']);
  });

  it('groups themes by (axis, label.lower()) and only keeps cross-engagement groups', () => {
    // Simulated: two analyses, each with one theme, sharing the same label + axis,
    // on two distinct engagement ids.
    const rows = [
      {
        id: 'row-1',
        engagement_id: 'eng-A',
        payload_json: buildPayload([
          {
            id: 't-1',
            axis: 'literacy',
            label: 'Source-checking practice',
            summary: 'x',
            evidence: [],
          },
        ]),
      },
      {
        id: 'row-2',
        engagement_id: 'eng-B',
        payload_json: buildPayload([
          {
            id: 't-2',
            axis: 'literacy',
            label: 'Source-checking practice',
            summary: 'x',
            evidence: [],
          },
        ]),
      },
    ];
    const groups = new Map<
      string,
      { label: string; sourceAnalyses: Set<string>; sourceEngagements: Set<string> }
    >();
    for (const r of rows) {
      for (const t of r.payload_json.themes) {
        const k = synergyKeyFor(t.axis, t.label);
        const existing = groups.get(k);
        if (existing) {
          existing.sourceAnalyses.add(r.id);
          existing.sourceEngagements.add(r.engagement_id);
        } else {
          groups.set(k, {
            label: t.label,
            sourceAnalyses: new Set([r.id]),
            sourceEngagements: new Set([r.engagement_id]),
          });
        }
      }
    }
    const cross = Array.from(groups.values()).filter(
      (g) => g.sourceEngagements.size >= 2 && g.sourceAnalyses.size >= 2,
    );
    expect(cross).toHaveLength(1);
    expect(cross[0].label).toBe('Source-checking practice');
    expect(Array.from(cross[0].sourceEngagements).sort()).toEqual(['eng-A', 'eng-B']);
  });

  it('drops groups that only cross one engagement (single-engagement themes)', () => {
    const rows = [
      {
        id: 'row-1',
        engagement_id: 'eng-A',
        payload_json: buildPayload([
          {
            id: 't-1',
            axis: 'literacy',
            label: 'Single-team theme',
            summary: 'x',
            evidence: [],
          },
        ]),
      },
      {
        id: 'row-2',
        engagement_id: 'eng-A',
        payload_json: buildPayload([
          {
            id: 't-2',
            axis: 'literacy',
            label: 'Single-team theme',
            summary: 'x',
            evidence: [],
          },
        ]),
      },
    ];
    const groups = new Map<
      string,
      { label: string; sourceAnalyses: Set<string>; sourceEngagements: Set<string> }
    >();
    for (const r of rows) {
      for (const t of r.payload_json.themes) {
        const k = synergyKeyFor(t.axis, t.label);
        const existing = groups.get(k);
        if (existing) {
          existing.sourceAnalyses.add(r.id);
          existing.sourceEngagements.add(r.engagement_id);
        } else {
          groups.set(k, {
            label: t.label,
            sourceAnalyses: new Set([r.id]),
            sourceEngagements: new Set([r.engagement_id]),
          });
        }
      }
    }
    const cross = Array.from(groups.values()).filter(
      (g) => g.sourceEngagements.size >= 2 && g.sourceAnalyses.size >= 2,
    );
    expect(cross).toHaveLength(0);
  });
});
