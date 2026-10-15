import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { Logo } from '@/components/Logo';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://bai7w0jcu7s8e.space.minimax.io';

export const metadata = {
  title: 'EvolAI — Understand. Adapt. Evolve.',
  description:
    'Open-source evidence-based AI adoption audits. Privacy-first, tenant-isolated, AI-open.',
  openGraph: {
    title: 'EvolAI — Understand. Adapt. Evolve.',
    description:
      'Open-source evidence-based AI adoption audits. Privacy-first, tenant-isolated, AI-open.',
    type: 'website',
    url: SITE_URL,
    siteName: 'EvolAI',
    images: [
      {
        url: '/brand/og.png',
        width: 1200,
        height: 630,
        alt: 'EvolAI wordmark with adaptive-steps symbol',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EvolAI — Understand. Adapt. Evolve.',
    description:
      'Open-source evidence-based AI adoption audits. Privacy-first, tenant-isolated, AI-open.',
    images: ['/brand/og.png'],
  },
  icons: {
    icon: '/brand/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
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
              paddingTop: '12px',
              paddingBottom: '12px',
            }}
          >
            <Link
              href="/"
              aria-label="EvolAI home"
              style={{ display: 'inline-flex', textDecoration: 'none', color: 'inherit' }}
            >
              <Logo />
            </Link>
            <nav
              aria-label="primary"
              style={{ display: 'flex', gap: 'var(--space-3)', fontSize: '0.875rem' }}
            >
              <Link href="/about">About</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
