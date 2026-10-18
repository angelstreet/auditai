#!/usr/bin/env node
/**
 * Style guard (ADR 0025): fails when styling drifts away from the design tokens.
 *
 * Rules, for every scanned file except the token source itself:
 *   1. No hex colour literal (#abc, #aabbcc). Use a `var(--color-…)` token.
 *   2. No literal font size (`font-size: 13px`, `fontSize: 13`). Use `var(--text-…)`.
 *   3. No per-page `<style>{`…`}` block in TSX: shared CSS lives in apps/web/src/app/globals.css.
 *   4. landing/brand/tokens.css is a byte-identical copy of packages/ui/src/tokens.css, and
 *      landing/brand/fonts holds the same font files as packages/ui/src/fonts.
 *   5. `font-family` is only `var(--font-sans)`, `var(--font-mono)` or `inherit` (ADR 0027).
 *   6. No external font URL (Google Fonts or any other host): fonts are self-hosted.
 *
 * Exceptions are whole files, listed below with the reason. Exit 1 on any finding.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const TOKENS = 'packages/ui/src/tokens.css';
const LANDING_TOKENS = 'landing/brand/tokens.css';

const SCAN = ['apps/web/src', 'packages/ui/src', 'landing'];
const EXTENSIONS = /\.(css|tsx?|html)$/;
const EXEMPT = new Map([
  [TOKENS, 'the token source'],
  [LANDING_TOKENS, 'copy of the token source, checked separately'],
  ['packages/ui/src/mascots.tsx', 'illustration artwork with its own shading palette'],
  [
    'packages/ui/src/palette.ts',
    'the MUI colour source, checked against tokens.css by tokens.test.ts',
  ],
  ['packages/ui/src/theme.ts', 'the MUI theme: the role type scale mirrors the --text-* tokens'],
]);

export const RULES = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b(?![\w-])/g },
  { name: 'font-size literal', re: /font-size\s*:\s*[0-9.]+(?:px|rem|em|pt)/g },
  { name: 'fontSize literal', re: /fontSize\s*:\s*['"]?[0-9.]/g },
  { name: 'per-page <style> block', re: /<style>\{`/g, only: /\.tsx$/ },
  {
    name: 'font-family outside the tokens',
    re: /font(?:-family|Family)\s*:\s*(?!\s*['"]?(?:var\(--font-(?:sans|mono)\)|inherit)['"]?\s*[;,}\n'"])[^;}\n]+/g,
  },
  {
    name: 'external font URL',
    re: /(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com|@import\s+url\(\s*['"]?https?:|<link[^>]*href=["']https?:[^>]*\bfont/gi,
  },
];

/** Findings for one file's text; exported for the test. */
export const scanText = (rel, text) => {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.only && !rule.only.test(rel)) continue;
      for (const m of line.matchAll(rule.re)) {
        if (rule.name === 'hex colour' && isFalsePositive(line, m.index)) continue;
        out.push(`${rel}:${i + 1}: ${rule.name} "${m[0]}"`);
      }
    }
  });
  return out;
};

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
};

/** Hex inside an attribute like href="#main" or an HTML entity is not a colour. */
const isFalsePositive = (line, index) =>
  /(href|id|xlink:href)=["']$/.test(line.slice(0, index)) || line[index - 1] === '&';

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const findings = [];
if (isMain) {
  for (const base of SCAN) {
    for (const file of walk(join(ROOT, base))) {
      const rel = relative(ROOT, file);
      if (EXEMPT.has(rel) || /\.test\.tsx?$/.test(rel)) continue;
      findings.push(...scanText(rel, readFileSync(file, 'utf8')));
    }
  }
}

if (isMain) {
  const tokens = readFileSync(join(ROOT, TOKENS), 'utf8');
  let landing = '';
  try {
    landing = readFileSync(join(ROOT, LANDING_TOKENS), 'utf8');
  } catch {
    // reported below
  }
  const fontsOf = (dir) => {
    try {
      return readdirSync(join(ROOT, dir))
        .sort()
        .map((f) => `${f}:${readFileSync(join(ROOT, dir, f)).toString('base64')}`)
        .join('\n');
    } catch {
      return '';
    }
  };
  if (fontsOf('packages/ui/src/fonts') !== fontsOf('landing/brand/fonts')) {
    findings.push('landing/brand/fonts: must match packages/ui/src/fonts (cp -r)');
  }
  if (landing !== tokens) {
    findings.push(
      `${LANDING_TOKENS}: must be an exact copy of ${TOKENS} (cp ${TOKENS} ${LANDING_TOKENS})`,
    );
  }

  if (findings.length > 0) {
    process.stderr.write(
      `style-guard: ${findings.length} finding(s); use the tokens in ${TOKENS}\n`,
    );
    for (const f of findings) process.stderr.write(`  ${f}\n`);
    process.exit(1);
  }
  process.stdout.write('style-guard: clean\n');
}
