'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LOCALE_COOKIE, type SupportedLocale } from '@auditai/i18n';
import { useI18n } from './I18nProvider';

/**
 * Survey pages render in the submission's language. If the header (cookie) language differs,
 * adopt the survey language once so the page chrome matches the content.
 */
export default function LocaleSync({ locale }: { locale: SupportedLocale }) {
  const { locale: current } = useI18n();
  const router = useRouter();
  useEffect(() => {
    if (current === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  }, [current, locale, router]);
  return null;
}
