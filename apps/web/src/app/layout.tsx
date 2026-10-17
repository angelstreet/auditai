import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Logo } from '@/components/Logo';
import { I18nProvider } from '@/components/I18nProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getT } from '@/lib/i18n';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://bai7w0jcu7s8e.space.minimax.io';

export function generateMetadata(): Metadata {
  const { t } = getT();
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      type: 'website',
      url: SITE_URL,
      siteName: 'EvolAI',
      images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: t('meta.ogAlt') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
      images: ['/brand/og.png'],
    },
    icons: { icon: '/brand/favicon.svg' },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = getT();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          <header
            style={{
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
            }}
          >
            <div
              className="container topbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                paddingTop: '12px',
                paddingBottom: '12px',
              }}
            >
              <Link
                href="/"
                aria-label={t('common.homeAria')}
                style={{ display: 'inline-flex', textDecoration: 'none', color: 'inherit' }}
              >
                <Logo />
              </Link>
              <nav
                aria-label={t('common.navPrimaryAria')}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  fontSize: '0.875rem',
                }}
              >
                <Link href="/about">{t('common.nav.about')}</Link>
                <Link href="/privacy">{t('common.nav.privacy')}</Link>
                <LanguageSwitcher />
              </nav>
            </div>
          </header>
          <main className="container">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
