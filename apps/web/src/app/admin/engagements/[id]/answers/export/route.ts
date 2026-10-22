import { NextResponse, type NextRequest } from 'next/server';
import { createTranslator } from '@evolai/i18n';
import { AnswersGroupTooSmallError } from '@/lib/answersData';
import { answersCsv, mayReadAnswers } from '@/lib/answersExport';
import { getSession } from '@/lib/authServer';
import { getLocale } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CSV of one mission's answers: pseudonym, question, anonymised value, time (TASK-AD2). Staff
 * only, never view-as; refused below the minimum group with a plain sentence.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  const tenantId = req.nextUrl.searchParams.get('tenant') ?? '';
  if (!isUuid(params.id) || !isUuid(tenantId) || !mayReadAnswers(session, tenantId) || !session) {
    return new NextResponse(null, { status: 403 });
  }
  try {
    const csv = await answersCsv(tenantId as never, params.id, session.sub);
    return new NextResponse(`﻿${csv}`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="evolai-answers.csv"',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AnswersGroupTooSmallError) {
      const t = createTranslator(getLocale());
      return new NextResponse(t('admin.answers.tooFew', { n: MIN_GROUP_SIZE }), {
        status: 409,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    throw err;
  }
}
