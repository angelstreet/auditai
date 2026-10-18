import Link from 'next/link';
import type { Translator } from '@auditai/i18n';

/** One reassuring line; the detail is one tap away (PRD §5, §15). */
export default function PrivacyNotice({ t }: { t: Translator }) {
  return (
    <section className="privacy" aria-label={t('survey.privacyMore')}>
      <p>{t('survey.privacyShort')}</p>
      <details>
        <summary>{t('survey.privacyMore')}</summary>
        <ul>
          <li>{t('survey.privacy1')}</li>
          <li>{t('survey.privacy2')}</li>
          <li>{t('survey.privacy3')}</li>
        </ul>
        <Link href="/privacy">{t('survey.privacyFull')}</Link>
      </details>
    </section>
  );
}
