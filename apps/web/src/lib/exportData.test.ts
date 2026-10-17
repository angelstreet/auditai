import { describe, expect, it } from 'vitest';
import { neutraliseFormula, rowsToCsv } from './exportData';

describe('CSV formula-injection guard (FR-09)', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('prefixes %j with a quote', (c) => {
    expect(neutraliseFormula(c)).toBe(`'${c}`);
  });

  it('leaves ordinary text alone', () => {
    expect(neutraliseFormula('hello = world')).toBe('hello = world');
    expect(neutraliseFormula('')).toBe('');
    expect(neutraliseFormula(null)).toBe('');
  });

  it('keeps real negative numbers readable', () => {
    expect(neutraliseFormula(-5)).toBe('-5');
    expect(rowsToCsv(['n'], [[-5], [0.25]])).toBe('n\n-5\n0.25\n');
  });

  it('neutralises a negative-looking string (text type) and still quotes commas', () => {
    expect(rowsToCsv(['t'], [['-5'], ['=HYPERLINK("x","y"),z']])).toBe(
      `t\n'-5\n"'=HYPERLINK(""x"",""y""),z"\n`,
    );
  });
});
