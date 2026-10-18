import type { AnswerValue, Locale } from '@evolai/contracts';
import type { SupportedLocale } from '@evolai/i18n';

/**
 * Synthetic survey template used by the mobile web flow (M5).
 *
 * Six scenario-choice questions aligned with the synthetic rubric that the M3 test fixtures use.
 * Plain words, one idea per question, FR and EN written side by side (TASK-E UX pass). No PII, no real
 * client data. Phase 2 will replace this with a frozen questionnaire version loaded from Postgres.
 */

export interface SurveyQuestion {
  readonly id: string;
  readonly axis: 'literacy' | 'practice' | 'context';
  readonly code: string;
  readonly prompt: Record<SupportedLocale, string>;
  readonly helper: Record<SupportedLocale, string | null>;
  readonly options: ReadonlyArray<{
    readonly value: string;
    readonly label: Record<SupportedLocale, string>;
  }>;
  readonly kind: 'scenario_choice';
}

export const SYNTHETIC_QUESTIONS: ReadonlyArray<SurveyQuestion> = [
  {
    id: 'q1-source-checking',
    axis: 'literacy',
    code: 'synthetic_source_checking',
    prompt: {
      fr: 'Une IA vous donne une réponse sans citer de source. Que faites-vous\u00a0?',
      en: 'An AI tool gives you an answer with no source. What do you do?',
    },
    helper: {
      fr: 'Choisissez ce que vous faites d’habitude.',
      en: 'Pick what you usually do.',
    },
    options: [
      { value: 'use_as_is', label: { fr: 'Je l’utilise telle quelle', en: 'I use it as it is' } },
      {
        value: 'verify_source',
        label: {
          fr: 'Je vérifie dans une source fiable',
          en: 'I check it against a trusted source',
        },
      },
    ],
    kind: 'scenario_choice',
  },
  {
    id: 'q2-data-safety',
    axis: 'literacy',
    code: 'synthetic_data_safety',
    prompt: {
      fr: 'Un collègue veut coller des fiches clients dans un assistant d’IA public. Que faire\u00a0?',
      en: 'A colleague wants to paste client files into a public chatbot. What should happen?',
    },
    helper: { fr: null, en: null },
    options: [
      { value: 'paste_anyway', label: { fr: 'Le laisser faire', en: 'Let them do it' } },
      {
        value: 'check_policy',
        label: {
          fr: 'Vérifier d’abord les règles de l’entreprise',
          en: 'Check the company rules first',
        },
      },
    ],
    kind: 'scenario_choice',
  },
  {
    id: 'q3-prompting',
    axis: 'literacy',
    code: 'synthetic_prompting',
    prompt: {
      fr: 'Quelle demande donne le meilleur résumé des avis clients\u00a0?',
      en: 'Which request gets the best summary of customer feedback?',
    },
    helper: {
      fr: 'Une bonne demande dit le but, le public et le format.',
      en: 'A good request says the goal, the audience and the format.',
    },
    options: [
      {
        value: 'short_vague',
        label: { fr: '«\u00a0Résumez les avis.\u00a0»', en: '“Summarise the feedback.”' },
      },
      {
        value: 'specific_brief',
        label: {
          fr: '«\u00a0Résumez ces avis pour la direction\u00a0: 5 thèmes, 100 mots.\u00a0»',
          en: '“Summarise this feedback for the leadership team: 5 themes, 100 words.”',
        },
      },
    ],
    kind: 'scenario_choice',
  },
  {
    id: 'q4-workflow',
    axis: 'context',
    code: 'synthetic_workflow',
    prompt: {
      fr: 'Un rapport fait à la main passe par 4 outils. Par quoi commencer\u00a0?',
      en: 'A report made by hand goes through 4 tools. Where do you start?',
    },
    helper: { fr: null, en: null },
    options: [
      {
        value: 'jump_to_ai',
        label: {
          fr: 'L’automatiser tout de suite avec l’IA',
          en: 'Automate it with AI right away',
        },
      },
      {
        value: 'map_first',
        label: {
          fr: 'Noter d’abord les étapes et ce qui bloque',
          en: 'First write down the steps and what slows them',
        },
      },
    ],
    kind: 'scenario_choice',
  },
  {
    id: 'q5-automation-vs-ai',
    axis: 'literacy',
    code: 'synthetic_automation_choice',
    prompt: {
      fr: 'Chaque jour, on recopie les mêmes données. Faut-il de l’IA pour ça\u00a0?',
      en: 'The same data copy runs every day. Does it need AI?',
    },
    helper: {
      fr: 'L’IA n’est pas toujours la bonne réponse.',
      en: 'AI is not always the answer.',
    },
    options: [
      { value: 'always_ai', label: { fr: 'Oui, il faut de l’IA', en: 'Yes, it needs AI' } },
      {
        value: 'deterministic_first',
        label: {
          fr: 'Non, une simple automatisation suffit',
          en: 'No, a simple automation is enough',
        },
      },
    ],
    kind: 'scenario_choice',
  },
  {
    id: 'q6-context-time',
    axis: 'practice',
    code: 'synthetic_context_time',
    prompt: {
      fr: 'Combien de temps passez-vous chaque semaine sur des tâches répétitives\u00a0?',
      en: 'How much time do you spend on repetitive tasks each week?',
    },
    helper: {
      fr: 'Une estimation suffit.',
      en: 'A rough guess is fine.',
    },
    options: [
      { value: 'lt_1h', label: { fr: 'Moins d’une heure', en: 'Less than 1 hour' } },
      { value: '1_3h', label: { fr: '1 à 3 heures', en: '1 to 3 hours' } },
      { value: '3_6h', label: { fr: '3 à 6 heures', en: '3 to 6 hours' } },
      { value: 'gt_6h', label: { fr: 'Plus de 6 heures', en: 'More than 6 hours' } },
    ],
    kind: 'scenario_choice',
  },
];

export const totalQuestionCount = (): number => SYNTHETIC_QUESTIONS.length;

export const questionByIndex = (index: number): SurveyQuestion => {
  const q = SYNTHETIC_QUESTIONS[index];
  if (!q) throw new Error(`question index out of range: ${index}`);
  return q;
};

export const buildAnswer = (q: SurveyQuestion, choice: string): AnswerValue => ({
  kind: 'scenario_choice',
  choice,
  rationale: null,
});

export const supportedLocaleOrFallback = (value: string): SupportedLocale => {
  if (value === 'fr' || value === 'en') return value;
  return 'en';
};

// Locale type re-export to keep a single import surface.
export type { Locale };
