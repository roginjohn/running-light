// v2 design tokens: every WCAG contrast pair passes (recomputed), board arrangement matches config.js,
// and the generated tokens.css is in sync with the JSON.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastChecks, tokensCss, TOKENS_PATH } from '../../scripts/gen-tokens.js';
import { assertArrangement } from '../../src/engine/config.js';

const T = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));

test('v2 contrast pairs (design-tokens-v2 §10) all meet their WCAG ratio', () => {
  const checks = contrastChecks(T);
  assert.equal(checks.length, 36);
  for (const c of checks) assert.ok(c.pass, `${c.name}: ${c.ratio} < ${c.need}`);
});

test('v2 board-arrangement equals the locked layout in config.js (counts 21/19/7/2/1, weight 2,093)', () => {
  assert.equal(assertArrangement(T['board-arrangement']), true);
  assert.deepEqual(T['board-arrangement-check'], { counts: { 24: 21, 96: 19, 480: 7, 960: 2, 1920: 1 }, totalWeight: 2093 });
});

test('src/styles/tokens.css is generated from the current tokens', () => {
  const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
  assert.equal(css, tokensCss(T));
});
