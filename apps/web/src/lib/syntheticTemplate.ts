import type { AnswerValue, Locale } from '@auditai/contracts';
import type { SupportedLocale } from '@auditai/i18n';

/**
 * Synthetic survey template used by the mobile web flow (M5).
 *
 * Six scenario-choice questions aligned with the synthetic rubric that the M3 test fixtures use.
 * Each question carries the FR text; the EN text is a literal translation. No PII, no real
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
      fr: 'Un assistant g\u00e9n\u00e9ratif produit une r\u00e9ponse de politique non sourc\u00e9e. Que faites-vous\u00a0?',
      en: 'A generative assistant produces an unsourced policy answer. What do you do?',
    },
    helper: {
      fr: 'Choisissez la r\u00e9ponse qui refl\u00e8te le mieux votre pratique.',
      en: 'Pick the option that best reflects your usual practice.',
    },
    options: [
      {
        value: 'use_as_is',
        label: {
          fr: 'L\u2019utiliser telle quelle',
          en: 'Use it as-is',
        },
      },
      {
        value: 'verify_source',
        label: {
          fr: 'V\u00e9rifier une source autoritaire',
          en: 'Check an authoritative source',
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
      fr: 'Un coll\u00e8gue veut coller des dossiers client dans un chatbot public. Quelle est la bonne prochaine \u00e9tape\u00a0?',
      en: 'A colleague wants to paste client records into a public chatbot. What is the right next step?',
    },
    helper: {
      fr: 'Pensez classification des donn\u00e9es et approbation.',
      en: 'Think data classification and approval.',
    },
    options: [
      {
        value: 'paste_anyway',
        label: {
          fr: 'Coller tout de m\u00eame',
          en: 'Paste them anyway',
        },
      },
      {
        value: 'check_policy',
        label: {
          fr: 'V\u00e9rifier la politique de classification',
          en: 'Check the classification policy',
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
      fr: 'Quel \u00e9nonc\u00e9 donne le meilleur contexte pour r\u00e9sumer les retours clients\u00a0?',
      en: 'Which prompt gives the best context to summarise customer feedback?',
    },
    helper: {
      fr: 'Un bon brief\u00a0: objectif, public, contraintes, format.',
      en: 'A good brief: objective, audience, constraints, format.',
    },
    options: [
      {
        value: 'short_vague',
        label: {
          fr: 'R\u00e9sume les retours.',
          en: 'Summarise the feedback.',
        },
      },
      {
        value: 'specific_brief',
        label: {
          fr: 'R\u00e9sume ces retours pour la direction\u00a0: 5 th\u00e8mes, 100 mots, fran\u00e7ais.',
          en: 'Summarise this feedback for the leadership team: 5 themes, 100 words, in English.',
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
      fr: 'Un rapport manuel traverse 4 outils. Premier mouvement\u00a0?',
      en: 'A manual report crosses 4 tools. What is the first move?',
    },
    helper: {
      fr: 'Regarder avant et apr\u00e8s votre propre t\u00e2che.',
      en: 'Look before and after your own task.',
    },
    options: [
      {
        value: 'jump_to_ai',
        label: {
          fr: 'Automatiser avec l\u2019IA tout de suite.',
          en: 'Automate with AI right away.',
        },
      },
      {
        value: 'map_first',
        label: {
          fr: 'Cartographier le flux et les frictions d\u2019abord.',
          en: 'Map the workflow and friction first.',
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
      fr: 'Une copie de donn\u00e9es fixe se r\u00e9p\u00e8te chaque jour. Doit-elle passer par l\u2019IA g\u00e9n\u00e9rative\u00a0?',
      en: 'A fixed data copy runs every day. Does it have to use generative AI?',
    },
    helper: {
      fr: 'L\u2019IA g\u00e9n\u00e9rative n\u2019est pas toujours la bonne r\u00e9ponse.',
      en: 'Generative AI is not always the right answer.',
    },
    options: [
      {
        value: 'always_ai',
        label: {
          fr: 'Oui, c\u2019est de l\u2019IA.',
          en: 'Yes, that is AI.',
        },
      },
      {
        value: 'deterministic_first',
        label: {
          fr: 'Non, commencer par une automatisation d\u00e9terministe.',
          en: 'No, start with deterministic automation.',
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
      fr: 'Combien de temps passez-vous en moyenne chaque semaine sur des t\u00e2ches r\u00e9p\u00e9titives\u00a0?',
      en: 'How much time do you spend on repetitive tasks each week, on average?',
    },
    helper: {
      fr: 'Estimation honn\u00eate\u00a0; le questionnaire dure moins de huit minutes.',
      en: 'An honest estimate; the survey is under eight minutes.',
    },
    options: [
      {
        value: 'lt_1h',
        label: { fr: 'Moins d\u20191 heure', en: 'Less than 1 hour' },
      },
      {
        value: '1_3h',
        label: { fr: '1 \u00e0 3 heures', en: '1 to 3 hours' },
      },
      {
        value: '3_6h',
        label: { fr: '3 \u00e0 6 heures', en: '3 to 6 hours' },
      },
      {
        value: 'gt_6h',
        label: { fr: 'Plus de 6 heures', en: 'More than 6 hours' },
      },
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
