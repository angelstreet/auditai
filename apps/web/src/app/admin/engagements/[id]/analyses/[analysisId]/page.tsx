import { redirect } from 'next/navigation';
import Link from 'next/link';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate } from '@evolai/i18n';

import { engagementLabelFor, getAnalysis, listAuditLogForTarget } from '@/lib/auditorData';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { ApproveForm } from './ApproveForm';
import type { AnalysisId, EngagementId, TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; analysisId: string };
  searchParams: { tenant?: string };
}

interface ThemeView {
  id: string;
  label: string;
  axis: string;
  summary: string;
  evidenceCount: number;
}
interface ContradictionView {
  themeA: string;
  themeB: string;
  explanation: string;
}
interface InterviewPromptView {
  id: string;
  prompt: string;
  rationale: string;
  themeId: string;
}

const asThemes = (payload: unknown): ThemeView[] => {
  if (!payload || typeof payload !== 'object') return [];
  const themes = (payload as { themes?: unknown }).themes;
  if (!Array.isArray(themes)) return [];
  return themes.flatMap((t: unknown) => {
    if (!t || typeof t !== 'object') return [];
    const x = t as Record<string, unknown>;
    const id = typeof x['id'] === 'string' ? (x['id'] as string) : null;
    const label = typeof x['label'] === 'string' ? (x['label'] as string) : null;
    const axis = typeof x['axis'] === 'string' ? (x['axis'] as string) : null;
    const summary = typeof x['summary'] === 'string' ? (x['summary'] as string) : null;
    const ev = Array.isArray(x['evidence']) ? (x['evidence'] as unknown[]) : [];
    if (!id || !label || !axis || !summary) return [];
    return [{ id, label, axis, summary, evidenceCount: ev.length }];
  });
};
const asContradictions = (payload: unknown): ContradictionView[] => {
  if (!payload || typeof payload !== 'object') return [];
  const list = (payload as { contradictions?: unknown }).contradictions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((c: unknown) => {
    if (!c || typeof c !== 'object') return [];
    const x = c as Record<string, unknown>;
    if (
      typeof x['themeA'] !== 'string' ||
      typeof x['themeB'] !== 'string' ||
      typeof x['explanation'] !== 'string'
    ) {
      return [];
    }
    return [
      {
        themeA: x['themeA'] as string,
        themeB: x['themeB'] as string,
        explanation: x['explanation'] as string,
      },
    ];
  });
};
const asPrompts = (payload: unknown): InterviewPromptView[] => {
  if (!payload || typeof payload !== 'object') return [];
  const list = (payload as { interviewPrompts?: unknown }).interviewPrompts;
  if (!Array.isArray(list)) return [];
  return list.flatMap((p: unknown) => {
    if (!p || typeof p !== 'object') return [];
    const x = p as Record<string, unknown>;
    if (
      typeof x['id'] !== 'string' ||
      typeof x['prompt'] !== 'string' ||
      typeof x['rationale'] !== 'string' ||
      typeof x['themeId'] !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: x['id'] as string,
        prompt: x['prompt'] as string,
        rationale: x['rationale'] as string,
        themeId: x['themeId'] as string,
      },
    ];
  });
};

