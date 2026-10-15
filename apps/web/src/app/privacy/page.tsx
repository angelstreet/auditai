import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function PrivacyPage() {
  return (
    <section aria-labelledby="privacy-title">
      <Logo />
      <h1 id="privacy-title" style={{ marginTop: 'var(--space-4)' }}>
        Privacy notice (synthetic)
      </h1>
      <p>
        EvolAI is designed to assess work practices and improvement opportunities, not to rank
        employees. The platform stores a non-identifying pseudonym rather than your name; the
        referent sees completion statistics, never individual answers, unless explicitly granted
        that access.
      </p>
      <p>
        Your organisation controls retention. You can withdraw your submission at any time by
        contacting your team referent; the data will be deleted within the agreed retention window.
      </p>
      <p>
        See <Link href="/about">the about page</Link> for the synthetic sample.
      </p>
    </section>
  );
}
