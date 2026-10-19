/**
 * Deterministic stand-in for a model (TASK-H). It reads the survey data block from the prompt
 * and answers with JSON that follows the output contract: one fact per answer quoting the
 * answer's leading sentences, themes from a small FR/EN keyword list, one interview question per
 * theme and an opportunity for automation themes. It exists so tests, CI and `pnpm ai:eval`
 * exercise the whole pipeline with no network and no key.
 */
import { extractSurveyData, type ModelOutput, type PromptAnswer } from './prompt.js';

interface Lexeme {
  readonly id: string;
  readonly re: RegExp;
  readonly fr: string;
  readonly en: string;
  readonly automatable: boolean;
}

export const MOCK_THEMES: ReadonlyArray<Lexeme> = [
  {
    id: 'repetitive-work',
    re: /r[ée]p[ée]titi|copi|coller|copy|paste|manual|manuel|à la main|by hand|ressaisi|re-?typ/i,
    fr: 'Tâches répétitives',
    en: 'Repetitive work',
    automatable: true,
  },
  {
    id: 'time-pressure',
    re: /heures?|hours?|minutes?|temps|time|semaine|week/i,
    fr: 'Temps passé',
    en: 'Time spent',
    automatable: true,
  },
  {
    id: 'data-care',
    re: /donn[ée]es|data|confidenti|client|personnel|personal|rgpd|gdpr/i,
    fr: 'Soin des données',
    en: 'Care with data',
    automatable: false,
  },
  {
    id: 'checking-output',
    re: /v[ée]rifi|check|relis|review|erreur|mistake|wrong|faux/i,
    fr: 'Vérification des résultats',
    en: 'Checking results',
    automatable: false,
  },
  {
    id: 'training-need',
    re: /formation|training|apprendre|learn|tutoriel|tutorial|aide|help/i,
    fr: 'Besoin de formation',
    en: 'Training need',
    automatable: false,
  },
];

/** The answer's leading sentences, up to 240 characters, cut at a sentence end when possible. */
const leadingQuote = (text: string): string => {
  if (text.length <= 240) return text;
  const sentences = text.split(/(?<=[.!?;])\s/);
  let quote = '';
  for (const s of sentences) {
    const next = quote ? `${quote} ${s}` : s;
    if (next.length > 240) break;
    quote = next;
  }
  return quote || text.slice(0, 240);
};

export const buildFixtureOutput = (
  locale: string,
  answers: ReadonlyArray<PromptAnswer>,
): ModelOutput => {
  const fr = locale === 'fr';
  const facts: ModelOutput['facts'][number][] = [];
  answers.forEach((a, i) => {
    if (a.answer.trim().length === 0) return;
    const quote = leadingQuote(a.answer);
    const num = /\d+(?:[.,]\d+)?/.exec(quote.replace(/\[[A-Z]+_\d+\]/g, ' '));
    facts.push({
      id: `f${i + 1}`,
      statement: quote,
      sourceId: a.id,
      quote,
      number: num ? { value: num[0], unit: '', kind: 'other' } : null,
    });
  });

  const themes: ModelOutput['themes'][number][] = [];
  for (const lx of MOCK_THEMES) {
    const ids = facts.filter((f) => lx.re.test(f.quote)).map((f) => f.id);
    if (ids.length === 0) continue;
    themes.push({
      id: lx.id,
      label: fr ? lx.fr : lx.en,
      axis: answers.find((a) => a.id === facts.find((f) => f.id === ids[0])?.sourceId)?.axis ?? '',
      summary: fr ? `${lx.fr} : cité par la personne.` : `${lx.en}: raised by the respondent.`,
      factIds: ids,
    });
  }

  const never = facts.find((f) => /\b(jamais|never)\b/i.test(f.quote));
  const always = facts.find((f) => /\b(toujours|always)\b/i.test(f.quote));
  const contradictions =
    never && always && never.id !== always.id
      ? [
          {
            factA: always.id,
            factB: never.id,
            explanation: fr
              ? 'Une réponse dit « toujours », une autre dit « jamais ».'
              : 'One answer says "always", another says "never".',
          },
        ]
      : [];

  const interviewQuestions = themes.map((t, i) => ({
    id: `q${i + 1}`,
    question: fr
      ? `Pouvez-vous raconter un exemple récent : ${t.label.toLowerCase()} ?`
      : `Can you walk me through a recent example of: ${t.label.toLowerCase()}?`,
    rationale: fr ? 'Confirmer le thème avec un cas réel.' : 'Confirm the theme with a real case.',
    themeId: t.id,
  }));

  const opportunities = themes
    .filter((t) => MOCK_THEMES.find((lx) => lx.id === t.id)?.automatable)
    .map((t, i) => ({
      id: `o${i + 1}`,
      title: fr ? `Simplifier : ${t.label.toLowerCase()}` : `Simplify: ${t.label.toLowerCase()}`,
      description: fr
        ? 'Piste à valider en entretien ; les volumes restent déclaratifs.'
        : 'Idea to check in an interview; volumes stay self-reported.',
      themeId: t.id,
      factIds: t.factIds,
    }));

  return { facts, themes, contradictions, interviewQuestions, opportunities };
};

// ---- Audit report summary (TASK-V, ADR 0043) -------------------------------------------------

/** Pull the data back out of a report prompt (used by the mock provider). */
export const extractReportData = (
  user: string,
): {
  locale: string;
  findings: Array<{ id: string; label: string; people: number }>;
  opportunities: Array<{ rank: number; title: string }>;
} | null => {
  const m = /<<<REPORT_DATA ([\w-]+)\n([\s\S]*?)\n>>>REPORT_DATA \1/.exec(user);
  if (!m?.[2]) return null;
  const locale = /^locale: (fr|en)$/m.exec(user)?.[1] ?? 'en';
  return { locale, ...(JSON.parse(m[2]) as { findings: []; opportunities: [] }) };
};

/** Deterministic stand-in answer for the mock route: grounded, cited, numbers from the data. */
export const reportFixtureResponder = (user: string): string => {
  const data = extractReportData(user);
  if (!data) return '{}';
  const fr = data.locale === 'fr';
  const sentences = data.findings.slice(0, 2).map((f) => ({
    text: fr
      ? `${f.people} personnes signalent\u00a0: ${f.label}.`
      : `${f.people} people raise: ${f.label}.`,
    cites: [f.id],
  }));
  const first = data.opportunities[0];
  const lead = data.findings[0];
  if (first && lead) {
    sentences.push({
      text: fr
        ? `Première étape conseillée\u00a0: ${first.title}.`
        : `Recommended first step: ${first.title}.`,
      cites: [lead.id],
    });
  }
  return JSON.stringify({ sentences });
};

export const fixtureResponder = (user: string): string => {
  if (user.includes('<<<REPORT_DATA ')) return reportFixtureResponder(user);
  const { locale, answers } = extractSurveyData(user);
  return JSON.stringify(buildFixtureOutput(locale, answers));
};
