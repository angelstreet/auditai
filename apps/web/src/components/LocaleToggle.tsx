'use client';

import type { SupportedLocale } from '@auditai/i18n';

interface Props {
  value: SupportedLocale;
  onChange: (next: SupportedLocale) => void;
}

const LABELS: Record<SupportedLocale, string> = { fr: 'Fran\u00e7ais', en: 'English' };

export default function LocaleToggle({ value, onChange }: Props) {
  return (
    <div className="locale-toggle" role="group" aria-label="Survey language">
      {(['fr', 'en'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={value === locale}
          onClick={() => onChange(locale)}
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
