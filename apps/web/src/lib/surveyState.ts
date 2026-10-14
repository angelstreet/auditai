import type { SupportedLocale } from '@auditai/i18n';

/**
 * In-memory survey state store (PRD \u00a75, \u00a717).
 *
 * Production replaces this with a Postgres-backed submission row (PRD \u00a714); the API surface here
 * is what M5 needs and stays the same in the next milestone. We key the state by the invitation
 * token reference so the resume link is just the same URL.
 *
 * `submit` is single-use: a second call returns `already_submitted`. The store is intentionally
 * process-local; horizontal scaling will require a shared backend (Phase 2).
 */

export interface SurveyState {
  readonly invitationReference: string;
  locale: SupportedLocale;
  /** Map of question index \u2192 chosen option value. */
  answers: Record<number, string>;
  /** Sequence number of the last persisted answer; used to drive "resume" semantics. */
  lastIndex: number;
  startedAt: string;
  submittedAt: string | null;
}

const STATES = new Map<string, SurveyState>();

export const getOrCreateState = (invitationReference: string): SurveyState => {
  const existing = STATES.get(invitationReference);
  if (existing) return existing;
  const created: SurveyState = {
    invitationReference,
    locale: 'en',
    answers: {},
    lastIndex: -1,
    startedAt: new Date().toISOString(),
    submittedAt: null,
  };
  STATES.set(invitationReference, created);
  return created;
};

export const recordAnswer = (
  invitationReference: string,
  index: number,
  choice: string,
): SurveyState => {
  const state = getOrCreateState(invitationReference);
  state.answers = { ...state.answers, [index]: choice };
  state.lastIndex = index;
  return state;
};

export const setLocale = (invitationReference: string, locale: SupportedLocale): SurveyState => {
  const state = getOrCreateState(invitationReference);
  state.locale = locale;
  return state;
};

export const submitState = (invitationReference: string): SurveyState => {
  const state = getOrCreateState(invitationReference);
  if (state.submittedAt) return state;
  state.submittedAt = new Date().toISOString();
  return state;
};

export const isSubmitted = (invitationReference: string): boolean => {
  const state = STATES.get(invitationReference);
  return Boolean(state?.submittedAt);
};

/** Test helper \u2014 not exported in production builds. */
export const _resetSurveyState = (): void => STATES.clear();
