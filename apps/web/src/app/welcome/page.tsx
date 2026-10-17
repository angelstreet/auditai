import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { getT } from '@/lib/i18n';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('meta.pages.welcome') };
}

export default async function WelcomePage() {
  const { t } = getT();
  const tenants = await listTenantIds();
  const current = (tenants[0] ?? '11111111-1111-4111-8111-111111111111') as TenantId;
  const label = tenants[0] ? await tenantLabel(current) : 'Synthetic Co A';
  return (
    <main className="container">
      <Logo />
      <section aria-labelledby="welcome-title" className="welcome-hero">
        <span className="eyebrow">{t('welcome.eyebrow')}</span>
        <h1 id="welcome-title">{t('welcome.heading')}</h1>
        <p className="lede">{t('welcome.lede')}</p>
        <ol className="steps" aria-label={t('welcome.stepsAria')}>
          <li>
            <strong>{t('welcome.step1Title')}</strong>
            <p>{t('welcome.step1Body')}</p>
          </li>
          <li>
            <strong>{t('welcome.step2Title')}</strong>
            <p>{t('welcome.step2Body')}</p>
          </li>
          <li>
            <strong>{t('welcome.step3Title')}</strong>
            <p>{t('welcome.step3Body')}</p>
          </li>
          <li>
            <strong>{t('welcome.step4Title')}</strong>
            <p>{t('welcome.step4Body')}</p>
          </li>
        </ol>
        <p className="cta-row">
          <Link className="btn btn-primary" href={`/intake?tenant=${current}`}>
            {t('welcome.ctaIntake')}
          </Link>
          <Link className="btn btn-ghost" href={`/board`}>
            {t('welcome.ctaBoard')}
          </Link>
        </p>
        <p className="muted">{t('welcome.viewing', { label })}</p>
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
