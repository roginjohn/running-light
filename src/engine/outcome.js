// Outcome generation and payout (spec B2, B3). Pure functions; all draws happen before any animation.
import { WEIGHTS, TOTAL_WEIGHT, MULT, DOUBLE_RUN_ONE_IN, MAX_GAMBLES, GAMBLE_CAP } from './config.js';

/**
 * Walk squares 1..50 accumulating weights; return the first square where cumulative > r.
 * `weights` is indexed by square number (index 0 ignored). `exclude` (optional) is treated as weight 0.
 */
export function weightedPick(r, weights = WEIGHTS, exclude = 0) {
  let cum = 0;
  for (let n = 1; n <= 50; n++) {
    if (n === exclude) continue;
    cum += weights[n];
    if (cum > r) return n;
  }
  throw new RangeError(`weightedPick: r=${r} out of range`);
}

/** Draw one round: { s1, doubleRun, s2 }. Order of draws is fixed by spec B2. */
export function drawRound(rng) {
  const s1 = weightedPick(rng.randInt(TOTAL_WEIGHT));
  const doubleRun = rng.randInt(DOUBLE_RUN_ONE_IN) === 0;
  let s2 = null;
  if (doubleRun) s2 = weightedPick(rng.randInt(TOTAL_WEIGHT - WEIGHTS[s1]), WEIGHTS, s1);
  return { s1, doubleRun, s2 };
}

/** Integer payout: sum of bet[i] * mult[i] over the stop squares (each square pays once). */
export function payout(bets, s1, s2 = null) {
  let win = 0;
  const seen = new Set();
  for (const s of [s1, s2]) {
    if (s == null || seen.has(s)) continue;
    seen.add(s);
    win += (bets[s] || 0) * MULT[s];
  }
  return win;
}

/** Per-stop win breakdown, for display. */
export function winParts(bets, s1, s2 = null) {
  const parts = [];
  for (const s of [s1, s2]) {
    if (s == null) continue;
    const b = bets[s] || 0;
    parts.push({ square: s, bet: b, mult: MULT[s], win: b * MULT[s] });
  }
  return parts;
}

/** Fair gamble draw: randInt(2) === 0 ? 'red' : 'white'. */
export function gambleDraw(rng) {
  return rng.randInt(2) === 0 ? 'red' : 'white';
}

/** Why gambling is not allowed (null when allowed). */
export function gambleBlockReason(win, gamblesUsed) {
  if (!(win > 0)) return 'nowin';
  if (gamblesUsed >= MAX_GAMBLES) return 'max';
  if (2 * win > GAMBLE_CAP) return 'cap';
  return null;
}
