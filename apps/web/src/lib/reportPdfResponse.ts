import type { ReportSnapshot } from '@evolai/contracts';
import { getT } from './i18n';
import { renderReportPdf } from './reportPdf';

/** Safe file name: letters, digits and dashes only, from the report title and version. */
export const pdfFileName = (s: Pick<ReportSnapshot, 'title' | 'version'>): string => {
  const base = s.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'audit-report'}-v${s.version}.pdf`;
};

/** The PDF as a download, never cached by a shared cache. */
export const pdfResponse = async (snapshot: ReportSnapshot): Promise<Response> => {
  const { t, locale } = getT();
  const body = await renderReportPdf(snapshot, t, locale);
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFileName(snapshot)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
