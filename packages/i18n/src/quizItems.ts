import type { SupportedLocale } from './index.js';

/**
 * Localised literacy-quiz copy, keyed by the stable question code and option value from
 * `@evolai/domain` (weights and scoring stay in the domain package; this is text only).
 *
 * `QUIZ_ITEM_STATUS.fr` is `draft-fr`: the French wording is an unreviewed draft awaiting owner
 * review (ADR 0024, PRD item metadata locale).
 */
export interface QuizItemCopy {
  readonly prompt: string;
  readonly options: Readonly<Record<string, string>>;
}

export const QUIZ_ITEM_STATUS: Record<SupportedLocale, 'reviewed' | 'draft-fr'> = {
  en: 'reviewed',
  fr: 'draft-fr',
};

export const quizItems: Record<SupportedLocale, Readonly<Record<string, QuizItemCopy>>> = {
  en: {
    ai_last_30d: {
      prompt: 'In the last 30 days, how often did you learn about AI tools?',
      options: {
        never: 'Never',
        monthly: 'About once a month',
        weekly: 'A few times a week',
        daily: 'Every day',
      },
    },
    ai_media_consumption: {
      prompt: 'How often do you read or hear AI news?',
      options: {
        never: 'Never',
        occasional: 'When I come across it',
        weekly: 'Every week (newsletter, podcast)',
        daily: 'Every day',
      },
    },
    ai_chatbot_use: {
      prompt: 'Do you use an AI chatbot at work?',
      options: {
        never: 'No',
        curious: 'Sometimes, to try',
        weekly: 'Every week',
        daily: 'Every day, for real work',
      },
    },
    ai_assisted_coding: {
      prompt: 'Do you use AI to help you write code?',
      options: { never: 'Never', tried: 'Once or twice', weekly: 'Every week', daily: 'Every day' },
    },
    ai_built_projects: {
      prompt: 'In the past year, did you finish a project that relied on AI?',
      options: {
        never: 'No',
        experiment: 'Only a test',
        one_project: 'Yes, one',
        multiple: 'Yes, several',
      },
    },
  },
  fr: {
    ai_last_30d: {
      prompt: 'Ces 30 derniers jours, à quelle fréquence avez-vous appris à utiliser l’IA\u00a0?',
      options: {
        never: 'Jamais',
        monthly: 'Environ une fois par mois',
        weekly: 'Plusieurs fois par semaine',
        daily: 'Tous les jours',
      },
    },
    ai_media_consumption: {
      prompt: 'À quelle fréquence lisez-vous ou écoutez-vous des actualités sur l’IA\u00a0?',
      options: {
        never: 'Jamais',
        occasional: 'Quand je tombe dessus',
        weekly: 'Chaque semaine (lettre d’information, podcast)',
        daily: 'Tous les jours',
      },
    },
    ai_chatbot_use: {
      prompt: 'Utilisez-vous un assistant d’IA au travail\u00a0?',
      options: {
        never: 'Non',
        curious: 'Parfois, pour essayer',
        weekly: 'Chaque semaine',
        daily: 'Tous les jours, pour du vrai travail',
      },
    },
    ai_assisted_coding: {
      prompt: 'Utilisez-vous l’IA pour vous aider à écrire du code\u00a0?',
      options: {
        never: 'Jamais',
        tried: 'Une ou deux fois',
        weekly: 'Chaque semaine',
        daily: 'Tous les jours',
      },
    },
    ai_built_projects: {
      prompt: 'Ces 12 derniers mois, avez-vous mené à bien un projet qui s’appuie sur l’IA\u00a0?',
      options: {
        never: 'Non',
        experiment: 'Seulement un essai',
        one_project: 'Oui, un',
        multiple: 'Oui, plusieurs',
      },
    },
  },
};
