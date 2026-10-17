#!/usr/bin/env node
/**
 * Coverage gate (improvement #9, ADR 0020).
 *
 * Reads `coverage/coverage-summary.json` per package (written by the
 * `json-summary` reporter) and fails if a gated package's total line
 * coverage is below its threshold.
 *
 * Gated: contracts and domain, at 80% (`--threshold=` or
 * `COVERAGE_THRESHOLD=` overrides it).
 * Report-only: services/ai. Its DB-backed workers (retention, synergy,
 * team rollup, the worker entry point) are exercised by the smoke CLIs,
 * not by unit tests, so its unit-test line coverage is not a gate yet.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const argvThreshold = Number(
  (process.argv.find((a) => a.startsWith('--threshold=')) ?? '').split('=')[1] ?? '',
);
const THRESHOLD =
  Number.isFinite(argvThreshold) && argvThreshold > 0
    ? argvThreshold
    : Number(process.env.COVERAGE_THRESHOLD ?? '80');

const TRACKED = [
  { pkg: 'packages/contracts', gated: true },
  { pkg: 'packages/domain', gated: true },
  { pkg: 'services/ai', gated: false },
];

const lines = [];
let failed = false;
for (const { pkg, gated } of TRACKED) {
  const summary = join(ROOT, pkg, 'coverage', 'coverage-summary.json');
  if (!existsSync(summary)) {
    lines.push(`  ${pkg}: no coverage summary (run \`pnpm test\` first)`);
    if (gated) failed = true;
    continue;
  }
  const total = JSON.parse(readFileSync(summary, 'utf8')).total ?? {};
  const pct =
    total.lines && total.lines.total > 0 ? (total.lines.covered / total.lines.total) * 100 : 0;
  if (!gated) {
    lines.push(`  ${pkg}: ${pct.toFixed(1)}% lines (report-only, ADR 0020)`);
    continue;
  }
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
