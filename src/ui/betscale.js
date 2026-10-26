// 1/2 and x2 on the bet field (v3 batch 3): scale every square's bet at once. Pure; uses the locked engine limits
// (1-10 per square, 200 per round, the balance) and never touches the engine. START still re-checks every limit.
import { MAX_PER_SQUARE, MAX_PER_ROUND, MIN_BET } from '../engine/config.js';
import { totalOf } from '../engine/bets.js';

const squaresOf = (bets) => Object.keys(bets).map(Number).sort((a, b) => a - b);

/** Halve every square's bet (rounded down, never below 1). Returns { bets, changed, limit: null }. */
export function halveBets(bets) {
  const next = {};
  let changed = false;
  for (const n of squaresOf(bets)) {
    next[n] = Math.max(MIN_BET, Math.floor(bets[n] / 2));
    if (next[n] !== bets[n]) changed = true;
  }
  return { bets: changed ? next : bets, changed, limit: null };
}

/**
 * Double every square's bet, clamped to 10 per square and to min(200, balance) for the round. When the round cap
 * cuts in, the room left is shared out one credit at a time in square order, so the squares stay even.
 * Returns { bets, changed, limit } where limit is null | 'square' | 'round' | 'credits' (the cap that cut in;
 * the keys match the engine's TOASTS).
 */
export function doubleBets(bets, balance) {
  const ns = squaresOf(bets);
  const target = {};
  let squareCut = false;
  for (const n of ns) {
    target[n] = Math.min(MAX_PER_SQUARE, bets[n] * 2);
    if (bets[n] * 2 > MAX_PER_SQUARE) squareCut = true;
  }
  const cap = Math.min(MAX_PER_ROUND, Math.max(0, balance));
  const capKind = MAX_PER_ROUND <= balance ? 'round' : 'credits';
  const next = { ...bets };
  let total = totalOf(bets);
  let limit = null;
  if (totalOf(target) <= cap) {
    Object.assign(next, target);
    total = totalOf(target);
    if (squareCut) limit = 'square';
  } else {
    let grew = true;
    while (total < cap && grew) {
      grew = false;
      for (const n of ns) {
        if (total >= cap) break;
        if (next[n] < target[n]) {
          next[n]++;
          total++;
          grew = true;
        }
      }
    }
    limit = capKind;
  }
  const changed = ns.some((n) => next[n] !== bets[n]);
  return { bets: changed ? next : bets, changed, limit };
}
