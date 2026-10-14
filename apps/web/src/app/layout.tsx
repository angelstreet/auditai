import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'auditAI \u2014 AI adoption survey',
  description: 'Short mobile questionnaire about how work really happens.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
