import type { SupportedLocale } from './index.js';

const intlTag: Record<SupportedLocale, string> = { fr: 'fr-FR', en: 'en-US' };

export const formatNumber = (
  locale: SupportedLocale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string => new Intl.NumberFormat(intlTag[locale], options).format(value);

export const formatCurrency = (locale: SupportedLocale, value: number, currency = 'EUR'): string =>
  new Intl.NumberFormat(intlTag[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export const formatDate = (
  locale: SupportedLocale,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string =>
  new Intl.DateTimeFormat(intlTag[locale], { timeZone: 'UTC', ...options }).format(new Date(value));

/**
 * "of X" for a name that is data (a team or engagement name), shown as written. French elides
 * before a vowel or a mute h: "de Santé" but "d’Équipe pilote" (TASK-T, ADR 0038). English has no
 * such rule, so the caller keeps its own wording there.
 */
export const deName = (locale: SupportedLocale, name: string): string => {
  const n = name.trim();
  if (locale !== 'fr') return n;
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? `d’${n}` : `de ${n}`;
};
