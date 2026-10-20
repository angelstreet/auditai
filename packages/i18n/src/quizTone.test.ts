import { describe, expect, it } from 'vitest';
import { messages, quizItems, supportedLocales } from './index.js';

/** The optional quiz never grades: no wrong answers, no level, no "beginner" labels. */
const JUDGING =
  /mauvaise r[ée]ponse|bonne r[ée]ponse|wrong answer|right answer|d[ée]butez|d[ée]butant|beginner|starting out|novice|niveau|\blevel\b|prudente|cautious/i;

const strings = (node: unknown): string[] =>
  typeof node === 'string'
    ? [node]
    : Object.values(node as Record<string, unknown>).flatMap((v) => strings(v));

describe('quiz tone', () => {
  for (const locale of supportedLocales) {
    it(`${locale}: quiz intro, mascot labels and result copy never judge`, () => {
      const copy = [
        ...strings(messages[locale].quiz),
        ...strings(
          Object.fromEntries(
            Object.entries(messages[locale].survey).filter(([k]) => /quiz|mascot/i.test(k)),
          ),
        ),
        ...Object.values(quizItems[locale]).flatMap((i) => [i.prompt, ...Object.values(i.options)]),
      ];
      expect(copy.length).toBeGreaterThan(10);
      for (const text of copy) expect(text).not.toMatch(JUDGING);
    });
  }

  it('says what the quiz gives instead of "no wrong answer"', () => {
    expect(messages.fr.quiz.intro).toMatch(/mascotte/);
    expect(messages.en.quiz.intro).toMatch(/mascot/);
  });
});
