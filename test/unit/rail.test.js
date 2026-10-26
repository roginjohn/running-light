// v3 rail controls (batch 3): 1/2 and x2 scaling clamped to the locked engine limits (1-10 per square, 200 per
// round, the balance), "Last bets" round totals, rail sizes from the tokens, flat Start/Collect colours, and
// Plus Jakarta Sans fully removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { halveBets, doubleBets } from '../../src/ui/betscale.js';
import { recordTotal, loadTotals, saveTotals, BET_TOTALS_KEY } from '../../src/ui/bettotals.js';
import { computeLayout } from '../../src/ui/layout.js';
import { totalOf, validBets } from '../../src/engine/bets.js';
import { MAX_PER_SQUARE, MAX_PER_ROUND } from '../../src/engine/config.js';
import { memoryBackend } from '../../src/engine/storage.js';

const DOC = JSON.parse(readFileSync(new URL('../../docs/design-v3/tokens.json', import.meta.url), 'utf8'));
const STYLES = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
const rule = (sel) => {
  const i = STYLES.indexOf(`${sel} {`);
  assert.ok(i >= 0, `rule ${sel}`);
  return STYLES.slice(i, STYLES.indexOf('}', i));
};
const even = (n, v) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, v]));

// ------------------------------------------------------------------ 1/2 and x2
test('engine limits used by 1/2 and x2 are the token rules (1-10 per square, 200 per round)', () => {
  assert.deepEqual([1, MAX_PER_SQUARE], DOC.rules['bet-per-square']);
  assert.equal(MAX_PER_ROUND, DOC.rules['bet-per-round-max']);
});

test('x2 doubles every square and the total when nothing is capped', () => {
  const b = { 3: 2, 8: 1, 13: 5, 21: 2, 27: 4 };
  const r = doubleBets(b, 1000);
  assert.deepEqual(r.bets, { 3: 4, 8: 2, 13: 10, 21: 4, 27: 8 });
  assert.equal(totalOf(r.bets), 2 * totalOf(b));
  assert.equal(r.changed, true);
  assert.equal(r.limit, null);
  assert.deepEqual(b, { 3: 2, 8: 1, 13: 5, 21: 2, 27: 4 }, 'input not mutated');
});

test('x2 clamps each square to 10 (limit "square")', () => {
  const r = doubleBets({ 1: 6, 2: 3, 3: 10 }, 1000);
  assert.deepEqual(r.bets, { 1: 10, 2: 6, 3: 10 });
  assert.equal(r.limit, 'square');
  const full = doubleBets({ 1: 10, 2: 10 }, 1000);
  assert.equal(full.changed, false, 'all at 10: nothing to double');
  assert.equal(full.limit, 'square');
});

test('x2 clamps the round to 200 and shares the room evenly in square order (limit "round")', () => {
  const r = doubleBets(even(30, 5), 1000); // 150 -> would be 300
  assert.equal(totalOf(r.bets), 200);
  assert.equal(r.limit, 'round');
  const vals = Object.values(r.bets);
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, 'squares stay within 1 of each other');
  assert.deepEqual([r.bets[1], r.bets[20], r.bets[21], r.bets[30]], [7, 7, 6, 6]);
  assert.ok(validBets(r.bets), 'engine accepts the result');
  const atCap = doubleBets(even(20, 10), 1000);
  assert.equal(atCap.changed, false, '200 already: no change');
});

test('x2 never goes over the balance (limit "credits")', () => {
  const r = doubleBets({ 1: 5, 2: 5, 3: 5 }, 25);
  assert.equal(totalOf(r.bets), 25);
  assert.deepEqual(r.bets, { 1: 9, 2: 8, 3: 8 });
  assert.equal(r.limit, 'credits');
  const broke = doubleBets({ 1: 5 }, 4); // bets left on the board after a loss can exceed the balance
  assert.equal(broke.changed, false);
  assert.equal(broke.limit, 'credits');
});

test('x2 result always respects every limit (exhaustive small cases)', () => {
  for (let n = 1; n <= 50; n += 7) {
    for (const v of [1, 3, 5, 9, 10]) {
      if (n * v > MAX_PER_ROUND) continue;
      for (const bal of [0, 7, 60, 150, 199, 1000]) {
        const r = doubleBets(even(n, v), bal);
        const t = totalOf(r.bets);
        assert.ok(Object.values(r.bets).every((x) => x >= 1 && x <= MAX_PER_SQUARE), 'per square 1-10');
        assert.ok(t <= Math.max(MAX_PER_ROUND, n * v) && (t <= bal || !r.changed), `round/balance cap n=${n} v=${v} bal=${bal}`);
        assert.ok(t >= n * v, 'never lowers a bet');
      }
    }
  }
});

