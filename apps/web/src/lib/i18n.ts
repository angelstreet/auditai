import { cookies, headers } from 'next/headers';
import {
  LOCALE_COOKIE,
  createTranslator,
  isSupportedLocale,
  negotiateLocale,
  type SupportedLocale,
  type Translator,
} from '@auditai/i18n';

/** UI locale for this request: explicit cookie choice, else Accept-Language, else default (ADR 0020). */
export const getLocale = (): SupportedLocale => {
  const chosen = cookies().get(LOCALE_COOKIE)?.value;
  if (chosen && isSupportedLocale(chosen)) return chosen;
  return negotiateLocale(headers().get('accept-language'));
};

export const getT = (): { locale: SupportedLocale; t: Translator } => {
  const locale = getLocale();
  return { locale, t: createTranslator(locale) };
};
