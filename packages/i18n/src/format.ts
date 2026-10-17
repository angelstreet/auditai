import type { SupportedLocale } from './index.js';

const intlTag: Record<SupportedLocale, string> = { fr: 'fr-FR', en: 'en-GB' };

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
