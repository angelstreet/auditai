import { createTranslator, type SupportedLocale } from '@auditai/i18n';

interface Props {
  locale: SupportedLocale;
}

export default function PrivacyNotice({ locale }: Props) {
  const t = createTranslator(locale);
  return (
    <section className="privacy" aria-labelledby="privacy-notice-title">
      <h2 id="privacy-notice-title">{t('survey.privacyTitle')}</h2>
      <ul>
        <li>{t('survey.privacy1')}</li>
        <li>{t('survey.privacy2')}</li>
        <li>{t('survey.privacy3')}</li>
      </ul>
    </section>
  );
}
