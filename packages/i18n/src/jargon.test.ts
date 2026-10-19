import { describe, expect, it } from 'vitest';
import { messages } from './index.js';

/**
 * No internal vocabulary on screen (TASK-T, ADR 0038, docs/UI_RULES.md §8). Every string in the
 * French and English catalogs is checked, placeholders removed so variable names do not count.
 * A word that really is needed somewhere goes in a catalog key that this test never reads.
 */
/** `skip` keeps a rule off a namespace owned by another task (the team space copy, TASK-S). */
const BANNED: ReadonlyArray<[string, RegExp, RegExp?]> = [
  ['tenant', /\btenants?\b/i],
  ['locataire', /\blocataires?\b/i],
  ['model route', /\bmodel route\b|\broute du mod[eè]le\b/i],
  ['smoke', /\bsmoke\b/i],
  ['PRD / FR- reference', /\bPRD\b|§|\bFR-\d+/],
  ['Gate B', /\bgate b\b|\bporte b\b/i],
  ['pseudonym', /pseudonym/i],
  ['Taux de réalisation', /taux de r[ée]alisation/i],
  ['raw id', /\b(ids?|uuids?)\b|identifiants?\b/i],
  ['tie-break rule in text', /ties go to|[ée]galit[ée]\s*:\s*renard/i],
  ['Fewer than N', /\bfewer than\b|\bmoins de \d/i, /^client\./],
  ['redactor', /\bredactor\b|\brédacteur\b/i],
];

const strip = (s: string): string => s.replace(/\{[^{}]*\}/g, '');

const walk = (node: unknown, path: string, out: Array<[string, string]>): void => {
  if (typeof node === 'string') out.push([path, node]);
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out);
  }
};

describe('jargon in the catalogs', () => {
  for (const locale of ['en', 'fr'] as const) {
    it(`has no banned word in ${locale}`, () => {
      const all: Array<[string, string]> = [];
      walk(messages[locale], '', all);
      const hits = all.flatMap(([key, text]) =>
        BANNED.filter(([, re, skip]) => !skip?.test(key) && re.test(strip(text))).map(
          ([name]) => `${key} (${name})`,
        ),
      );
      expect(hits).toEqual([]);
    });
  }

  it('does not show raw placeholders for ids', () => {
    const all: Array<[string, string]> = [];
    walk(messages.en, '', all);
    walk(messages.fr, '', all);
    const bad = all.filter(([, text]) => /\{(id|tenantId|invitationId|engagementId)\}/.test(text));
    expect(bad.map(([k]) => k)).toEqual([]);
  });
});
