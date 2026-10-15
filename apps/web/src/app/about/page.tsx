import Link from 'next/link';
import { signInviteToken } from '@/lib/invitationToken';
import { Logo } from '@/components/Logo';

const SYNTHETIC_REFERENCE = 'inv-synthetic-pilot-001';

/**
 * Public landing page \u2014 explains that the app is invitation-only, then mints a synthetic
 * token at request time so the demo flow can be exercised without external infrastructure.
 *
 * M8 rebrand: header is the EvolAI wordmark, tagline is the brand line.
 */
export default function AboutPage() {
  const token = signInviteToken(SYNTHETIC_REFERENCE);
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
        Understand. Adapt. Evolve.
      </p>
      <h1 id="about-title" style={{ marginTop: 'var(--space-5)' }}>
        EvolAI \u2014 invitation-only
      </h1>
      <p>
        This survey is opened from a secure invitation link sent by your team referent. If you
        arrived here without a link, please contact your referent.
      </p>
      <p>
        <Link href={`/s/${token}`}>Open the synthetic sample survey (development only)</Link>
      </p>
      <p className="muted">
        See <Link href="/privacy">privacy notice</Link> for how your answers are handled.
      </p>
    </section>
  );
}
