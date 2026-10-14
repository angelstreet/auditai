'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { SupportedLocale } from '@auditai/i18n';
import LocaleToggle from './LocaleToggle';

interface Props {
  token: string;
  initialLocale: SupportedLocale;
  totalQuestions: number;
  startLabel: string;
  estimatedLabel: string;
  skipLabel: string;
  languageHeading: string;
}

/**
 * Welcome island: handles the locale toggle (server stores via /api/locale) and the start
 * button that navigates to the first question.
 */
export default function WelcomeClient(props: Props) {
  const [locale, setLocale] = useState<SupportedLocale>(props.initialLocale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleLocale = async (next: SupportedLocale) => {
    setLocale(next);
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: props.token, locale: next }),
    });
  };

  const handleStart = () => {
    startTransition(() => router.push(`/s/${props.token}/q/0`));
  };

  return (
    <div>
      <p>
        <strong>{props.languageHeading}</strong>
      </p>
      <LocaleToggle value={locale} onChange={handleLocale} />
      <p className="muted">{props.estimatedLabel}</p>
      <p className="muted">{props.skipLabel}</p>
      <p>
        <button type="button" className="cta" onClick={handleStart} disabled={pending}>
          {props.startLabel}
        </button>
      </p>
      <p className="muted">
        {props.totalQuestions === 1
          ? `${props.totalQuestions} question`
          : `${props.totalQuestions} questions`}
      </p>
    </div>
  );
}
