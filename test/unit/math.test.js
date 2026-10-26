// E1.1 paytable/layout, E1.2 weights/mapping + randInt, E1.3 Double Run, E1.4 payout
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MULT, WEIGHTS, TOTAL_WEIGHT, SQUARES_BY_TIER, squarePos, squareXY, assertArrangement, pStop, pRound, TIERS,
} from '../../src/engine/config.js';
import { weightedPick, drawRound, payout, gambleDraw } from '../../src/engine/outcome.js';
import { makeRng, createSeededRng } from '../../src/engine/rng.js';
import { scriptedRng } from './helpers.js';

const tokens = JSON.parse(readFileSync(new URL('../../src/data/design-tokens.json', import.meta.url)));

test('E1.1 50 squares, tier counts 21/19/7/2/1, multipliers, total weight 2093', () => {
  const counts = {};
  for (let n = 1; n <= 50; n++) counts[MULT[n]] = (counts[MULT[n]] || 0) + 1;
  assert.deepEqual(counts, { 24: 21, 96: 19, 480: 7, 960: 2, 1920: 1 });
  assert.deepEqual([...new Set(MULT.slice(1))].sort((a, b) => a - b), [24, 96, 480, 960, 1920]);
  assert.equal(TOTAL_WEIGHT, 2093);
  assert.equal(21 * 80 + 19 * 20 + 7 * 4 + 2 * 2 + 1, 2093);
  for (let n = 1; n <= 50; n++) assert.equal(WEIGHTS[n], { 24: 80, 96: 20, 480: 4, 960: 2, 1920: 1 }[MULT[n]]);
});

test('E1.1 layout exactly as spec B1 table', () => {
  assert.deepEqual(SQUARES_BY_TIER[1920], [8]);
  assert.deepEqual(SQUARES_BY_TIER[960], [21, 46]);
  assert.deepEqual(SQUARES_BY_TIER[480], [3, 13, 18, 29, 34, 40, 49]);
  assert.deepEqual(SQUARES_BY_TIER[96], [2, 5, 7, 10, 12, 15, 17, 20, 23, 25, 27, 30, 32, 35, 37, 39, 42, 44, 47]);
  assert.deepEqual(SQUARES_BY_TIER[24], [1, 4, 6, 9, 11, 14, 16, 19, 22, 24, 26, 28, 31, 33, 36, 38, 41, 43, 45, 48, 50]);
});

test('E1.1 design-tokens.json board-arrangement matches B1 (startup assertion)', () => {
  assert.equal(assertArrangement(tokens['board-arrangement']), true);
  const bad = { ...tokens['board-arrangement'], 8: '24x' };
  assert.throws(() => assertArrangement(bad));
});

test('E1.1 grid positions: clockwise from top-left, pitch 76 from (46,114)', () => {
  for (let n = 1; n <= 16; n++) assert.deepEqual(squarePos(n), [n - 1, 0]);
  for (let n = 17; n <= 25; n++) assert.deepEqual(squarePos(n), [15, n - 16]);
  for (let n = 26; n <= 41; n++) assert.deepEqual(squarePos(n), [15 - (n - 26), 10]);
  for (let n = 42; n <= 50; n++) assert.deepEqual(squarePos(n), [0, 10 - (n - 41)]);
  assert.deepEqual(squareXY(1), [49, 117]);
  assert.deepEqual(squareXY(26), [46 + 15 * 76 + 3, 114 + 10 * 76 + 3]);
  const seen = new Set();
  for (let n = 1; n <= 50; n++) {
    const k = squarePos(n).join(',');
    assert.ok(!seen.has(k));
    seen.add(k);
  }
});

test('E1.1 per-round odds match spec (1 in 25/101/503/1005/2010)', () => {
  const oneIn = Object.fromEntries(TIERS.map((t) => [t, Math.round(1 / pRound(t))]));
  assert.deepEqual(oneIn, { 24: 25, 96: 101, 480: 503, 960: 1005, 1920: 2010 });
  assert.equal((pStop(24) * 100).toFixed(4), '3.8223');
});

test('E1.2 weightedPick maps every r in 0..2092 correctly (exhaustive)', () => {
  // reference: build the cumulative table independently
  const table = [];
  for (let n = 1; n <= 50; n++) for (let i = 0; i < WEIGHTS[n]; i++) table.push(n);
  assert.equal(table.length, 2093);
  const hits = new Array(51).fill(0);
  for (let r = 0; r < 2093; r++) {
    const s = weightedPick(r);
    assert.equal(s, table[r], `r=${r}`);
    hits[s]++;
  }
  for (let n = 1; n <= 50; n++) assert.equal(hits[n], WEIGHTS[n]);
  assert.throws(() => weightedPick(2093));
  assert.equal(weightedPick(0), 1);
  assert.equal(weightedPick(2092), 50);
});

