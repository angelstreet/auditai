import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { engagementLabelFor, getAnalysis, listAuditLogForTarget } from '@/lib/auditorData';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { ApproveForm } from './ApproveForm';
import type { AnalysisId, EngagementId, TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; analysisId: string };
  searchParams: { tenant?: string };
}

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
};

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
  const tenants = await listTenantIds();
  if (tenants.length === 0) {
    return (
      <section aria-labelledby="empty-title" className="container admin">
        <Logo />
        <h1 id="empty-title">Analysis \u2014 no tenants</h1>
      </section>
    );
  }
  const requested = searchParams.tenant;
  const current = tenants.find((t) => t === requested) ?? tenants[0];
  if (!current) redirect('/admin/engagements');
  if (requested && tenants.find((t) => t === requested) === undefined) {
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
      <section aria-labelledby="missing-title" className="container admin">
        <Logo />
        <h1 id="missing-title">Analysis not found</h1>
        <p>
          <code>{params.analysisId}</code> is not in tenant <strong>{tenantName}</strong>. Go back
          to the{' '}
          <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
            analyses list
          </Link>
          .
        </p>
      </section>
    );
  }

  const themes = asThemes(detail.payload);
  const contradictions = asContradictions(detail.payload);
  const prompts = asPrompts(detail.payload);

  return (
    <section aria-labelledby="detail-title" className="container admin">
      <Logo />
      <h1 id="detail-title" style={{ marginTop: 'var(--space-4)' }}>
        Analysis \u2014 {detail.respondentPseudonym}
      </h1>
      <p className="muted">
        Engagement <strong>{label?.organisation ?? params.id}</strong> \u00b7 tenant{' '}
        <strong>{tenantName}</strong> \u00b7 sensitivity <strong>{detail.sensitivity}</strong>{' '}
        \u00b7 model route <code>{detail.modelRoute}</code>
      </p>
      <p>
        <Link href={`/admin/engagements/${params.id}/analyses?tenant=${tenantId}`}>
          \u2190 Back to analyses
        </Link>
      </p>

      <h2 style={{ marginTop: 'var(--space-5)' }}>Themes ({themes.length})</h2>
      {themes.length === 0 ? (
        <p className="muted">No themes in this analysis.</p>
      ) : (
        <ul>
          {themes.map((t) => (
            <li key={t.id}>
              <strong>{t.label}</strong> \u00b7 axis <code>{t.axis}</code> \u00b7 {t.evidenceCount}{' '}
              evidence claim(s). <span className="muted">{t.summary}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: 'var(--space-5)' }}>Contradictions ({contradictions.length})</h2>
      {contradictions.length === 0 ? (
        <p className="muted">No contradictions surfaced.</p>
      ) : (
        <ul>
          {contradictions.map((c, i) => (
            <li key={`${c.themeA}-${c.themeB}-${i}`}>
              <code>{c.themeA}</code> &harr; <code>{c.themeB}</code> \u2014 {c.explanation}
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: 'var(--space-5)' }}>Interview prompts ({prompts.length})</h2>
      {prompts.length === 0 ? (
        <p className="muted">No follow-up prompts proposed.</p>
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

      <h2 style={{ marginTop: 'var(--space-5)' }}>Evidence ({detail.evidence.length})</h2>
      <p className="muted">
        Every claim links back to a source row in the application (PRD \u00a710, FR-12). The auditor
        verifies the claim + the source before approving.
      </p>
      {detail.evidence.length === 0 ? (
        <p className="muted">No evidence claims.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Claim</th>
              <th scope="col">Source</th>
              <th scope="col">Quote</th>
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

      <h2 style={{ marginTop: 'var(--space-5)' }}>Approval</h2>
      {detail.approvedAt ? (
        <p>
          <strong>Approved</strong> at {formatDateTime(detail.approvedAt)} by{' '}
          <code>{detail.approvedBy}</code>.{' '}
          <Link
            href={`/admin/engagements/${params.id}/opportunities/new?tenant=${tenantId}&analysis=${analysisId}`}
          >
            Create opportunity from this analysis \u2192
          </Link>
        </p>
      ) : (
        <ApproveForm tenantId={tenantId} analysisId={analysisId} />
      )}

      <h2 style={{ marginTop: 'var(--space-5)' }}>Audit trail ({auditLog.length})</h2>
      {auditLog.length === 0 ? (
        <p className="muted">No audit log entries yet.</p>
      ) : (
        <ul>
          {auditLog.map((row) => (
            <li key={row.id}>
              <code>{formatDateTime(row.createdAt)}</code> \u00b7 <code>{row.action}</code> by{' '}
              <code>{row.actorUserId}</code> \u2014 payload{' '}
              <code>{JSON.stringify(row.payload)}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
