import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import AppProviders from '@/components/chrome/AppProviders';
import SiteFooter from '@/components/chrome/SiteFooter';
import SiteHeader from '@/components/chrome/SiteHeader';
import ViewAsBanner from '@/components/chrome/ViewAsBanner';
import { I18nProvider } from '@/components/I18nProvider';
import RouteFocus from '@/components/RouteFocus';
import { getT } from '@/lib/i18n';
import { THEME_INIT_SCRIPT, getThemeChoice } from '@/lib/theme';

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
  const choice = getThemeChoice();
  return (
    // data-theme comes from the cookie; without one the inline script fills it from the system
    // scheme before the first paint (ADR 0034). suppressHydrationWarning covers that attribute.
    <html lang={locale} data-theme={choice ?? undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppProviders choice={choice}>
          <I18nProvider locale={locale}>
            <a className="skip-link" href="#main">
              {t('common.skipToContent')}
            </a>
            <RouteFocus />
            <SiteHeader />
            <ViewAsBanner />
            <main id="main" tabIndex={-1} className="container">
              {children}
            </main>
            <SiteFooter />
          </I18nProvider>
        </AppProviders>
      </body>
    </html>
  );
}
