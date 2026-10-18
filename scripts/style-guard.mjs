#!/usr/bin/env node
/**
 * Style guard (ADR 0025): fails when styling drifts away from the design tokens.
 *
 * Rules, for every scanned file except the token source itself:
 *   1. No hex colour literal (#abc, #aabbcc). Use a `var(--color-…)` token.
 *   2. No literal font size (`font-size: 13px`, `fontSize: 13`). Use `var(--text-…)`.
 *   3. No per-page `<style>{`…`}` block in TSX: shared CSS lives in apps/web/src/app/globals.css.
 *   4. landing/brand/tokens.css is a byte-identical copy of packages/ui/src/tokens.css.
 *
 * Exceptions are whole files, listed below with the reason. Exit 1 on any finding.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TOKENS = 'packages/ui/src/tokens.css';
const LANDING_TOKENS = 'landing/brand/tokens.css';

const SCAN = ['apps/web/src', 'packages/ui/src', 'landing'];
const EXTENSIONS = /\.(css|tsx?|html)$/;
const EXEMPT = new Map([
  [TOKENS, 'the token source'],
  [LANDING_TOKENS, 'copy of the token source, checked separately'],
  ['packages/ui/src/mascots.tsx', 'illustration artwork with its own shading palette'],
  ['landing/m12-mockup.html', 'archived design mockup, not served as a product page'],
  ['landing/m14-quiz-mockup.html', 'archived design mockup, not served as a product page'],
]);

const RULES = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b(?![\w-])/g },
  { name: 'font-size literal', re: /font-size\s*:\s*[0-9.]+(?:px|rem|em|pt)/g },
  { name: 'fontSize literal', re: /fontSize\s*:\s*['"]?[0-9.]/g },
  { name: 'per-page <style> block', re: /<style>\{`/g, only: /\.tsx$/ },
];

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

const findings = [];
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file);
    if (EXEMPT.has(rel) || /\.test\.tsx?$/.test(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.only && !rule.only.test(rel)) continue;
        for (const m of line.matchAll(rule.re)) {
          if (rule.name === 'hex colour' && isFalsePositive(line, m.index)) continue;
          findings.push(`${rel}:${i + 1}: ${rule.name} "${m[0]}"`);
        }
      }
    });
  }
}

const tokens = readFileSync(join(ROOT, TOKENS), 'utf8');
let landing = '';
try {
  landing = readFileSync(join(ROOT, LANDING_TOKENS), 'utf8');
} catch {
  // reported below
}
if (landing !== tokens) {
  findings.push(
    `${LANDING_TOKENS}: must be an exact copy of ${TOKENS} (cp ${TOKENS} ${LANDING_TOKENS})`,
  );
}

if (findings.length > 0) {
  process.stderr.write(`style-guard: ${findings.length} finding(s); use the tokens in ${TOKENS}\n`);
  for (const f of findings) process.stderr.write(`  ${f}\n`);
  process.exit(1);
}
process.stdout.write('style-guard: clean\n');
