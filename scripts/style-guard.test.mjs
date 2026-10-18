import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanFile, scanText } from './style-guard.mjs';

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

const fileHits = (src) => scanFile('apps/web/src/x.tsx', src);

test('icons only through the registry', () => {
  assert.equal(fileHits("import Add from '@mui/icons-material/Add';").length, 1);
  assert.deepEqual(
    scanFile('packages/ui/src/icons.tsx', "import Add from '@mui/icons-material/Add';"),
    [],
  );
});

test('no emoji, as a character or an escape', () => {
  // String.raw keeps the source text, so these are the escapes as written in a .tsx file.
  assert.equal(fileHits(String.raw`const ok = '✅';`).length, 1);
  assert.equal(fileHits(String.raw`<span>{'⚠️'}</span>`).length, 1);
  assert.equal(fileHits(String.raw`const s = '\u{1F600}';`).length, 1);
  assert.equal(fileHits(`const s = '${String.fromCodePoint(0x1f600)}';`).length, 1);
  assert.equal(fileHits(`const s = '${String.fromCodePoint(0x2705)}';`).length, 1);
  assert.deepEqual(fileHits(String.raw`const dash = '— … ·';`), []);
});

test('one contained button per file', () => {
  const one = '<Button variant="contained" onClick={() => go(1)}>A</Button>';
  const two = `${one}\n<Button variant="outlined">B</Button>\n${one}`;
  assert.deepEqual(fileHits(one), []);
  assert.equal(fileHits(two).length, 1);
});

test('button colours', () => {
  assert.deepEqual(fileHits('<Button variant="outlined" color="error">Erase</Button>'), []);
  assert.equal(fileHits('<Button variant="contained" color="error">Erase</Button>').length, 1);
  assert.equal(fileHits('<Button color="secondary">X</Button>').length, 1);
  assert.equal(fileHits('<Button color="error">X</Button>').length, 1);
});
