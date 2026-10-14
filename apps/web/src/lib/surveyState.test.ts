import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetSurveyState,
  getOrCreateState,
  isSubmitted,
  recordAnswer,
  setLocale,
  submitState,
} from './surveyState.js';

const REFERENCE = 'inv-synthetic-test';

beforeEach(() => {
  _resetSurveyState();
});

describe('surveyState', () => {
  it('creates a fresh state on first access', () => {
    const state = getOrCreateState(REFERENCE);
    expect(state.invitationReference).toBe(REFERENCE);
    expect(state.answers).toEqual({});
    expect(state.submittedAt).toBeNull();
  });

  it('returns the same state on later calls', () => {
    const a = getOrCreateState(REFERENCE);
    const b = getOrCreateState(REFERENCE);
    expect(a).toBe(b);
  });

  it('records answers and tracks lastIndex', () => {
    recordAnswer(REFERENCE, 0, 'verify_source');
    recordAnswer(REFERENCE, 2, 'specific_brief');
    const state = getOrCreateState(REFERENCE);
    expect(state.answers).toEqual({ 0: 'verify_source', 2: 'specific_brief' });
    expect(state.lastIndex).toBe(2);
  });

  it('updates the locale', () => {
    setLocale(REFERENCE, 'fr');
    expect(getOrCreateState(REFERENCE).locale).toBe('fr');
  });

  it('marks the state as submitted once and only once', () => {
    const first = submitState(REFERENCE);
    expect(first.submittedAt).not.toBeNull();
    const second = submitState(REFERENCE);
    expect(second.submittedAt).toBe(first.submittedAt);
    expect(isSubmitted(REFERENCE)).toBe(true);
  });
});
