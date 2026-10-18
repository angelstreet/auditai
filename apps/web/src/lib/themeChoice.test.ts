import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, parseThemeChoice } from './themeChoice';

describe('theme choice', () => {
  it('accepts only light or dark', () => {
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice('system')).toBeNull();
    expect(parseThemeChoice(undefined)).toBeNull();
  });
  it('init script only fills a missing scheme from the system preference', () => {
    expect(THEME_INIT_SCRIPT).toContain("!d.getAttribute('data-theme')");
    expect(THEME_INIT_SCRIPT).toContain('prefers-color-scheme: dark');
  });
});
