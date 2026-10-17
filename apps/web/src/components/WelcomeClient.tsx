'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LOCALE_COOKIE, createTranslator, type SupportedLocale } from '@auditai/i18n';
import LocaleToggle from './LocaleToggle';

interface Props {
  token: string;
  initialLocale: SupportedLocale;
  totalQuestions: number;
}

/**
 * Welcome island: handles the locale toggle (server stores via /api/locale) and the start
 * button that navigates to the first question.
 */
export default function WelcomeClient(props: Props) {
  const [locale, setLocale] = useState<SupportedLocale>(props.initialLocale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = createTranslator(locale);

  const handleLocale = async (next: SupportedLocale) => {
    setLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: props.token, locale: next }),
    });
    router.refresh();
  };

  const handleStart = () => {
    startTransition(() => router.push(`/s/${props.token}/q/0`));
  };

  return (
    <div>
      <p>
        <strong>{t('survey.languageHeading')}</strong>
      </p>
      <LocaleToggle value={locale} locale={locale} onChange={handleLocale} />
      <p className="muted">{t('survey.estimated')}</p>
      <p className="muted">{t('survey.skip')}</p>
      <p>
        <button type="button" className="cta" onClick={handleStart} disabled={pending}>
          {t('survey.start')}
        </button>
      </p>
      <p className="muted">{t('survey.questionsCount', { n: props.totalQuestions })}</p>
    </div>
  );
}
