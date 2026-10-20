import Link from 'next/link';
import { AppIcon } from '@evolai/ui';
import type { Translator } from '@evolai/i18n';

/** One reassuring line with the shield icon; the detail is one tap away (PRD §5, §15). */
export default function PrivacyNotice({
  t,
  engagementId,
}: {
  t: Translator;
  /** Opens the notice with this organisation's published details. */
  engagementId?: string;
}) {
  return (
    <section className="privacy" aria-label={t('survey.privacyMore')}>
      <p className="privacy-line">
        <AppIcon name="privacy" />
        <span>{t('survey.privacyShort')}</span>
      </p>
      {engagementId ? (
        <p>
          <Link href={`/privacy?e=${engagementId}#request`} data-testid="privacy-request-link">
            {t('survey.privacyRequest')}
          </Link>
        </p>
      ) : null}
      <details>
        <summary>{t('survey.privacyMore')}</summary>
        <ul>
          <li>{t('survey.privacy1')}</li>
          <li>{t('survey.privacy2')}</li>
          <li>{t('survey.privacy3')}</li>
          <li>{t('survey.privacy4')}</li>
        </ul>
        <Link href={engagementId ? `/privacy?e=${engagementId}` : '/privacy'}>
          {t('survey.privacyFull')}
        </Link>
      </details>
    </section>
  );
}