test('E1.2 randInt rejection sampling is unbiased at the boundary (mocked uint32)', () => {
  // n = 3: limit = floor(2^32/3)*3 = 4294967295 -> only 0xFFFFFFFF is rejected
  const seq = [0xffffffff, 0xfffffffe, 5];
  let i = 0;
  const rng = makeRng(() => seq[i++]);
  assert.equal(rng.randInt(3), 0xfffffffe % 3);
  assert.equal(i, 2, 'rejected exactly one draw');
  // n = 2093: limit = floor(2^32/2093)*2093
  const limit = Math.floor(2 ** 32 / 2093) * 2093;
  const seq2 = [limit, limit + 100, 2 ** 32 - 1, limit - 1];
  i = 0;
  const rng2 = makeRng(() => seq2[i++]);
  assert.equal(rng2.randInt(2093), (limit - 1) % 2093);
  assert.equal(i, 4, 'all values >= limit rejected');
  // n = 2^31 + 1 forces heavy rejection: values >= 2^31+1 rejected
  const big = 2 ** 31 + 1;
  const seq3 = [2 ** 31 + 1, 2 ** 31 + 5, 7];
  i = 0;
  const rng3 = makeRng(() => seq3[i++]);
  assert.equal(rng3.randInt(big), 7);
  // full residue coverage: a uniform 0..limit-1 stream maps each residue equally
  const n = 7;
  const lim7 = Math.floor(2 ** 32 / n) * n;
  const counts = new Array(n).fill(0);
  for (let x = lim7 - 7 * 1000; x < lim7; x++) counts[x % n]++;
  assert.ok(counts.every((c) => c === 1000));
  assert.throws(() => rng.randInt(0));
  assert.throws(() => rng.randInt(1.5));
});

test('E1.2 seeded PRNG is deterministic per seed', () => {
  const a = createSeededRng(42), b = createSeededRng(42), c = createSeededRng(43);
  const sa = Array.from({ length: 20 }, () => a.randInt(2093));
  const sb = Array.from({ length: 20 }, () => b.randInt(2093));
  const sc = Array.from({ length: 20 }, () => c.randInt(2093));
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('E1.3 Double Run triggers iff randInt(25) === 0; draw order s1, DR, s2', () => {
  assert.deepEqual(drawRound(scriptedRng([0, 1])), { s1: 1, doubleRun: false, s2: null });
  for (let v = 1; v < 25; v++) assert.equal(drawRound(scriptedRng([500, v])).doubleRun, false);
  const r = scriptedRng([0, 0, 0]);
  const out = drawRound(r);
  assert.equal(out.doubleRun, true);
  assert.equal(out.s1, 1);
  assert.equal(out.s2, 2, 'with s1 excluded, r=0 maps to the next square');
  assert.equal(r.remaining(), 0);
});

test('E1.3 s2 != s1 always (exhaustive over every s1 and r) and P(s2=j|s1) = w_j/(2093-w_s1)', () => {
  for (let s1 = 1; s1 <= 50; s1++) {
    const tot = 2093 - WEIGHTS[s1];
    const counts = new Array(51).fill(0);
    for (let r = 0; r < tot; r++) {
      const s2 = weightedPick(r, WEIGHTS, s1);
      assert.notEqual(s2, s1);
      counts[s2]++;
    }
    assert.equal(counts[s1], 0);
    for (let j = 1; j <= 50; j++) if (j !== s1) assert.equal(counts[j], WEIGHTS[j], `s1=${s1} j=${j}`);
    assert.throws(() => weightedPick(tot, WEIGHTS, s1));
    // via drawRound with the scripted rng: randInt is called with n = 2093 - w[s1]
    const firstR = WEIGHTS.slice(1, s1).reduce((a, b) => a + b, 0);
    const out = drawRound(scriptedRng([firstR, 0, tot - 1]));
    assert.equal(out.s1, s1);
    assert.notEqual(out.s2, s1);
  }
});

test('E1.4 payout: single win, loss, Double Run with 0/1/2 bet squares, integers', () => {
  const bets = { 12: 5, 24: 5, 13: 2, 8: 1 };
  assert.equal(payout(bets, 12, null), 480);
  assert.equal(payout(bets, 27, null), 0);
  assert.equal(payout(bets, 27, 30), 0, 'DR hitting 0 bet squares');
  assert.equal(payout(bets, 24, 30), 120, 'DR hitting 1 bet square (s2 unbet)');
  assert.equal(payout(bets, 30, 13), 960, 'DR hitting 1 bet square (s1 unbet)');
  assert.equal(payout(bets, 24, 13), 1080, 'DR hitting 2 bet squares');
  assert.equal(payout({ 8: 1 }, 8, null), 1920);
  for (const w of [payout(bets, 24, 13), payout(bets, 8)]) assert.ok(Number.isInteger(w));
});

test('E1.4 max base round win 28,800 (10 on #8 + 10 on #21 with Double Run)', () => {
  assert.equal(payout({ 8: 10, 21: 10 }, 8, 21), 28800);
  assert.equal(payout({ 8: 10, 21: 10 }, 21, 8), 28800);
  // brute force: no legal single round beats 28,800
  let max = 0;
  for (let a = 1; a <= 50; a++) for (let b = 1; b <= 50; b++) if (a !== b) max = Math.max(max, 10 * MULT[a] + 10 * MULT[b]);
  assert.equal(max, 28800);
});

test('E1.5 gamble draw mapping is randInt(2): 0 -> red, 1 -> white', () => {
  assert.equal(gambleDraw(scriptedRng([0])), 'red');
  assert.equal(gambleDraw(scriptedRng([1])), 'white');
});
