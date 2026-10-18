import { cookies } from 'next/headers';
import { THEME_COOKIE, parseThemeChoice, type ThemeChoice } from './themeChoice';

export { THEME_COOKIE, THEME_INIT_SCRIPT, parseThemeChoice, type ThemeChoice } from './themeChoice';

/** The visitor's explicit theme choice for this request, or null to follow prefers-color-scheme. */
export const getThemeChoice = (): ThemeChoice | null =>
  parseThemeChoice(cookies().get(THEME_COOKIE)?.value);
