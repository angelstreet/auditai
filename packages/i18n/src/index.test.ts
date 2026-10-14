import { describe, expect, it } from 'vitest';
import { isSupportedLocale, supportedLocales } from './index.js';

describe('@auditai/i18n locale list', () => {
  it('supports fr and en', () => {
    expect([...supportedLocales].sort()).toEqual(['en', 'fr']);
  });

  it('recognises supported locales', () => {
    expect(isSupportedLocale('fr')).toBe(true);
    expect(isSupportedLocale('en')).toBe(true);
  });

  it('rejects unknown locales', () => {
    expect(isSupportedLocale('de')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });
});
