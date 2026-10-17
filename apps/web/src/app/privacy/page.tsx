import Link from 'next/link';
import { Logo } from '@/components/Logo';
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
      <Logo />
      <h1 id="privacy-title" style={{ marginTop: 'var(--space-4)' }}>
        {t('privacy.title')}
      </h1>
      <p>{t('privacy.p1')}</p>
      <p>{t('privacy.p2')}</p>
      <p>
        {before}
        <Link href="/about">{t('privacy.aboutLink')}</Link>
        {after}
      </p>
    </section>
  );
}
