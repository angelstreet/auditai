import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findDuplicateAdrNumbers } from './adr-numbers.mjs';

test('unique numbers pass', () => {
  assert.deepEqual(findDuplicateAdrNumbers(['0001-a.md', '0002-b.md', '0010-c.md']), []);
});

test('two files with the same number are reported', () => {
  assert.deepEqual(
    findDuplicateAdrNumbers(['0020-coverage-gate-scope.md', '0020-pseudonym-erasure-cascade.md']),
    [
      {
        number: '0020',
        names: ['0020-coverage-gate-scope.md', '0020-pseudonym-erasure-cascade.md'],
      },
    ],
  );
});

test('files that are not ADRs are ignored', () => {
  assert.deepEqual(findDuplicateAdrNumbers(['README.md', '0001-a.md', '0001-a.txt']), []);
});

test('the repository ADR directory has unique numbers', () => {
  const adrDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'adr');
  assert.deepEqual(findDuplicateAdrNumbers(readdirSync(adrDir)), []);
});
