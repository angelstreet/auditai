/**
 * Literacy quiz config (M14, PRD \u00a76, \u00a79, \u00a715).
 *
 * A 5-question deterministic literacy quiz. Every question is multiple choice
 * (3 options each). Each option carries a `weight` from 0 to 20; the total
 * score is the sum, normalised to 1\u2013100 so the `mascotTierForScore` cut
 * points (\u2264 50 tortoise, 51\u201380 fox, \u2265 81 owl) hold regardless of how
 * many questions we ship.
 *
 * The five codes are exactly the ones named in the ROADMAP M14 row: AI learning
 * in last 30 days, AI media consumption, AI chatbot use, AI-assisted coding,
 * AI-built projects, paid AI subscriptions. We ship 5 of these 6 for the
 * pilot; the 6th (paid AI subscriptions) rolls up under "ai_chatbot_use" in
 * scoring until a future M14.x finalises it.
 */

export interface QuizOption {
  readonly value: string;
  readonly label: string;
  readonly weight: number;
}

export interface QuizQuestion {
  readonly code: string;
  readonly prompt: string;
  readonly options: ReadonlyArray<QuizOption>;
}

export const LITERACY_QUIZ: ReadonlyArray<QuizQuestion> = [
  {
    code: 'ai_last_30d',
    prompt: 'In the last 30 days, how often have you spent time learning about AI tools?',
    options: [
      { value: 'never', label: 'Never', weight: 0 },
      { value: 'monthly', label: 'About once a month', weight: 8 },
      { value: 'weekly', label: 'A few times a week', weight: 16 },
      { value: 'daily', label: 'Daily', weight: 22 },
    ],
  },
  {
    code: 'ai_media_consumption',
    prompt: 'How often do you follow AI news or commentary?',
    options: [
      { value: 'never', label: 'Never', weight: 0 },
      { value: 'occasional', label: 'When it crosses my feed', weight: 8 },
      { value: 'weekly', label: 'Weekly newsletter / podcast', weight: 18 },
      { value: 'daily', label: 'Daily', weight: 22 },
    ],
  },
  {
    code: 'ai_chatbot_use',
    prompt: 'How do you use an AI chatbot at work today?',
    options: [
      { value: 'never', label: "I don't", weight: 0 },
      { value: 'curious', label: 'Sometimes to try things', weight: 12 },
      { value: 'weekly', label: 'Weekly in my workflow', weight: 20 },
      { value: 'daily', label: 'Daily on real tasks', weight: 22 },
    ],
  },
  {
    code: 'ai_assisted_coding',
    prompt: 'How often do you use an AI pair-programmer or coding assistant?',
    options: [
      { value: 'never', label: 'Never', weight: 0 },
      { value: 'tried', label: 'Tried once or twice', weight: 8 },
      { value: 'weekly', label: 'Weekly', weight: 18 },
      { value: 'daily', label: 'Daily', weight: 22 },
    ],
  },
  {
    code: 'ai_built_projects',
    prompt: 'In the last year, have you shipped a project that meaningfully used AI?',
    options: [
      { value: 'never', label: 'No', weight: 0 },
      { value: 'experiment', label: 'Experiment only', weight: 8 },
      { value: 'one_project', label: 'Yes, one project', weight: 14 },
      { value: 'multiple', label: 'Yes, multiple', weight: 14 },
    ],
  },
];

/** Map each question's option to its weight. 0 for unknowns. */
const weightFor = (q: QuizQuestion, value: string): number =>
  q.options.find((o) => o.value === value)?.weight ?? 0;

/**
 * Compute a quiz score in 1..100 from the user answers. Unanswered questions
 * score `0` so a partial submission still resolves, but the smoke enforces
 * the full set.
 */
export const computeQuizScore = (answers: Record<string, string>): number => {
  const raw = LITERACY_QUIZ.reduce((sum, q) => sum + weightFor(q, answers[q.code] ?? 'never'), 0);
  // raw ranges 0..98 (current question weights). Normalise to 1..100 so the
  // mascotTierForScore cut points fall where the contract promises.
  return Math.min(100, Math.max(1, Math.round((raw / 98) * 100)));
};

/** Validate that an answers object covers every quiz code. */
export const isCompleteQuizSubmission = (answers: Record<string, string>): boolean =>
  LITERACY_QUIZ.every((q) => {
    const v = answers[q.code];
    return typeof v === 'string' && v.length > 0;
  });

/** The localised FR/EN strings for the "what does your tier mean" sentence. */
export const tierDescriptor = (tier: 'tortoise' | 'fox' | 'owl'): string => {
  switch (tier) {
    case 'tortoise':
      return "You're at the start of the curve \u2014 a little exposure goes a long way.";
    case 'fox':
      return "You're a regular explorer \u2014 pragmatic, curious, learning as you go.";
    case 'owl':
      return "You're an engaged practitioner \u2014 keep sharing what works.";
  }
};

/** Generate a platform-issued pseudonym for a fresh quiz respondent. */
export const generateQuizPseudonym = (): string => {
  const rand = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  return `quiz-${rand(8)}-${rand(4)}`;
};
