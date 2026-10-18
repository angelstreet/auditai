import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Design-token contract (ADR 0025): brand palette present, and every text/background role the
 * components use meets WCAG 2.2 AA (4.5:1 text, 3:1 control edges).
 */

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const decls = new Map(
  [...css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
    m[1] as string,
    (m[2] as string).trim(),
  ]),
);

const resolve = (name: string): string => {
  const value = decls.get(name);
  if (!value) throw new Error(`missing token ${name}`);
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
  return ref ? resolve(ref[1] as string) : value;
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(resolve(a)), luminance(resolve(b))].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

describe('design tokens', () => {
  it('carry the brand palette from the brand kit', () => {
    expect(resolve('--color-navy')).toBe('#172b3a');
    expect(resolve('--color-teal')).toBe('#19a999');
    expect(resolve('--color-blue')).toBe('#4a7fe8');
    expect(resolve('--color-amber')).toBe('#ffb86a');
    expect(resolve('--color-off-white')).toBe('#f7fafc');
    expect(resolve('--color-slate')).toBe('#536575');
  });

  it.each([
    ['--color-fg', '--color-bg'],
    ['--color-fg', '--color-surface'],
    ['--color-muted', '--color-bg'],
    ['--color-muted', '--color-surface'],
    ['--color-accent-fg', '--color-accent'],
    ['--color-on-highlight', '--color-highlight'],
    ['--color-teal-ink', '--color-bg'],
    ['--color-danger', '--color-bg'],
    ['--color-white', '--color-slate'],
    ['--color-navy', '--color-amber'],
    ['--color-accent', '--color-bg'],
    ['--color-accent', '--color-surface'],
    ['--color-teal-ink', '--color-surface'],
    ['--color-danger', '--color-surface'],
    ['--color-fg', '--color-highlight'],
  ])('text %s on %s meets 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('form-control edges meet 3:1 (WCAG 1.4.11)', () => {
    expect(contrast('--color-border-strong', '--color-bg')).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['--color-blue', '--color-bg'],
    ['--color-blue', '--color-surface'],
    ['--color-teal-ink', '--color-border'],
  ])('non-text %s against %s meets 3:1 (focus ring, edges, progress)', (a, b) => {
    expect(contrast(a, b)).toBeGreaterThanOrEqual(3);
  });

  it('keeps the type scale small', () => {
    const sizes = [...decls.keys()].filter((k) => k.startsWith('--text-'));
    expect(sizes.length).toBeLessThanOrEqual(7);
  });
});
