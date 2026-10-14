import Link from 'next/link';
import { signInviteToken } from '@/lib/invitationToken';

const SYNTHETIC_REFERENCE = 'inv-synthetic-pilot-001';

/**
 * Public landing page \u2014 explains that the app is invitation-only, then mints a synthetic
 * token at request time so the demo flow can be exercised without external infrastructure.
 */
export default function AboutPage() {
  const token = signInviteToken(SYNTHETIC_REFERENCE);
  return (
    <section aria-labelledby="about-title">
      <h1 id="about-title">auditAI \u2014 invitation-only</h1>
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
