'use server';

/**
 * "Run analysis" server action (TASK-AA). The actor and the tenant come from the signed session
 * (`resolveActor` refuses a referent, a view-as and another organisation); the form's ids are only
 * selectors. The data layer writes the audit entry and refuses below the minimum group.
 */

import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import { runAnalysis } from '@/lib/analysisRun';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import type { EngagementId } from '@evolai/contracts';

export interface RunActionState {
  ok: boolean;
  message: string;
  /** Plain-words line naming the method used, shown when the run went through. */
  method?: string;
}

const isUuid = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function runAnalysisAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const engagementId = String(formData.get('engagementId') ?? '');
  if (!isUuid(tenantId) || !isUuid(engagementId)) {
    return { ok: false, message: t('admin.analyses.run.notFound') };
  }
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };

  try {
    const out = await runAnalysis(who.tenantId, engagementId as EngagementId, who.actor);
    if (!out.ok) {
      switch (out.code) {
        case 'too_few':
          return {
            ok: false,
            message: t('admin.analyses.run.tooFew', { n: MIN_GROUP_SIZE, have: out.have }),
          };
        case 'no_route':
          return { ok: false, message: t('admin.analyses.run.noRoute') };
        case 'not_found':
          return { ok: false, message: t('admin.analyses.run.notFound') };
        default:
          return { ok: false, message: t('admin.analyses.run.failed') };
      }
    }
    revalidatePath('/admin/engagements/[id]/analyses', 'page');
    const message =
      out.analysed === 0 && out.remaining === 0
        ? t('admin.analyses.run.nothingNew', { total: out.total })
        : t('admin.analyses.run.done', { analysed: out.analysed, themes: out.themes }) +
          (out.remaining > 0 ? t('admin.analyses.run.partial', { remaining: out.remaining }) : '');
    return {
      ok: true,
      message,
      method:
        t('admin.analyses.run.method', { route: out.route }) +
        (out.ruleBased ? ` ${t('admin.analyses.run.ruleBased')}` : ''),
    };
  } catch (err) {
    console.error('run analysis failed', err instanceof Error ? err.name : 'error');
    return { ok: false, message: t('admin.analyses.run.failed') };
  }
}
