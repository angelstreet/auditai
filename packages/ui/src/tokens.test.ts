import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { palette, type SchemePalette } from './palette.js';

/**
 * Design-token contract (ADR 0025, ADR 0033): brand palette present, the CSS tokens and the MUI
 * palette agree in both schemes, and every text/background pair meets WCAG 2.2 AA (4.5:1 text,
 * 3:1 control edges and focus) in light AND dark.
 */

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const declsOf = (block: string) =>
  new Map(
    [...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1] as string,
      (m[2] as string).trim(),
    ]),
  );

const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('[data-theme='));
const darkBlock = css.slice(css.indexOf("[data-theme='dark'] {"), css.indexOf('@media'));
const mediaBlock = css.slice(css.indexOf(':root:not([data-theme])'));
const light = declsOf(rootBlock);
const dark = new Map([...light, ...declsOf(darkBlock)]);

const resolveIn =
  (decls: Map<string, string>) =>
  (name: string): string => {
    const value = decls.get(name);
    if (!value) throw new Error(`missing token ${name}`);
    const ref = /^var\((--[a-z0-9-]+)\)/.exec(value);
    return ref ? resolveIn(decls)(ref[1] as string) : (value.split(/\s/)[0] as string);
  };

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const CSS_OF: Record<keyof SchemePalette, string> = {
  bg: '--color-bg',
  surface: '--color-surface',
  raised: '--color-raised',
  fg: '--color-fg',
  muted: '--color-muted',
  border: '--color-border',
  borderStrong: '--color-control-edge',
  accent: '--color-accent',
  onAccent: '--color-accent-fg',
  accentInk: '--color-accent-ink',
  focus: '--color-focus',
  success: '--color-success',
  error: '--color-error',
  warning: '--color-warning',
  info: '--color-info',
};

describe('design tokens', () => {
  it('carry the brand palette from the brand kit', () => {
    const r = resolveIn(light);
    expect(r('--color-navy')).toBe('#172b3a');
    expect(r('--color-teal')).toBe('#19a999');
    expect(r('--color-blue')).toBe('#4a7fe8');
    expect(r('--color-amber')).toBe('#ffb86a');
    expect(r('--color-off-white')).toBe('#f7fafc');
    expect(r('--color-slate')).toBe('#536575');
  });

  it('the dark media-query fallback repeats the data-theme block exactly', () => {
    expect(declsOf(mediaBlock)).toEqual(declsOf(darkBlock));
  });

  for (const [scheme, decls] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    const p = palette[scheme];
    const r = resolveIn(decls);

    it(`${scheme}: tokens.css matches palette.ts`, () => {
      for (const [key, token] of Object.entries(CSS_OF)) {
        expect(r(token), `${scheme} ${token}`).toBe(p[key as keyof SchemePalette]);
      }
    });

    it.each([
      ['fg', 'bg'],
      ['fg', 'surface'],
      ['fg', 'raised'],
      ['muted', 'bg'],
      ['muted', 'surface'],
      ['onAccent', 'accent'],
      ['accentInk', 'bg'],
      ['accentInk', 'surface'],
      ['error', 'bg'],
      ['error', 'surface'],
      ['success', 'surface'],
      ['warning', 'surface'],
      ['info', 'surface'],
    ] as const)(`${scheme}: text %s on %s meets 4.5:1`, (fg, bg) => {
      expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
    });

    it.each([
      ['borderStrong', 'surface'],
      ['borderStrong', 'bg'],
      ['focus', 'bg'],
      ['focus', 'surface'],
      ['accent', 'bg'],
      ['accent', 'surface'],
    ] as const)(`${scheme}: non-text %s against %s meets 3:1`, (a, b) => {
      expect(ratio(p[a], p[b])).toBeGreaterThanOrEqual(3);
    });
  }

  it('dark is not black: the page is lifted and cards are lighter than the page (§12)', () => {
    expect(luminance(palette.dark.bg)).toBeGreaterThan(luminance('#14161a'));
    expect(luminance(palette.dark.surface)).toBeGreaterThan(luminance(palette.dark.bg));
    expect(luminance(palette.dark.raised)).toBeGreaterThan(luminance(palette.dark.surface));
  });

  it('brand pairs used on pills and the landing stay AA', () => {
    const r = resolveIn(light);
    expect(ratio(r('--color-white'), r('--color-slate'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(r('--color-navy'), r('--color-amber'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(r('--color-on-highlight'), r('--color-highlight'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the type scale small', () => {
    const sizes = [...light.keys()].filter((k) => k.startsWith('--text-'));
    expect(sizes.length).toBeLessThanOrEqual(7);
  });
});
