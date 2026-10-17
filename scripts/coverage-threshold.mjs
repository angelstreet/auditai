#!/usr/bin/env node
/**
 * Coverage gate (improvement #9).
 *
 * Reads the most recent `coverage/coverage-summary.json` per package and
 * fails if any tracked file drops below the threshold (default 80%).
 *
 * Tracked files: contracts, domain, ai.
 * Threshold: `--threshold=80` (CLI flag) or `COVERAGE_THRESHOLD=80` env.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TRACKED = ['packages/contracts', 'packages/domain', 'services/ai'];
const argvThreshold = Number(
  (process.argv.find((a) => a.startsWith('--threshold=')) ?? '').split('=')[1] ?? '',
);
const THRESHOLD =
  Number.isFinite(argvThreshold) && argvThreshold > 0
    ? argvThreshold
    : Number(process.env.COVERAGE_THRESHOLD ?? '80');

const findSummary = (pkgRoot) => {
  const cov = join(ROOT, pkgRoot, 'coverage', 'coverage-summary.json');
  return existsSync(cov) ? cov : null;
};

const lines = [];
let failed = false;
for (const pkg of TRACKED) {
  const summary = findSummary(pkg);
  if (!summary) {
    lines.push(`  ${pkg}: no coverage summary (run \`pnpm test\` first)`);
    failed = true;
    continue;
  }
  const j = JSON.parse(readFileSync(summary, 'utf8'));
  const total = j.total ?? {};
  const pct =
    total.lines && total.lines.total > 0 ? (total.lines.covered / total.lines.total) * 100 : 0;
  const passed = pct >= THRESHOLD;
  if (!passed) failed = true;
  lines.push(
    `  ${pkg}: ${pct.toFixed(1)}% lines (threshold ${THRESHOLD}%) ${passed ? 'OK' : 'LOW'}`,
  );
}

console.log(`Coverage gate (threshold ${THRESHOLD}%):`);
for (const line of lines) console.log(line);

if (failed) {
  process.stderr.write('Coverage gate FAILED\n');
  process.exit(1);
}