test('1/2 halves every square, rounding down, never below 1', () => {
  const r = halveBets({ 1: 10, 2: 5, 3: 2, 4: 1 });
  assert.deepEqual(r.bets, { 1: 5, 2: 2, 3: 1, 4: 1 });
  assert.equal(r.changed, true);
  assert.equal(r.limit, null);
  const ones = halveBets({ 7: 1, 9: 1 });
  assert.equal(ones.changed, false, 'all at 1: nothing to halve');
  assert.deepEqual(halveBets({}).bets, {});
});

// ------------------------------------------------------------------ last bets
test('last bets: round totals newest first, at most 5, a roundId is counted once', () => {
  let l = [];
  for (const [id, t] of [['a', 10], ['b', 30], ['c', 15], ['d', 20], ['e', 20], ['f', 40]]) l = recordTotal(l, id, t);
  assert.deepEqual(l.map((e) => e.t), [40, 20, 20, 15, 30]);
  assert.equal(recordTotal(l, 'f', 40), l, 'same round again: unchanged');
  assert.equal(recordTotal(l, 'g', 0), l, 'no bet: unchanged');
});

test('last bets persist in their own storage key; unreadable data is ignored', () => {
  const be = memoryBackend();
  saveTotals(be, [{ id: 'r1', t: 20 }]);
  assert.deepEqual(loadTotals(be), [{ id: 'r1', t: 20 }]);
  be.setItem(BET_TOTALS_KEY, '{oops');
  assert.deepEqual(loadTotals(be), []);
  be.setItem(BET_TOTALS_KEY, JSON.stringify([{ id: 'x', t: -3 }]));
  assert.deepEqual(loadTotals(be), []);
  assert.ok(!BET_TOTALS_KEY.startsWith('rl.v1.'), 'not one of the engine keys');
});

// ------------------------------------------------------------------ sizes and look
test('rail sizes follow the tokens: input 40, chip 34 (40 tablet), secondary 32, primary 52 / 48 at 1280 / 56 tablet', () => {
  const xl = computeLayout(1920, 1080).rail, d = computeLayout(1280, 720).rail, t = computeLayout(768, 1024).dock;
  assert.deepEqual([xl.inputH, xl.chip, xl.actH, xl.mainH, xl.pad, xl.gapY], [DOC.size['input-height'], DOC.size.chip, DOC.size['button-secondary-height'], DOC.size['button-primary-height'], 16, 12]);
  assert.deepEqual([d.mainH, d.pad], [48, 12]);
  assert.deepEqual([t.chip, t.mainH], [DOC.size['chip-768'], 56]);
});

test('Start is accent-blue with white text, Collect accent-green with dark text; no amber/light-blue gradients', () => {
  const pri = rule('.btn:is(.cta, .pri, .gam, .collect)');
  assert.match(pri, /background: var\(--c-accent-blue\)/);
  assert.match(pri, /color: var\(--c-text-strong\)/);
  const col = rule('.btn.collect');
  assert.match(col, /background: var\(--c-accent-green\)/);
  assert.match(col, /color: var\(--c-text-on-green\)/);
  assert.doesNotMatch(STYLES, /\.btn\.cta \{[^}]*amber/);
  assert.doesNotMatch(STYLES, /--sh-cta/);
});

test('no glows or shadows on the rail controls', () => {
  for (const sel of ['.rail, .dock', '.betin', '.btn', '.btn.sec', '.btn.sec.hi', '.chip', '.chip.sel::after', '.rnote', '.lb', '.lb.new', '.credits']) {
    assert.doesNotMatch(rule(sel), /box-shadow|text-shadow|filter|gradient/, sel);
  }
  assert.doesNotMatch(STYLES, /\.chip\.sel \{[^}]*transform/, 'no chip lift');
});

test('Plus Jakarta Sans is gone: no font file, @font-face, preload, licence, copy step or dependency', () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.deepEqual(readdirSync(new URL('../../src/assets/fonts/', import.meta.url)).filter((f) => /jakarta/i.test(f)), []);
  assert.equal(existsSync(new URL('../../public/fonts/LICENSE-PlusJakartaSans-OFL.txt', import.meta.url)), false);
  assert.equal(existsSync(new URL('../../src/assets/v2/chips', import.meta.url)) && readdirSync(new URL('../../src/assets/v2/chips', import.meta.url)).length > 0, false, 'v2 chip SVGs removed');
  for (const f of ['src/styles.css', 'src/main.js', 'scripts/copy-v2-assets.js', 'scripts/copy-v3-fonts.js', 'package.json', 'src/ui/icons.js']) {
    assert.doesNotMatch(read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), /jakarta/i, f);
  }
});
