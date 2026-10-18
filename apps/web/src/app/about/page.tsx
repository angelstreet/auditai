import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { getT } from '@/lib/i18n';
import { aroundLink } from '@/lib/richText';

export function generateMetadata() {
  return { title: getT().t('meta.pages.about') };
}

/** Public page: explains that the survey is reached from an invitation link. */
export default function AboutPage() {
  const { t } = getT();
  const [before, after] = aroundLink((vars) => t('about.seePrivacy', vars));
  return (
    <section aria-labelledby="about-title">
      <Logo size="hero" />
      <p className="tagline">{t('common.tagline')}</p>
      <h1 id="about-title" className="section-title">
        {t('about.title')}
      </h1>
      <p>{t('about.body')}</p>
      <p className="muted">
        {before}
        <Link href="/privacy">{t('about.privacyLink')}</Link>
        {after}
      </p>
    </section>
  );
}
