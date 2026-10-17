import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const tenants = await listTenantIds();
  const current = (tenants[0] ?? '11111111-1111-4111-8111-111111111111') as TenantId;
  const label = tenants[0] ? await tenantLabel(current) : 'Synthetic Co A';
  return (
    <main className="container">
      <Logo />
      <section aria-labelledby="welcome-title" className="welcome-hero">
        <span className="eyebrow">M12 — sponsor onboarding</span>
        <h1 id="welcome-title">
          Discover how work <em>really</em> happens. Build AI confidence. Turn friction into
          measurable improvements.
        </h1>
        <p className="lede">
          EvolAI walks every stakeholder from <strong>knowing yourself</strong> through audit,
          review and solution delivery. The welcome screen below is the front door of that journey —
          the entry point every client sponsor / team manager / auditor sees first.
        </p>
        <ol className="steps" aria-label="Four steps of the journey">
          <li>
            <strong>1 · Know yourself first</strong>
            <p>
              Short sponsor intake: AI requirements, budget envelope, security posture, current
              maturity.
            </p>
          </li>
          <li>
            <strong>2 · Audit people · teams · process</strong>
            <p>
              Mobile evidence capture from every employee; AI surfaces themes, contradictions,
              interview prompts.
            </p>
          </li>
          <li>
            <strong>3 · Review &amp; approve</strong>
            <p>
              Every AI claim is source-linked. The auditor approves; the model route + evidence
              trail is preserved.
            </p>
          </li>
          <li>
            <strong>4 · Solution · training · use cases</strong>
            <p>
              Opportunities tracked to delivery, with owner, pilot, measured benefits and cross-team
              synergies.
            </p>
          </li>
        </ol>
        <p className="cta-row">
          <Link className="btn btn-primary" href={`/intake?tenant=${current}`}>
            Start the intake
          </Link>
          <Link className="btn btn-ghost" href={`/board`}>
            See the portfolio board
          </Link>
        </p>
        <p className="muted">
          Viewing <strong>{label}</strong>. Use the tenant switcher on the admin pages to see the
          other synthetic tenant.
        </p>
      </section>
      <style>{`
        .welcome-hero { padding: 32px 0; max-width: 720px; }
        .welcome-hero h1 { font-size: 36px; line-height: 1.15; margin: 16px 0; }
        .welcome-hero .lede { font-size: 17px; line-height: 1.5; color: var(--color-muted); }
        .eyebrow { display: inline-block; padding: 4px 10px; background: var(--color-brand-teal);
          color: var(--color-brand-off-white); border-radius: 999px; font-size: 12px;
          font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .eyebrow + h1 em { color: var(--color-brand-teal); font-style: normal; }
        .steps { padding-left: 0; list-style: none; }
        .steps li { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
        .steps li strong { display: block; margin-bottom: 4px; }
        .steps li p { margin: 0; color: var(--color-muted); font-size: 14px; }
        .cta-row { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
        .btn { display: inline-block; padding: 10px 18px; border-radius: 8px;
          text-decoration: none; font-weight: 500; }
        .btn-primary { background: var(--color-brand-navy); color: var(--color-brand-off-white); }
        .btn-ghost { background: transparent; color: var(--color-brand-navy);
          border: 1px solid var(--color-border); }
        .muted { color: var(--color-muted); font-size: 14px; }
      `}</style>
    </main>
  );
}