export default async function AnalysisDetailPage({ params, searchParams }: PageProps) {
  const { t, locale } = getT();
  const formatDateTime = (iso: string | null): string =>
    iso ? formatDate(locale, iso, { dateStyle: 'medium', timeStyle: 'short' }) : t('common.dash');
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
    redirect(`/admin/engagements/${params.id}/analyses/${params.analysisId}?tenant=${current}`);
  }
  const tenantId = current as TenantId;
  const engagementId = params.id as EngagementId;
  const analysisId = params.analysisId as AnalysisId;

  const [detail, label, auditLog, tenantName] = await Promise.all([
    getAnalysis(tenantId, analysisId),
    engagementLabelFor(tenantId, engagementId),
    listAuditLogForTarget(tenantId, 'analysis', analysisId, 25),
    tenantLabel(tenantId),
  ]);

  if (!detail) {
    return (
      <section aria-labelledby="missing-title" className="wide admin">
        <h1 id="missing-title">{t('admin.analysis.notFound')}</h1>
        <p>
          {t('admin.analysis.notFoundBody', {
            id: params.analysisId,
            tenant: tenantName,
            link: t('admin.analysis.listLink'),
          })}{' '}
          <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
            {t('admin.common.backToAnalyses')}
          </Link>
        </p>
      </section>
    );
  }

  const themes = asThemes(detail.payload);
  const contradictions = asContradictions(detail.payload);
  const prompts = asPrompts(detail.payload);

  return (
    <section aria-labelledby="detail-title" className="wide admin">
      <h1 id="detail-title">
        {t('admin.analysis.title', { pseudonym: detail.respondentPseudonym })}
      </h1>
      <p className="muted">
        {t('admin.analysis.meta', {
          org: label?.organisation ?? params.id,
          tenant: tenantName,
          sensitivity: enumLabel(t, 'sensitivity', detail.sensitivity),
          route: detail.modelRoute,
        })}
      </p>
      <p>
        <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
          {t('admin.common.backToAnalyses')}
        </Link>
      </p>

      <h2 className="section-title">{t('admin.analysis.themes', { n: themes.length })}</h2>
      {themes.length === 0 ? (
        <p className="muted">{t('admin.analysis.noThemes')}</p>
      ) : (
        <ul>
          {themes.map((th) => (
            <li key={th.id}>
              <strong>{th.label}</strong> ·{' '}
              {t('admin.analysis.themeLine', {
                axis: enumLabel(t, 'axis', th.axis),
                n: th.evidenceCount,
              })}{' '}
              <span className="muted">{th.summary}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">
        {t('admin.analysis.contradictions', { n: contradictions.length })}
      </h2>
      {contradictions.length === 0 ? (
        <p className="muted">{t('admin.analysis.noContradictions')}</p>
      ) : (
        <ul>
          {contradictions.map((c, i) => (
            <li key={`${c.themeA}-${c.themeB}-${i}`}>
              <code>{c.themeA}</code> &harr; <code>{c.themeB}</code> — {c.explanation}
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">{t('admin.analysis.prompts', { n: prompts.length })}</h2>
      {prompts.length === 0 ? (
        <p className="muted">{t('admin.analysis.noPrompts')}</p>
      ) : (
        <ul>
          {prompts.map((p) => (
            <li key={p.id}>
              <strong>{p.prompt}</strong>
              <br />
              <span className="muted">{p.rationale}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">
        {t('admin.analysis.evidence', { n: detail.evidence.length })}
      </h2>
      <p className="muted">{t('admin.analysis.evidenceNote')}</p>
      {detail.evidence.length === 0 ? (
        <p className="muted">{t('admin.analysis.noEvidence')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('admin.analysis.colClaim')}</th>
              <th scope="col">{t('admin.analysis.colSource')}</th>
              <th scope="col">{t('admin.analysis.colQuote')}</th>
            </tr>
          </thead>
          <tbody>
            {detail.evidence.map((c) => (
              <tr key={c.sourceId}>
                <td>{c.claim}</td>
                <td>
                  <code>{c.sourceKind}</code> / <code>{c.sourceId}</code>
                </td>
                <td>
                  <code>{c.quote}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">{t('admin.analysis.approval')}</h2>
      {detail.approvedAt ? (
        <p>
          {t('admin.analysis.approvedAt', {
            when: formatDateTime(detail.approvedAt),
            who: String(detail.approvedBy),
          })}{' '}
          <Link
            href={`/admin/engagements/${params.id}/opportunities/new?tenant=${tenantId}&analysis=${analysisId}`}
          >
            {t('admin.analysis.createOpp')}
          </Link>
        </p>
      ) : (
        <ApproveForm tenantId={tenantId} analysisId={analysisId} />
      )}

      <h2 className="section-title">{t('admin.analysis.auditTrail', { n: auditLog.length })}</h2>
      {auditLog.length === 0 ? (
        <p className="muted">{t('admin.analysis.noAudit')}</p>
      ) : (
        <ul>
          {auditLog.map((row) => (
            <li key={row.id}>
              {t('admin.analysis.auditLine', {
                when: formatDateTime(row.createdAt),
                action: row.action,
                actor: String(row.actorUserId),
                payload: JSON.stringify(row.payload),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
