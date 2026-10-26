// Running Light - approved game configuration (spec B1, B3, B4). Framework-free; runs in Node and the browser.
// DO NOT CHANGE: every value here is a B14 locked detail.

export const TIERS = [24, 96, 480, 960, 1920];
export const WEIGHT_BY_TIER = Object.freeze({ 24: 80, 96: 20, 480: 4, 960: 2, 1920: 1 });
export const COUNT_BY_TIER = Object.freeze({ 24: 21, 96: 19, 480: 7, 960: 2, 1920: 1 });

// Fixed layout (spec B1 table). #1 top-left, clockwise.
export const SQUARES_BY_TIER = Object.freeze({
  1920: [8],
  960: [21, 46],
  480: [3, 13, 18, 29, 34, 40, 49],
  96: [2, 5, 7, 10, 12, 15, 17, 20, 23, 25, 27, 30, 32, 35, 37, 39, 42, 44, 47],
  24: [1, 4, 6, 9, 11, 14, 16, 19, 22, 24, 26, 28, 31, 33, 36, 38, 41, 43, 45, 48, 50],
});

export const NUM_SQUARES = 50;
export const SQUARE_NUMBERS = Object.freeze(Array.from({ length: 50 }, (_, i) => i + 1));

/** MULT[n] = multiplier of square n (index 0 unused). */
export const MULT = new Array(51).fill(0);
for (const t of TIERS) for (const n of SQUARES_BY_TIER[t]) MULT[n] = t;
Object.freeze(MULT);

/** WEIGHTS[n] = integer stop weight of square n (index 0 unused, weight 0). */
export const WEIGHTS = MULT.map((m) => (m ? WEIGHT_BY_TIER[m] : 0));
Object.freeze(WEIGHTS);

export const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0); // 2093

export const DOUBLE_RUN_ONE_IN = 25;
export const CHIPS = Object.freeze([1, 5, 10, 25, 50]);
export const DEFAULT_CHIP = 1;
export const MAX_PER_SQUARE = 10;
export const MAX_PER_ROUND = 200;
export const MIN_BET = 1;
export const START_CREDITS = 1000;
export const REFILL_AMOUNT = 1000;
export const MAX_GAMBLES = 3;
export const GAMBLE_CAP = 30000;
export const HISTORY_STORED = 50;
export const HISTORY_SHOWN = 10;

export const TOASTS = Object.freeze({
  square: 'Max bet reached – 10 per square',
  round: 'Round limit reached – 200 per round',
  credits: 'Not enough credits',
  restored: 'Bets restored from last round',
  noSave: "Progress won't be saved",
});

/** Grid col,row of square n (spec B1). */
export function squarePos(n) {
  if (n >= 1 && n <= 16) return [n - 1, 0];
  if (n >= 17 && n <= 25) return [15, n - 16];
  if (n >= 26 && n <= 41) return [15 - (n - 26), 10];
  if (n >= 42 && n <= 50) return [0, 10 - (n - 41)];
  throw new RangeError(`bad square ${n}`);
}

export const GRID = Object.freeze({ x: 46, y: 114, pitch: 76, cell: 70 });

/** Top-left pixel of square n's 70x70 face at the 1920x1080 reference. */
export function squareXY(n) {
  const [c, r] = squarePos(n);
  return [GRID.x + c * GRID.pitch + 3, GRID.y + r * GRID.pitch + 3];
}

/** Probability that the light stops on a square of tier t (one stop). */
export function pStop(t) {
  return WEIGHT_BY_TIER[t] / TOTAL_WEIGHT;
}

/** Probability a given square of tier t is hit by either light in one round (incl. Double Run, s2 != s1). */
export function pRound(t) {
  const pi = pStop(t);
  let s = 0;
  for (let j = 1; j <= 50; j++) {
    const pj = WEIGHTS[j] / TOTAL_WEIGHT;
    s += (pj * pi) / (1 - pj);
  }
  s -= (pi * pi) / (1 - pi); // the second stop never repeats the first
  return pi + s / DOUBLE_RUN_ONE_IN;
}

/** Throws if the arrangement map {"1":"24x",...} (design-tokens.json board-arrangement) differs from B1. */
export function assertArrangement(arr) {
  const keys = Object.keys(arr || {});
  if (keys.length !== 50) throw new Error(`board-arrangement has ${keys.length} squares, expected 50`);
  const counts = { 24: 0, 96: 0, 480: 0, 960: 0, 1920: 0 };
  for (let n = 1; n <= 50; n++) {
    const lab = arr[String(n)];
    const t = parseInt(String(lab).replace(/x$/, ''), 10);
    if (t !== MULT[n]) throw new Error(`board-arrangement mismatch at #${n}: ${lab} vs ${MULT[n]}x`);
    counts[t]++;
  }
  for (const t of TIERS) {
    if (counts[t] !== COUNT_BY_TIER[t]) throw new Error(`tier ${t}x count ${counts[t]} != ${COUNT_BY_TIER[t]}`);
  }
  if (TOTAL_WEIGHT !== 2093) throw new Error(`total weight ${TOTAL_WEIGHT} != 2093`);
  return true;
}

/** Self-check of the hard-coded table (counts and total weight). */
export function assertConfig() {
  for (const t of TIERS) {
    if (SQUARES_BY_TIER[t].length !== COUNT_BY_TIER[t]) throw new Error(`count mismatch ${t}`);
  }
  const all = TIERS.flatMap((t) => SQUARES_BY_TIER[t]).sort((a, b) => a - b);
  if (all.length !== 50 || all.some((n, i) => n !== i + 1)) throw new Error('layout does not cover 1..50 exactly once');
  if (TOTAL_WEIGHT !== 2093) throw new Error('total weight != 2093');
  return true;
}
assertConfig();
