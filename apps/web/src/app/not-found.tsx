import { getT } from '@/lib/i18n';

/** Unknown page or a broken invitation link: plain words and the one next action. */
export default function NotFound() {
  const { t } = getT();
  return (
    <section className="stack" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{t('common.notFoundTitle')}</h1>
      <p>{t('common.notFoundBody')}</p>
    </section>
  );
}
