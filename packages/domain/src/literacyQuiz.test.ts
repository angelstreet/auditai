import { describe, expect, it } from 'vitest';
import {
  LITERACY_QUIZ,
  computeQuizScore,
  generateQuizPseudonym,
  isCompleteQuizSubmission,
  tierDescriptor,
} from './literacyQuiz.js';

describe('literacy quiz (M14)', () => {
  it('ships the canonical five-question set', () => {
    expect(LITERACY_QUIZ.map((q) => q.code)).toEqual([
      'ai_last_30d',
      'ai_media_consumption',
      'ai_chatbot_use',
      'ai_assisted_coding',
      'ai_built_projects',
    ]);
  });

  it('every question has at least three options with non-negative weights', () => {
    for (const q of LITERACY_QUIZ) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      for (const o of q.options) {
        expect(o.weight).toBeGreaterThanOrEqual(0);
        expect(o.weight).toBeLessThanOrEqual(25);
      }
    }
  });

  it('returns a tortoise-tier score for mostly low answers', () => {
    const answers = {
      ai_last_30d: 'never',
      ai_media_consumption: 'never',
      ai_chatbot_use: 'never',
      ai_assisted_coding: 'never',
      ai_built_projects: 'never',
    };
    const score = computeQuizScore(answers);
    expect(score).toBeLessThanOrEqual(50);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('returns an owl-tier score for mostly high answers', () => {
    const answers = {
      ai_last_30d: 'daily',
      ai_media_consumption: 'daily',
      ai_chatbot_use: 'daily',
      ai_assisted_coding: 'daily',
      ai_built_projects: 'multiple',
    };
    const score = computeQuizScore(answers);
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('recognises a complete submission', () => {
    const complete = {
      ai_last_30d: 'weekly',
      ai_media_consumption: 'weekly',
      ai_chatbot_use: 'weekly',
      ai_assisted_coding: 'weekly',
      ai_built_projects: 'one_project',
    };
    expect(isCompleteQuizSubmission(complete)).toBe(true);
    const partial: Record<string, string> = { ...complete };
    delete partial['ai_built_projects'];
    expect(isCompleteQuizSubmission(partial)).toBe(false);
  });

  it('produces a non-empty tier descriptor per mascot', () => {
    expect(tierDescriptor('tortoise')).toMatch(/own pace|small/i);
    expect(tierDescriptor('fox')).toMatch(/explorer|pragmatic|curious/i);
    expect(tierDescriptor('owl')).toMatch(/already part|sharing/i);
  });

  it('generates pseudonyms of the expected shape', () => {
    const p = generateQuizPseudonym();
    expect(p).toMatch(/^quiz-[a-z0-9]{8}-[a-z0-9]{4}$/);
  });
});
