#!/usr/bin/env node
/**
 * ADR number check (TASK-J) — fails when two files in docs/adr/ share the same number.
 *
 * Two ADRs were both numbered 0020, so links to "ADR 0020" were ambiguous. Every ADR file is
 * `NNNN-slug.md`; the number must be unique across the directory.
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADR_FILE = /^(\d{4})-[a-z0-9-]+\.md$/;

/** Returns `[{ number, names }]` for every number used by more than one file name. */
export const findDuplicateAdrNumbers = (fileNames) => {
  const byNumber = new Map();
  for (const name of fileNames) {
    const match = ADR_FILE.exec(name);
    if (!match) continue;
    byNumber.set(match[1], [...(byNumber.get(match[1]) ?? []), name]);
  }
  return [...byNumber]
    .filter(([, names]) => names.length > 1)
    .map(([number, names]) => ({ number, names }));
};

const ADR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'adr');

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const duplicates = findDuplicateAdrNumbers(readdirSync(ADR_DIR));
  if (duplicates.length > 0) {
    process.stderr.write('adr-numbers: duplicate ADR numbers\n');
    for (const d of duplicates) process.stderr.write(`  ${d.number}: ${d.names.join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write('adr-numbers: unique\n');
}
