// Light-run path planning (spec B11, animation notes #7/#9). Pure and outcome-first:
// the path is computed from the current index and the STORED stop, and always lands exactly on it.
// Duration is chosen from cosmetic randomness only (u1, u2 in [0,1)), never from the outcome.

const TRACK = 50;
const CRUISE = 18; // squares per second (token motion.light-cruise)

function stepsBetween(from, to) {
  return (to - from + TRACK) % TRACK;
}

/** Index (1..50) reached after `steps` squares clockwise from `from`. */
export function advance(from, steps) {
  return ((from - 1 + steps) % TRACK + TRACK) % TRACK + 1;
}

function makeProfile({ from, to, ta, tc, td, S }) {
  const den = ta / 3 + tc + td / 3;
  const vmax = S / den; // squares per second at cruise
  const T = ta + tc + td;
  function pos(tSec) {
    if (tSec <= 0) return 0;
    if (tSec >= T) return S;
    if (tSec < ta) return (vmax * tSec * tSec * tSec) / (3 * ta * ta); // ease-in
    if (tSec < ta + tc) return vmax * (ta / 3 + (tSec - ta));
    const u = (tSec - ta - tc) / td; // ease-out (v = vmax (1-u)^2)
    return vmax * (ta / 3 + tc) + (vmax * td * (1 - (1 - u) ** 3)) / 3;
  }
  return {
    mode: 'run', from, to, steps: S, laps: Math.floor(S / TRACK), durationMs: T * 1000, cruise: vmax,
    phases: { accelMs: ta * 1000, cruiseMs: tc * 1000, decelMs: td * 1000 },
    /** Steps travelled at time ms (float). */
    pos: (ms) => pos(ms / 1000),
    /** Lit index at time ms; equals `to` exactly at/after the end. */
    indexAt(ms) {
      if (ms >= T * 1000) return to;
      return advance(from, Math.floor(pos(ms / 1000) + 1e-9));
    },
    /** Speed (squares/s) at time ms, used for the tick pitch and trail length. */
    speedAt(ms) {
      const t = ms / 1000;
      if (t <= 0 || t >= T) return 0;
      if (t < ta) return vmax * (t / ta) ** 2;
      if (t < ta + tc) return vmax;
      return vmax * (1 - (t - ta - tc) / td) ** 2;
    },
  };
}

/**
 * First light: accelerate 0.6 s -> cruise 1.7-2.5 s -> decelerate 1.7-2.5 s (total 4.0-5.6 s).
 * Distance = offset + 50k (>= 25 squares) with k chosen so the cruise speed is closest to 18 squares/s.
 * Result: 0.5-1.5 laps at ~7-30 squares/s cruise (see IMPLEMENTATION-REPORT open question Q1 on "2-4 laps").
 */
export function planFirstRun(from, to, u1, u2) {
  const ta = 0.6;
  const tc = 1.7 + 0.8 * u1;
  const td = 1.7 + 0.8 * u2;
  const den = ta / 3 + tc + td / 3;
  const off = stepsBetween(from, to);
  let best = null;
  for (let k = 0; k <= 4; k++) {
    const S = off + TRACK * k;
    if (S < 25) continue; // always a visible run of at least half a lap
    const d = Math.abs(S / den - CRUISE);
    if (!best || d < best.d) best = { S, d };
  }
  return makeProfile({ from, to, ta, tc, td, S: best.S });
}

/**
 * Second (Double Run) light: starts on the square after the first stop, 2-3 s, ~1.5 laps,
 * same accelerate/cruise/decelerate shape. It cannot stop on the first square because s2 != s1.
 */
export function planSecondRun(s1, s2, u1, u2) {
  if (s1 === s2) throw new Error('second stop equals first stop');
  const from = advance(s1, 1);
  const T = 2 + u1; // 2-3 s
  const ta = 0.4;
  const td = 0.9 + 0.3 * u2;
  const tc = T - ta - td;
  const off = stepsBetween(from, s2);
  let best = null;
  for (let k = 0; k <= 3; k++) {
    const S = off + TRACK * k;
    if (S < 25) continue;
    const d = Math.abs(S - 75);
    if (!best || d < best.d) best = { S, d };
  }
  return makeProfile({ from, to: s2, ta, tc, td, S: best.S });
}

/** Reduced motion: no chase. The stop square fades 0 -> 40% -> 70% -> lit in 3 steps over 0.8 s. */
export function planFade(to) {
  const T = 800;
  return {
    mode: 'fade', from: to, to, steps: 0, laps: 0, durationMs: T,
    levelAt: (ms) => (ms >= T ? 1 : ms >= (2 * T) / 3 ? 0.7 : ms >= T / 3 ? 0.4 : 0),
    indexAt: () => to,
    speedAt: () => 0,
    pos: () => 0,
  };
}
