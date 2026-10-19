import { describe, expect, it } from 'vitest';
import type { ReportSnapshot } from '@evolai/contracts';
import { createTranslator } from '@evolai/i18n';
import { renderReportPdf } from './reportPdf';
import { pdfFileName } from './reportPdfResponse';

const OPP = '0a000000-0000-4000-8000-00000000000a';
const snapshot: ReportSnapshot = {
  version: 2,
  locale: 'fr',
  title: 'Rapport d’audit — Demo Client',
  organisation: 'Demo Client',
  publishedAt: '2026-10-19T10:00:00.000Z',
  summary: 'Synthèse de démonstration. '.repeat(40),
  summaryCitations: ['practice|rapport'],
  readiness: {
    overall: {
      people: 12,
      overall: 48,
      level: 'L2',
      axes: [
        { axis: 'literacy', score: 40, level: 'L2' },
        { axis: 'practice', score: 50, level: 'L2' },
        { axis: 'readiness', score: null, level: null },
      ],
    },
    teams: [
      { team: 'Équipe A', people: 6, overall: 40, level: 'L2', axes: [] },
      { team: 'Équipe B', people: 6, overall: 56, level: 'L3', axes: [] },
    ],
    hiddenTeams: 1,
    weights: { literacy: 1 / 3, practice: 1 / 3, readiness: 1 / 3 },
    minGroupSize: 5,
  },
  findings: Array.from({ length: 12 }, (_, i) => ({
    key: i === 0 ? 'practice|rapport' : `practice|f${i}`,
    axis: 'practice',
    label: `Constat de démonstration numéro ${i + 1}`,
    people: 5 + i,
  })),
  opportunities: [
    {
      id: OPP,
      rank: 1,
      title: 'Automatiser le rapport',
      axis: 'practice',
      impact: 'high',
      effort: 'low',
      quadrant: 'quick_win',
    },
  ],
  steps: Array.from({ length: 8 }, (_, i) => ({
    id: `1a000000-0000-4000-8000-00000000000${i}`,
    opportunityId: OPP,
    title: `Action ${i + 1}`,
    description: 'Une description en mots simples. '.repeat(4),
    category: 'automate' as const,
    effort: 'low' as const,
    impact: 'high' as const,
    risk: 'low' as const,
    owner: 'Responsable des données',
    horizon: 'd30' as const,
    prerequisites: [],
  })),
  risks: ['Accès aux données'],
  prerequisites: ['Un outil autorisé'],
  plan: [
    { id: 'a', horizon: 'd30', text: 'Règles pour l’IA', owner: 'Sécurité' },
    {
      id: 'b',
      horizon: 'd90',
      text: 'Décider : garder, adapter ou arrêter',
      owner: 'Commanditaire',
    },
  ],
  methodology: 'Questionnaire anonyme.',
  minGroupSize: 5,
  catalogueVersion: '2026-10-19.1',
};

describe('report PDF', () => {
  it('renders a multi-page A4 PDF with the design font and page numbers, in fr and en', async () => {
    for (const locale of ['fr', 'en'] as const) {
      const pdf = await renderReportPdf(snapshot, createTranslator(locale), locale, {
        compress: false,
      });
      const raw = pdf.toString('latin1');
      expect(raw.startsWith('%PDF-')).toBe(true);
      const pages = (raw.match(/\/Type \/Page\b/g) ?? []).length;
      expect(pages).toBeGreaterThan(1);
      // Footers must not open extra pages (pdfkit adds one when text goes past the margin).
      expect(pages).toBeLessThanOrEqual(5);
      expect(raw).toMatch(/\/MediaBox \[0 0 595\.28 841\.89\]/);
      expect(raw).toMatch(/Inter/);
      expect(raw).not.toMatch(/Helvetica/);
      expect(pdf.byteLength).toBeLessThan(400_000);
    }
  });

  it('names the file from the title and version, safely', () => {
    expect(pdfFileName(snapshot)).toBe('rapport-d-audit-demo-client-v2.pdf');
    expect(pdfFileName({ title: '../../etc"', version: 1 })).toBe('etc-v1.pdf');
    expect(pdfFileName({ title: '—', version: 3 })).toBe('audit-report-v3.pdf');
  });
});
