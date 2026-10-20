import { createTheme, type Theme } from '@mui/material/styles';
import { palette, type SchemePalette } from './palette.js';

/**
 * The one MUI theme (ADR 0034), built from palette.ts (colours) and tokens.css (type, space,
 * shape). Light and dark are CSS-variable colour schemes switched by `data-theme` on <html>, so
 * the server renders the right scheme from the cookie and there is no flash (docs/UI_RULES.md §1).
 */

export const THEME_ATTRIBUTE = 'data-theme';

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const schemeOf = (p: SchemePalette) => ({
  palette: {
    primary: { main: p.accent, contrastText: p.onAccent },
    secondary: { main: p.accentInk, contrastText: p.onAccent },
    success: { main: p.success },
    error: { main: p.error },
    warning: { main: p.warning },
    info: { main: p.info },
    background: { default: p.bg, paper: p.surface },
    text: { primary: p.fg, secondary: p.muted },
    divider: p.border,
    action: { hover: p.raised, selected: p.raised },
    // Extra roles read through theme.vars.palette.app.* by the shared components.
    app: { accentInk: p.accentInk, borderStrong: p.borderStrong, focus: p.focus, raised: p.raised },
  },
});

declare module '@mui/material/styles' {
  interface Palette {
    app: { accentInk: string; borderStrong: string; focus: string; raised: string };
  }
  interface PaletteOptions {
    app?: { accentInk: string; borderStrong: string; focus: string; raised: string };
  }
  interface TypographyVariants {
    pageTitle: React.CSSProperties;
    sectionTitle: React.CSSProperties;
    cardTitle: React.CSSProperties;
    lede: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    pageTitle?: React.CSSProperties;
    sectionTitle?: React.CSSProperties;
    cardTitle?: React.CSSProperties;
    lede?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    sectionTitle: true;
    cardTitle: true;
    lede: true;
  }
}

/** Role scale (docs/UI_RULES.md §2): pages read roles, never sizes. Values mirror tokens.css. */
const typography = {
  fontFamily: FONT,
  fontWeightRegular: 400,
  fontWeightMedium: 600,
  fontWeightBold: 600,
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.25,
    textWrap: 'balance',
    '@media (min-width:768px)': { fontSize: '2rem' },
  },
  sectionTitle: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 },
  cardTitle: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
  lede: { fontSize: '1.125rem', fontWeight: 400, lineHeight: 1.5 },
  h1: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.25 },
  h2: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 },
  h3: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
  body1: { fontSize: '1rem', lineHeight: 1.5 },
  body2: { fontSize: '0.875rem', lineHeight: 1.5 },
  caption: { fontSize: '0.75rem', lineHeight: 1.4 },
  button: { fontSize: '1rem', fontWeight: 600, textTransform: 'none' as const },
} as const;

export const theme: Theme = createTheme({
  cssVariables: { colorSchemeSelector: `[${THEME_ATTRIBUTE}="%s"]`, cssVarPrefix: 'mui' },
  colorSchemes: { light: schemeOf(palette.light), dark: schemeOf(palette.dark) },
  typography: typography as never,
  shape: { borderRadius: 8 },
  spacing: 4,
  components: {
    // No ripple, so the focus ring is ours: ButtonBase resets outline to 0, which would hide the
    // global :focus-visible ring on every MUI control (UI_RULES §6, WCAG 2.4.7).
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: ({ theme: t }) => ({
          '&.Mui-focusVisible, &:focus-visible': {
            outline: `3px solid ${t.vars.palette.app.focus}`,
            outlineOffset: 2,
          },
        }),
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, paddingInline: 20, borderRadius: 8 },
        outlined: ({ theme: t }) => ({ borderColor: t.vars.palette.app.borderStrong }),
      },
    },
    MuiIconButton: { styleOverrides: { root: { width: 44, height: 44 } } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: ({ theme: t }) => ({ borderColor: t.vars.palette.divider }),
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          border: `1px solid ${t.vars.palette.divider}`,
          backgroundColor: t.vars.palette.background.paper,
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          backgroundColor: t.vars.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: t.vars.palette.app.borderStrong },
        }),
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        // A locked (disabled) form keeps readable help text: MUI's disabled grey fails 4.5:1.
        root: ({ theme: t }) => ({
          '&.Mui-disabled': { color: t.vars.palette.text.secondary },
        }),
      },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiLink: { defaultProps: { underline: 'hover' } },
    MuiCssBaseline: {
      styleOverrides: ({ vars }: Theme) => ({
        ':focus-visible': { outline: `3px solid ${vars?.palette.app.focus}`, outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': {
          '*': { transition: 'none !important', animation: 'none !important' },
        },
      }),
    },
  },
});
