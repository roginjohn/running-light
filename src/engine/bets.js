// Bet operations with limit clamping (spec B4). Bets are plain objects { [square]: amount } with integer amounts 1..10.
import { MAX_PER_SQUARE, MAX_PER_ROUND, CHIPS, TOASTS } from './config.js';

export function isSquare(n) {
  return Number.isInteger(n) && n >= 1 && n <= 50;
}

export function totalOf(bets) {
  let s = 0;
  for (const k in bets) s += bets[k];
  return s;
}

export function countOf(bets) {
  return Object.keys(bets).length;
}

export function cloneBets(bets) {
  const out = {};
  for (const k in bets) if (bets[k] > 0) out[k] = bets[k];
  return out;
}

export function sameBets(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/**
 * Add a chip to a square, clamped to the remaining room (square cap, round cap, balance).
 * Returns { bets, added, toast }. room = 0 -> no change, toast only.
 */
export function addChip(bets, square, chip, balance) {
  if (!isSquare(square)) throw new RangeError('bad square');
  if (!CHIPS.includes(chip)) throw new RangeError('bad chip');
  if (!Number.isInteger(balance) || balance < 0) throw new RangeError('bad balance');
  const cur = bets[square] || 0;
  const total = totalOf(bets);
  const rooms = [
    ['square', MAX_PER_SQUARE - cur],
    ['round', MAX_PER_ROUND - total],
    ['credits', balance - total],
  ];
  let reason = rooms[0];
  for (const r of rooms) if (r[1] < reason[1]) reason = r;
  const room = Math.max(0, reason[1]);
  const added = Math.min(chip, room);
  const toast = added < chip ? TOASTS[reason[0]] : null;
  if (added === 0) return { bets, added: 0, toast };
  const next = { ...bets, [square]: cur + added };
  return { bets: next, added, toast };
}

/** Remove one chip value from a square (floor 0). Returns { bets, removed }. */
export function removeChip(bets, square, chip) {
  if (!isSquare(square)) throw new RangeError('bad square');
  if (!CHIPS.includes(chip)) throw new RangeError('bad chip');
  const cur = bets[square] || 0;
  if (cur === 0) return { bets, removed: 0 };
  const removed = Math.min(cur, chip);
  const next = { ...bets };
  if (cur - removed === 0) delete next[square];
  else next[square] = cur - removed;
  return { bets: next, removed };
}

/** Validate a bet map read from storage or used for Rebet. */
export function validBets(bets, { allowEmpty = true } = {}) {
  if (!bets || typeof bets !== 'object' || Array.isArray(bets)) return false;
  const keys = Object.keys(bets);
  if (!allowEmpty && keys.length === 0) return false;
  let total = 0;
  for (const k of keys) {
    const n = Number(k);
    const v = bets[k];
    if (!isSquare(n) || String(n) !== k) return false;
    if (!Number.isInteger(v) || v < 1 || v > MAX_PER_SQUARE) return false;
    total += v;
  }
  return total <= MAX_PER_ROUND;
}

/** Rebet availability: null if allowed, else a reason string for the tooltip. */
export function rebetBlockReason(lastBets, balance) {
  const t = lastBets ? totalOf(lastBets) : 0;
  if (!t) return 'No previous round to rebet';
  if (t > balance) return `Not enough credits for last round's ${t} bet`;
  return null;
}
