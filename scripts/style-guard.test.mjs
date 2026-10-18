import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanText } from './style-guard.mjs';

const hits = (css) => scanText('x.css', css);

test('font-family through the tokens passes', () => {
  assert.deepEqual(hits('a { font-family: var(--font-sans); }'), []);
  assert.deepEqual(hits('a { font-family: var(--font-mono); }'), []);
  assert.deepEqual(hits('a { font-family: inherit; }'), []);
  assert.deepEqual(hits("s = { fontFamily: 'var(--font-sans)', x: 1 }"), []);
});

test('font-family literals fail', () => {
  assert.equal(hits("a { font-family: 'Outfit', sans-serif; }").length, 1);
  assert.equal(hits('a { font-family: system-ui; }').length, 1);
  assert.equal(hits("s = { fontFamily: 'Georgia' }").length, 1);
});

test('external font URLs fail', () => {
  assert.equal(hits('<link href="https://fonts.googleapis.com/css2?family=Inter" />').length, 1);
  assert.equal(hits("@import url('https://example.test/f.css');").length, 1);
  assert.equal(hits('<link rel="preconnect" href="https://fonts.gstatic.com" />').length, 1);
});

test('existing rules still apply', () => {
  assert.equal(hits('a { font-size: 13px; }').length, 1);
  assert.equal(hits('a { color: #fff; }').length, 1);
});
