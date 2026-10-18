/** Cookie that stores an explicit light/dark choice; absent means "follow the system" (ADR 0033). */
export const THEME_COOKIE = 'evolai_theme';
export type ThemeChoice = 'light' | 'dark';

export const parseThemeChoice = (value: string | undefined): ThemeChoice | null =>
  value === 'light' || value === 'dark' ? value : null;

/**
 * Inline script for <head>. When the server could not set data-theme (no explicit choice), set it
 * from the system preference before the first paint, so there is no flash of the wrong scheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(!d.getAttribute('data-theme')){d.setAttribute('data-theme',window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}}catch(e){}})();`;
