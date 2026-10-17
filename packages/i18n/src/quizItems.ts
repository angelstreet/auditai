import type { SupportedLocale } from './index.js';

/**
 * Localised literacy-quiz copy, keyed by the stable question code and option value from
 * `@auditai/domain` (weights and scoring stay in the domain package; this is text only).
 *
 * `QUIZ_ITEM_STATUS.fr` is `draft-fr`: the French wording is an unreviewed draft awaiting owner
 * review (ADR 0020, PRD item metadata locale).
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
      prompt: 'In the last 30 days, how often have you spent time learning about AI tools?',
      options: {
        never: 'Never',
        monthly: 'About once a month',
        weekly: 'A few times a week',
        daily: 'Daily',
      },
    },
    ai_media_consumption: {
      prompt: 'How often do you follow AI news or commentary?',
      options: {
        never: 'Never',
        occasional: 'When it crosses my feed',
        weekly: 'Weekly newsletter / podcast',
        daily: 'Daily',
      },
    },
    ai_chatbot_use: {
      prompt: 'How do you use an AI chatbot at work today?',
      options: {
        never: "I don't",
        curious: 'Sometimes to try things',
        weekly: 'Weekly in my workflow',
        daily: 'Daily on real tasks',
      },
    },
    ai_assisted_coding: {
      prompt: 'How often do you use an AI pair-programmer or coding assistant?',
      options: { never: 'Never', tried: 'Tried once or twice', weekly: 'Weekly', daily: 'Daily' },
    },
    ai_built_projects: {
      prompt: 'In the last year, have you shipped a project that meaningfully used AI?',
      options: {
        never: 'No',
        experiment: 'Experiment only',
        one_project: 'Yes, one project',
        multiple: 'Yes, multiple',
      },
    },
  },
  fr: {
    ai_last_30d: {
      prompt:
        'Au cours des 30 derniers jours, à quelle fréquence avez-vous consacré du temps à vous former aux outils d’IA ?',
      options: {
        never: 'Jamais',
        monthly: 'Environ une fois par mois',
        weekly: 'Plusieurs fois par semaine',
        daily: 'Tous les jours',
      },
    },
    ai_media_consumption: {
      prompt: 'À quelle fréquence suivez-vous l’actualité ou les analyses sur l’IA ?',
      options: {
        never: 'Jamais',
        occasional: 'Quand elle passe dans mon fil',
        weekly: 'Lettre d’information / podcast hebdomadaire',
        daily: 'Tous les jours',
      },
    },
    ai_chatbot_use: {
      prompt:
        'Comment utilisez-vous aujourd’hui un agent conversationnel (chatbot) d’IA au travail ?',
      options: {
        never: 'Je ne l’utilise pas',
        curious: 'Parfois, pour essayer',
        weekly: 'Chaque semaine dans mon travail',
        daily: 'Tous les jours sur de vraies tâches',
      },
    },
    ai_assisted_coding: {
      prompt: 'À quelle fréquence utilisez-vous un assistant de programmation fondé sur l’IA ?',
      options: {
        never: 'Jamais',
        tried: 'Essayé une ou deux fois',
        weekly: 'Chaque semaine',
        daily: 'Tous les jours',
      },
    },
    ai_built_projects: {
      prompt:
        'Au cours de l’année écoulée, avez-vous livré un projet qui s’appuyait de façon significative sur l’IA ?',
      options: {
        never: 'Non',
        experiment: 'Simple expérimentation',
        one_project: 'Oui, un projet',
        multiple: 'Oui, plusieurs',
      },
    },
  },
};
