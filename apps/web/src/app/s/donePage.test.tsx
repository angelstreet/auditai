import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({
  submitted: false,
  answers: {} as Record<number, unknown>,
  submitCalls: 0,
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock('@/lib/respondent', async (orig) => ({
  ...(await orig<typeof import('@/lib/respondent')>()),
  loadRespondent: async () => ({
    kind: 'ok',
    invite: { tenantId: 't', invitationId: 'i', pseudonym: 'p' },
    state: { submissionId: 'sub', answers: s.answers },
    locale: 'en',
    t: (k: string) => k,
  }),
  teamProgress: async () => ({
    answered: 1,
    invited: 2,
    engagementStatus: 'open',
    closesAt: null,
    teamTier: null,
    contact: null,
  }),
}));
vi.mock('@/lib/respondentBadgeData', () => ({ getCurrentBadgeForPseudonym: async () => null }));
vi.mock('@/lib/surveyState', () => ({
  isSubmitted: async () => s.submitted,
  submitState: async () => {
    s.submitCalls += 1;
  },
}));
vi.mock('@/components/respondent/RespondentStatus', () => ({ default: () => null }));
vi.mock('@/components/respondent/FinishButton', () => ({ default: () => null }));

(globalThis as { React?: unknown }).React = React;
import DonePage from './[token]/done/page';
import { totalQuestionCount } from '@/lib/syntheticTemplate';

const a = { questionId: 'q', value: { kind: 'skipped' } };
const render = () => DonePage({ params: { token: 'tok' } });

beforeEach(() => {
  s.submitted = false;
  s.answers = {};
  s.submitCalls = 0;
});

describe('done page is read-only', () => {
  it('sends an unfinished survey back to the first open question without submitting', async () => {
    s.answers = { 0: a };
    await expect(render()).rejects.toThrow('REDIRECT /s/tok/q/1');
    expect(s.submitCalls).toBe(0);
  });

  it('offers an explicit finish when everything is answered, without submitting', async () => {
    s.answers = Object.fromEntries(Array.from({ length: totalQuestionCount() }, (_, i) => [i, a]));
    await render();
    expect(s.submitCalls).toBe(0);
  });

  it('shows the thank-you for a submitted survey, without submitting again', async () => {
    s.submitted = true;
    await render();
    expect(s.submitCalls).toBe(0);
  });
});
