// v3 design tokens: every WCAG contrast pair passes (recomputed), the v3 sections match docs/design-v3/tokens.json,
// board arrangement matches config.js, the generated tokens.css is in sync with the JSON, and every token variable
// the components use is defined.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { contrastChecks, tokensCss, TOKENS_PATH } from '../../scripts/gen-tokens.js';
import { assertArrangement } from '../../src/engine/config.js';

const T = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
const DOC = JSON.parse(readFileSync(new URL('../../docs/design-v3/tokens.json', import.meta.url), 'utf8'));
const CSS = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

test('v3 contrast pairs (tokens.md §1 + legacy v2 names) all meet their WCAG ratio', () => {
  const checks = contrastChecks(T);
  assert.equal(checks.length, 46);
  for (const c of checks) assert.ok(c.pass, `${c.name}: ${c.ratio} < ${c.need}`);
});

test('v3 colour, font, type, space, radius and border match docs/design-v3/tokens.json', () => {
  for (const k of ['color', 'font', 'type', 'space', 'radius', 'border', 'shadow', 'paytable', 'rules']) assert.deepEqual(T[k], DOC[k], k);
});

test('v3 board-arrangement equals the locked layout in config.js (counts 21/19/7/2/1, weight 2,093)', () => {
  assert.equal(assertArrangement(T['board-arrangement']), true);
  assert.deepEqual(T['board-arrangement-check'], { counts: { 24: 21, 96: 19, 480: 7, 960: 2, 1920: 1 }, totalWeight: 2093 });
});

test('src/styles/tokens.css is generated from the current tokens', () => {
  assert.equal(CSS, tokensCss(T));
});

test('every token variable used by the UI is defined in tokens.css', () => {
  const defined = new Set([...CSS.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  const files = ['../../src/styles.css', ...readdirSync(new URL('../../src/ui/', import.meta.url)).map((f) => `../../src/ui/${f}`)];
  const used = new Set();
  for (const f of files) for (const m of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/var\((--(?:(?:c|r|sh|z|f|sp|fs|fw|lh|b|o)-[a-z0-9-]+|t\d+(?:-[a-z]+)?))\)/g)) used.add(m[1]);
  const missing = [...used].filter((v) => !defined.has(v));
  assert.deepEqual(missing, []);
});

test('v3 fonts: Poppins and JetBrains Mono, no v2 display font', () => {
  assert.match(CSS, /--f-sans:Poppins,/);
  assert.match(CSS, /--f-mono:"JetBrains Mono",/);
  assert.doesNotMatch(CSS, /Bungee|Plus Jakarta Sans/);
});
