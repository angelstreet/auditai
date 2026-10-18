'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, supportedLocales, type SupportedLocale } from '@evolai/i18n';
import { useI18n } from './I18nProvider';

/** Header language switcher: stores the choice in a cookie and re-renders the server tree. */
export default function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const choose = (next: SupportedLocale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  };
  return (
    <div className="locale-toggle" role="group" aria-label={t('common.language.switcherAria')}>
      {supportedLocales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          data-testid={`switch-${l}`}
          aria-pressed={locale === l}
          onClick={() => choose(l)}
        >
          {t(`common.language.${l}`)}
        </button>
      ))}
    </div>
  );
}
