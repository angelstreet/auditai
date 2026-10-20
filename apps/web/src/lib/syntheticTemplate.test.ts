import { describe, expect, it } from 'vitest';
import { isAllowedInput, parseAnswerValue } from './answerParser';
import {
  FREE_TEXT_MAX_LENGTH,
  SYNTHETIC_QUESTIONS,
  questionByIndex,
  surveyEstimatedMinutes,
  totalQuestionCount,
} from './syntheticTemplate';

describe('survey template (questionnaire v1)', () => {
  it('has ten questions in a fixed order: six choices, three free-text, one role', () => {
    expect(totalQuestionCount()).toBe(10);
    expect(SYNTHETIC_QUESTIONS.map((q) => q.kind)).toEqual([
      ...Array<string>(6).fill('scenario_choice'),
      ...Array<string>(3).fill('short_text'),
      'single_choice',
    ]);
    expect(surveyEstimatedMinutes()).toBeGreaterThanOrEqual(6);
    expect(surveyEstimatedMinutes()).toBeLessThanOrEqual(8);
  });

  it('has French and English text for every question', () => {
    for (const q of SYNTHETIC_QUESTIONS) {
      expect(q.prompt.fr).not.toBe(q.prompt.en);
      for (const o of q.options) expect(o.label.fr.length).toBeGreaterThan(0);
    }
  });

  it('throws for an index outside the survey', () => {
    expect(() => questionByIndex(10)).toThrow();
  });
});

describe('parseAnswerValue', () => {
  it('stores a choice by kind', () => {
    expect(parseAnswerValue('scenario_choice', 'unsure')).toEqual({
      kind: 'scenario_choice',
      choice: 'unsure',
      rationale: null,
    });
    expect(parseAnswerValue('single_choice', 'other')).toEqual({
      kind: 'single_choice',
      choice: 'other',
    });
  });

  it('stores trimmed free text and refuses empty or over-long text', () => {
    expect(parseAnswerValue('short_text', '  à la main  ')).toEqual({
      kind: 'short_text',
      text: 'à la main',
    });
    expect(() => parseAnswerValue('short_text', '   ')).toThrow();
    expect(() => parseAnswerValue('short_text', 'x'.repeat(FREE_TEXT_MAX_LENGTH + 1))).toThrow();
    expect(parseAnswerValue('short_text', 'x'.repeat(FREE_TEXT_MAX_LENGTH))).toMatchObject({
      kind: 'short_text',
    });
  });
});

describe('isAllowedInput', () => {
  it('accepts only the question’s own option values for a choice', () => {
    expect(isAllowedInput(questionByIndex(0), 'check_source')).toBe(true);
    expect(isAllowedInput(questionByIndex(0), 'verify_source')).toBe(false);
    expect(isAllowedInput(questionByIndex(9), 'operations')).toBe(true);
  });
  it('accepts any text for a free-text question', () => {
    expect(isAllowedInput(questionByIndex(6), 'anything')).toBe(true);
  });
});
