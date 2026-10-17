import Link from 'next/link';
import { signInviteToken } from '@/lib/invitationToken';
import { Logo } from '@/components/Logo';
import { getT } from '@/lib/i18n';
import { aroundLink } from '@/lib/richText';

export function generateMetadata() {
  return { title: getT().t('meta.pages.about') };
}

const SYNTHETIC_REFERENCE = 'inv-synthetic-pilot-001';

/**
 * Public landing page \u2014 explains that the app is invitation-only, then mints a synthetic
 * token at request time so the demo flow can be exercised without external infrastructure.
 *
 * M8 rebrand: header is the EvolAI wordmark, tagline is the brand line.
 */
export default function AboutPage() {
  const { t } = getT();
  const token = signInviteToken(SYNTHETIC_REFERENCE);
  const [before, after] = aroundLink((vars) => t('about.seePrivacy', vars));
  return (
    <section aria-labelledby="about-title">
      <Logo size="hero" />
      <p
        style={{
          marginTop: 'var(--space-3)',
          color: 'var(--color-brand-supporting)',
          fontSize: '0.95rem',
          letterSpacing: '0.02em',
        }}
      >
        {t('common.tagline')}
      </p>
      <h1 id="about-title" style={{ marginTop: 'var(--space-5)' }}>
        {t('about.title')}
      </h1>
      <p>{t('about.body')}</p>
      <p>
        <Link href={`/s/${token}`}>{t('about.sample')}</Link>
      </p>
      <p className="muted">
        {before}
        <Link href="/privacy">{t('about.privacyLink')}</Link>
        {after}
      </p>
    </section>
  );
}
