import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { engagementLabelFor } from '@/lib/auditorData';
import { answersViewFor } from '@/lib/answersData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import type { EngagementId, TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { tenant?: string };
}

/**
 * Read-only answers for the auditor (TASK-AA): counts per choice and the anonymised free texts,
 * with no link to a person, and only once the minimum group has submitted. Staff only: the
 * staff session guard sends a referent (or a view-as) to the client surface.
 */
export default async function AnswersPage({ params, searchParams }: PageProps) {
  const { t } = getT();
  const tenants = await sessionTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="wide admin">
        <h1 id="empty-title">{t('admin.common.noTenantsTitle')}</h1>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((x) => x === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((x) => x === requested) === undefined) {
    redirect(`/admin/engagements/${params.id}/answers?tenant=${current}`);
  }
  const tenantId = current as TenantId;
  const engagementId = params.id as EngagementId;
  const [label, tenantName] = await Promise.all([
    engagementLabelFor(tenantId, engagementId),
    tenantLabel(tenantId),
  ]);
  if (!label) {
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.common.engagementNotFound')}</h1>
        <p>
          {t('admin.common.notInTenant', { id: params.id, tenant: tenantName })}{' '}
          <Link href={`/admin/engagements?tenant=${tenantId}`}>
            {t('admin.common.backToEngagements')}
          </Link>
        </p>
      </section>
    );
  }
  const view = await answersViewFor(tenantId, engagementId);

  return (
    <section aria-labelledby="answers-title" className="wide admin">
      <h1 id="answers-title">{t('admin.answers.title', { org: label.organisation })}</h1>
      <p>
        <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
          {t('admin.common.backToAnalyses')}
        </Link>
        {' · '}
        <Link href={`/admin/data?tenant=${tenantId}`}>{t('admin.answers.export')}</Link>
      </p>
      {'tooFew' in view ? (
        <p role="status">
          {t('admin.answers.tooFew', { min: MIN_GROUP_SIZE, have: view.tooFew })}
        </p>
      ) : (
        <>
          <p className="muted">{t('admin.answers.intro', { n: view.submitted })}</p>
          <h2>{t('admin.answers.choicesTitle')}</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('admin.answers.colQuestion')}</th>
                <th scope="col">{t('admin.answers.colChoice')}</th>
                <th scope="col">{t('admin.answers.colCount')}</th>
              </tr>
            </thead>
            <tbody>
              {view.choices.flatMap((q) =>
                q.counts.map((c, i) => (
                  <tr key={`${q.code}-${c.label}`}>
                    {i === 0 ? (
                      <th scope="row" rowSpan={q.counts.length}>
                        {q.question}
                      </th>
                    ) : null}
                    <td>{c.label}</td>
                    <td>{c.n}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
          <h2>{t('admin.answers.textsTitle')}</h2>
          {view.texts.length === 0 ? <p>{t('admin.answers.noTexts')}</p> : null}
          {view.texts.map((q) => (
            <div key={q.code}>
              <h3>{q.code === 'end_comment' ? t('admin.answers.endComment') : q.question}</h3>
              <ul>
                {q.items.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
