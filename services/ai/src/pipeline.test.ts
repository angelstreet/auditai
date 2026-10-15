import { describe, it, expect } from 'vitest';
import {
  classifySensitivity,
  extractThemes,
  findContradictions,
  buildInterviewPrompts,
  runPipeline,
  type PipelineInput,
  type QuestionItemRow,
  type AnswerRow,
  type SubmissionRow,
} from './pipeline.js';

const q = (id: string, sensitivity: 'public' | 'internal' | 'sensitive'): QuestionItemRow => ({
  id,
  axis: 'literacy',
  code: id,
  kind: 'scenario_choice',
  locale: 'fr',
  prompt: id,
  options_json: [
    { value: 'low', label: 'low' },
    { value: 'high', label: 'high' },
  ],
  scoring_json: { weight: 1, reverse: false },
  sensitivity,
});

const sub: SubmissionRow = {
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '00000000-0000-0000-0000-0000000000aa',
  engagement_id: '00000000-0000-0000-0000-0000000000bb',
  invitation_id: '00000000-0000-0000-0000-0000000000cc',
  status: 'submitted',
  locale: 'fr',
  started_at: '2026-10-15T00:00:00Z',
  submitted_at: '2026-10-15T00:05:00Z',
};

const a = (
  questionItemId: string,
  value: string,
  sequence: number,
  id = `${questionItemId}-a`,
): AnswerRow => ({
  id,
  question_item_id: questionItemId,
  value_json: value,
  sequence,
});

describe('classifySensitivity', () => {
  it('escalates to the most-restrictive sensitivity across items', () => {
    expect(classifySensitivity([q('a', 'public'), q('b', 'internal')])).toBe('internal');
    expect(classifySensitivity([q('a', 'internal'), q('b', 'sensitive')])).toBe('sensitive');
    expect(classifySensitivity([])).toBe('public');
  });
});

describe('extractThemes', () => {
  it('groups answers by axis and counts high vs low', () => {
    const items = new Map([
      ['q1', { ...q('q1', 'internal'), axis: 'literacy' }],
      ['q2', { ...q('q2', 'internal'), axis: 'context' }],
    ]);
    const input: PipelineInput = {
      submission: sub,
      answers: [a('q1', 'high', 0), a('q2', 'low', 1)],
      questionItems: items,
    };
    const themes = extractThemes(input);
    expect(themes).toHaveLength(2);
    const lit = themes.find((t) => t.axis === 'literacy')!;
    expect(lit.evidence).toHaveLength(1);
    expect(lit.summary).toMatch(/1 high-maturity/);
  });
});

describe('findContradictions', () => {
  it('returns nothing when an axis is uniformly high or low', () => {
    const themes = [
      {
        id: 't1',
        label: 'literacy',
        axis: 'literacy',
        summary: 'all high',
        evidence: [
          { claim: 'a \u2192 high', sourceKind: 'answer' as const, sourceId: 'x', quote: 'high' },
        ],
      },
    ];
    expect(findContradictions(themes)).toEqual([]);
  });

  it('flags a mixed-signal axis', () => {
    const themes = [
      {
        id: 't1',
        label: 'literacy',
        axis: 'literacy',
        summary: 'mixed',
        evidence: [
          { claim: 'a \u2192 high', sourceKind: 'answer' as const, sourceId: 'x', quote: 'high' },
          {
            claim: 'b \u2192 use_as_is',
            sourceKind: 'answer' as const,
            sourceId: 'y',
            quote: 'low',
          },
        ],
      },
    ];
    expect(findContradictions(themes)).toHaveLength(1);
  });
});

describe('buildInterviewPrompts', () => {
  it('targets the lowest-evidence axis', () => {
    const themes = [
      {
        id: 't1',
        label: 'literacy',
        axis: 'literacy',
        summary: 'a',
        evidence: new Array(3).fill(0).map((_, i) => ({
          claim: `${i}`,
          sourceKind: 'answer' as const,
          sourceId: `${i}`,
          quote: 'x',
        })),
      },
      {
        id: 't2',
        label: 'context',
        axis: 'context',
        summary: 'a',
        evidence: [{ claim: '0', sourceKind: 'answer' as const, sourceId: '0', quote: 'x' }],
      },
    ];
    const prompts = buildInterviewPrompts(themes);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]?.themeId).toBe('t2');
  });

  it('returns no prompts when there are no themes', () => {
    expect(buildInterviewPrompts([])).toEqual([]);
  });
});

describe('runPipeline', () => {
  it('returns a complete AnalysisPayload with all four steps', () => {
    const items = new Map([
      ['q1', { ...q('q1', 'internal'), axis: 'literacy' }],
      ['q2', { ...q('q2', 'internal'), axis: 'literacy' }],
    ]);
    const input: PipelineInput = {
      submission: sub,
      answers: [a('q1', 'high', 0), a('q2', 'use_as_is', 1)],
      questionItems: items,
    };
    const out = runPipeline(input);
    expect(out.version).toBe(1);
    expect(out.sensitivity).toBe('internal');
    expect(out.themes).toHaveLength(1);
    expect(out.themes[0]?.evidence).toHaveLength(2);
    expect(out.contradictions).toHaveLength(1);
    expect(out.interviewPrompts.length).toBeGreaterThan(0);
    expect(out.evidence).toHaveLength(2);
  });
});
