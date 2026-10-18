import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messages } from '@evolai/i18n';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });

const has = (key: string): boolean => {
  let node: unknown = messages.en;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
};

describe('message keys used in apps/web/src', () => {
  it('every literal t("…") key exists in the catalog', () => {
    const missing: string[] = [];
    for (const file of walk(join(__dirname, '..'))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        const key = m[1] as string;
        if (!has(key)) missing.push(`${file.split('src/')[1]}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every template-literal t(`…${x}`) prefix resolves to a catalog branch', () => {
    const bad: string[] = [];
    for (const file of walk(join(__dirname, '..'))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) {
        const prefix = m[1] as string;
        let node: unknown = messages.en;
        for (const part of prefix.split('.')) {
          node =
            typeof node === 'object' && node !== null
              ? (node as Record<string, unknown>)[part]
              : undefined;
        }
        if (typeof node !== 'object' || node === null)
          bad.push(`${file.split('src/')[1]}: ${prefix}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
