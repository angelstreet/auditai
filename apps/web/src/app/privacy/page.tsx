import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { aroundLink } from '@/lib/richText';

export function generateMetadata() {
  return { title: getT().t('meta.pages.privacy') };
}

export default function PrivacyPage() {
  const { t } = getT();
  const [before, after] = aroundLink((vars) => t('privacy.seeAbout', vars));
  return (
    <section aria-labelledby="privacy-title">
      <h1 id="privacy-title">{t('privacy.title')}</h1>
      <p>{t('privacy.p1')}</p>
      <p>{t('privacy.p2')}</p>
      <p>
        {before}
        <Link href="/welcome">{t('privacy.aboutLink')}</Link>
        {after}
      </p>
    </section>
  );
}
