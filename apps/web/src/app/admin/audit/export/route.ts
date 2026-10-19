import { NextResponse, type NextRequest } from 'next/server';
import { createTranslator, type MessageKey } from '@evolai/i18n';
import { getLocale } from '@/lib/i18n';
import { actionKey, listAuditTrail, parseDay, parseGroup } from '@/lib/auditTrail';
import { getSession } from '@/lib/authServer';
import { isUuid } from '@/lib/invitationForm';
import { toCsv } from '@/lib/invitationTracking';
import { isTenantAllowed } from '@/lib/tenantAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CSV of the audit trail: date, who, what. Never the payload. Session-checked here as well as by
 * the middleware; same filters as the screen (TASK-U, ADR 0039).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const q = req.nextUrl.searchParams;
  const tenantId = q.get('tenant') ?? '';
  if (!session || !isUuid(tenantId) || !isTenantAllowed(session, tenantId)) {
    return new NextResponse(null, { status: 403 });
  }
  const t = createTranslator(getLocale());
  const { entries } = await listAuditTrail(tenantId as never, {
    group: parseGroup(q.get('group') ?? undefined),
    from: parseDay(q.get('from') ?? undefined),
    to: parseDay(q.get('to') ?? undefined),
  });
  const what = (action: string): string => {
    const key = `trust.audit.action.${actionKey(action)}` as MessageKey;
    const text = t(key);
    return text === key ? t('trust.audit.unknown') : text;
  };
  const csv = toCsv(
    [t('trust.audit.csvWhen'), t('trust.audit.colWho'), t('trust.audit.colWhat')],
    entries.map((e) => [e.at.replace('T', ' ').slice(0, 19), e.who, what(e.action)]),
  );
  return new NextResponse(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="audit-trail.csv"',
      'cache-control': 'no-store',
    },
  });
}
