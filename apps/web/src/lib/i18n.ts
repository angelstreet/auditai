import { cookies, headers } from 'next/headers';
import {
  LEGACY_LOCALE_COOKIE,
  LOCALE_COOKIE,
  createTranslator,
  isSupportedLocale,
  negotiateLocale,
  type SupportedLocale,
  type Translator,
} from '@evolai/i18n';

/** UI locale for this request: explicit cookie choice, else Accept-Language, else default (ADR 0024). */
export const getLocale = (): SupportedLocale => {
  const chosen = (cookies().get(LOCALE_COOKIE) ?? cookies().get(LEGACY_LOCALE_COOKIE))?.value;
  if (chosen && isSupportedLocale(chosen)) return chosen;
  return negotiateLocale(headers().get('accept-language'));
};

/** True when the person picked a language (cookie), as opposed to the browser's default. */
export const localeIsChosen = (): boolean => {
  const chosen = (cookies().get(LOCALE_COOKIE) ?? cookies().get(LEGACY_LOCALE_COOKIE))?.value;
  return Boolean(chosen && isSupportedLocale(chosen));
};

export const getT = (): { locale: SupportedLocale; t: Translator } => {
  const locale = getLocale();
  return { locale, t: createTranslator(locale) };
};

export { enumLabelOf as enumLabel } from './enumLabel';
