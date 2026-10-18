/**
 * Colour values for the MUI theme (ADR 0034). The second token source next to tokens.css: MUI
 * needs real values to derive hover and disabled tones, so they live here once. tokens.test.ts
 * fails when a value here and its CSS custom property in tokens.css drift apart, and checks every
 * text/background pair for WCAG AA in both schemes.
 *
 * Dark is not black (docs/UI_RULES.md §12): a lifted slate page, cards one step lighter, and the
 * filled teal accent as the primary action in both schemes.
 */

export interface SchemePalette {
  /** Page background. */
  readonly bg: string;
  /** Cards, dialogs, menus: one step off the page. */
  readonly surface: string;
  /** Hover tint and raised surfaces (menus over cards). */
  readonly raised: string;
  readonly fg: string;
  readonly muted: string;
  /** Decorative hairlines only. */
  readonly border: string;
  /** Form-control edges, 3:1 against the surface (WCAG 1.4.11). */
  readonly borderStrong: string;
  /** Filled primary action. */
  readonly accent: string;
  readonly onAccent: string;
  /** Accent used as text (links, selected nav). */
  readonly accentInk: string;
  readonly focus: string;
  readonly success: string;
  readonly error: string;
  readonly warning: string;
  readonly info: string;
}

export const palette: { readonly light: SchemePalette; readonly dark: SchemePalette } = {
  light: {
    bg: '#f7fafc',
    surface: '#ffffff',
    raised: '#eef3f7',
    fg: '#172b3a',
    muted: '#536575',
    border: '#e3e8ee',
    borderStrong: '#7f8e9d',
    accent: '#0f7a6e',
    onAccent: '#ffffff',
    accentInk: '#0f7a6e',
    focus: '#4a7fe8',
    success: '#15803d',
    error: '#b42318',
    warning: '#b45309',
    info: '#2f5fc4',
  },
  dark: {
    bg: '#1a1d23',
    surface: '#262a33',
    raised: '#2f3440',
    fg: '#e8ebf0',
    muted: '#a0a8b5',
    border: '#363c48',
    borderStrong: '#7a8494',
    accent: '#2ec4b2',
    onAccent: '#172b3a',
    accentInk: '#5ad1c2',
    focus: '#7fa8f5',
    success: '#4ade80',
    error: '#ff8a80',
    warning: '#fbbf24',
    info: '#7fa8f5',
  },
};

/** Brand colours that stay the same in both schemes (logo, mascots, landing art). */
export const brand = {
  navy: '#172b3a',
  teal: '#19a999',
  blue: '#4a7fe8',
  amber: '#ffb86a',
} as const;
