import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({
  answers: {} as Record<number, unknown>,
  submitted: false,
  submitCalls: 0,
}));

vi.mock('./surveyState', () => ({
  getOrCreateState: async () => ({ submissionId: 'sub', answers: s.answers }),
  isSubmitted: async () => s.submitted,
  submitState: async () => {
    s.submitCalls += 1;
    s.submitted = true;
  },
}));

import { finishSurvey } from './finishSurvey';

const skipped = { questionId: 'q', value: { kind: 'skipped' } };
const answer = {
  questionId: 'q',
  value: { kind: 'scenario_choice', choice: 'a', rationale: null },
};
const finish = () => finishSurvey('t' as never, 'i' as never, 3);

beforeEach(() => {
  s.answers = {};
  s.submitted = false;
  s.submitCalls = 0;
});

describe('finishSurvey', () => {
  it('refuses an incomplete survey and points at the first open question', async () => {
    s.answers = { 0: answer, 2: answer };
    expect(await finish()).toEqual({ ok: false, missingIndex: 1 });
    expect(s.submitCalls).toBe(0);
  });

  it('accepts answered and skipped questions, submitting once', async () => {
    s.answers = { 0: answer, 1: skipped, 2: answer };
    expect(await finish()).toEqual({ ok: true, alreadySubmitted: false });
    expect(await finish()).toEqual({ ok: true, alreadySubmitted: true });
    expect(await finish()).toEqual({ ok: true, alreadySubmitted: true });
    expect(s.submitCalls).toBe(1);
  });
});
