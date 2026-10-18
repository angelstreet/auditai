import Link from 'next/link';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { getT } from '@/lib/i18n';
import type { TenantId } from '@evolai/contracts';

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
    <div className="wide">
      <section aria-labelledby="welcome-title" className="hero">
        <span className="eyebrow">{t('welcome.eyebrow')}</span>
        <h1 id="welcome-title">{t('welcome.heading')}</h1>
        <p className="lede">{t('welcome.lede')}</p>
        <ol className="steps card-list" aria-label={t('welcome.stepsAria')}>
          <li className="card">
            <strong>{t('welcome.step1Title')}</strong>
            <p>{t('welcome.step1Body')}</p>
          </li>
          <li className="card">
            <strong>{t('welcome.step2Title')}</strong>
            <p>{t('welcome.step2Body')}</p>
          </li>
          <li className="card">
            <strong>{t('welcome.step3Title')}</strong>
            <p>{t('welcome.step3Body')}</p>
          </li>
          <li className="card">
            <strong>{t('welcome.step4Title')}</strong>
            <p>{t('welcome.step4Body')}</p>
          </li>
        </ol>
        <p className="actions">
          <Link className="btn btn-primary" href={`/intake?tenant=${current}`}>
            {t('welcome.ctaIntake')}
          </Link>
          <Link className="btn btn-secondary" href={`/board`}>
            {t('welcome.ctaBoard')}
          </Link>
        </p>
        <p className="muted">{t('welcome.viewing', { label })}</p>
      </section>
    </div>
  );
}
