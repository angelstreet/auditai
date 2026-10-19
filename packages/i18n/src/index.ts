export const supportedLocales = ['fr', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

/** Default when neither cookie nor Accept-Language yields a supported locale (ADR 0024). */
export const defaultLocale: SupportedLocale = 'fr';

/** Cookie that stores the visitor's UI language choice. */
export const LOCALE_COOKIE = 'evolai_locale';
/** Pre-rename cookie name (ADR 0026); read as a fallback only. */
export const LEGACY_LOCALE_COOKIE = 'auditai_locale';

export const isSupportedLocale = (value: string): value is SupportedLocale =>
  (supportedLocales as readonly string[]).includes(value);

/**
 * Pick a locale from an Accept-Language header: highest q wins, primary subtag only
 * (`fr-CA` → `fr`). Unknown or malformed input falls back to {@link defaultLocale}.
 */
export const negotiateLocale = (header: string | null | undefined): SupportedLocale => {
  if (!header) return defaultLocale;
  const ranked = header
    .split(',')
    .map((part, order) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase().split('-')[0] ?? '', weight, order };
    })
    .filter((e) => Number.isFinite(e.weight) && e.weight > 0 && isSupportedLocale(e.tag))
    .sort((a, b) => b.weight - a.weight || a.order - b.order);
  return (ranked[0]?.tag as SupportedLocale | undefined) ?? defaultLocale;
};

export { createTranslator, formatMessage } from './translate.js';
export type { Translator, MessageKey, MessageVars } from './translate.js';
export { messages } from './messages/index.js';
export type { Messages } from './messages/index.js';
export { deName, formatDate, formatNumber, formatCurrency } from './format.js';
export { quizItems, QUIZ_ITEM_STATUS } from './quizItems.js';
export type { QuizItemCopy } from './quizItems.js';
