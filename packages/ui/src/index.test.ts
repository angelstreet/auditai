import { describe, expect, it } from 'vitest';
import type { Palette } from '@mui/material/styles';
import { icons, palette, theme } from './index.js';

const schemes = (theme as unknown as { colorSchemes: Record<string, { palette: Palette }> })
  .colorSchemes;

describe('@evolai/ui', () => {
  it('builds one theme with a light and a dark colour scheme', () => {
    expect(Object.keys(schemes).sort()).toEqual(['dark', 'light']);
    expect(schemes['light']?.palette.primary.main).toBe(palette.light.accent);
    expect(schemes['dark']?.palette.primary.main).toBe(palette.dark.accent);
    expect(schemes['dark']?.palette.background.default).toBe(palette.dark.bg);
  });

  it('never upper-cases buttons and uses only weights 400 and 600', () => {
    expect(theme.typography.button.textTransform).toBe('none');
    expect([theme.typography.fontWeightRegular, theme.typography.fontWeightBold]).toEqual([
      400, 600,
    ]);
  });

  it('has one icon per meaning in the registry', () => {
    for (const name of [
      'success',
      'error',
      'warning',
      'info',
      'language',
      'themeDark',
      'account',
      'signOut',
    ]) {
      expect(icons).toHaveProperty(name);
    }
    const components = Object.values(icons);
    expect(new Set(components).size).toBe(components.length);
  });
});
