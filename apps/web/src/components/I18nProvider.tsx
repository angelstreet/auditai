'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, type SupportedLocale, type Translator } from '@auditai/i18n';

interface Value {
  locale: SupportedLocale;
  t: Translator;
}

const Ctx = createContext<Value | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: SupportedLocale;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = (): Value => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
};
