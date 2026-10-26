// v2 light-run planning (design-tokens-v2 motion: light-total 4-6 s, cruise ~18 squares/s, 1-2 laps;
// second light 2-3 s, < 1 lap). UI-side because src/engine/ is locked; it re-uses the engine's `advance` and
// `planFade`. Pure and outcome-first: the path ends exactly on the STORED stop. Durations use cosmetic
// randomness only (u1, u2 in [0,1)), never the outcome.
import { advance, planFade } from '../engine/lightpath.js';

export { advance, planFade };

const TRACK = 50;
export const CRUISE = 18; // squares per second (motion.light-cruise)

function stepsBetween(from, to) {
  return (to - from + TRACK) % TRACK;
}

/** Accelerate (cubic ease-in) -> linear cruise -> decelerate (cubic ease-out) over S squares. */
function makeProfile({ from, to, ta, tc, td, S }) {
  const den = ta / 3 + tc + td / 3;
  const vmax = S / den;
  const T = ta + tc + td;
  function pos(t) {
    if (t <= 0) return 0;
    if (t >= T) return S;
    if (t < ta) return (vmax * t * t * t) / (3 * ta * ta);
    if (t < ta + tc) return vmax * (ta / 3 + (t - ta));
    const u = (t - ta - tc) / td;
    return vmax * (ta / 3 + tc) + (vmax * td * (1 - (1 - u) ** 3)) / 3;
  }
  return {
    mode: 'run', from, to, steps: S, laps: S / TRACK, durationMs: T * 1000, cruise: vmax,
    phases: { accelMs: ta * 1000, cruiseMs: tc * 1000, decelMs: td * 1000 },
    pos: (ms) => pos(ms / 1000),
    indexAt(ms) {
      if (ms >= T * 1000) return to;
      return advance(from, Math.floor(pos(ms / 1000) + 1e-9));
    },
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
 * First light: accelerate 0.6 s -> cruise at ~18 sq/s -> decelerate 1.5-2.2 s; distance = one full lap plus the
 * offset to the stop (50-99 squares = 1-2 laps). The cruise time is solved for 18 sq/s and the total is clamped to
 * 4-6 s (cruise then lands between ~16 and ~22 sq/s).
 */
export function planFirstRunV2(from, to, u1, u2) {
  const ta = 0.6;
  const S = stepsBetween(from, to) + TRACK;
  const td = S > 80 ? 1.5 : 1.5 + 0.7 * u2; // long runs keep the short end so the cruise stays near 18 sq/s
  const ideal = ta + td + (S / CRUISE - ta / 3 - td / 3);
  const T = Math.min(6, Math.max(4, ideal + 0.2 * (u1 - 0.5)));
  const tc = T - ta - td;
  return makeProfile({ from, to, ta, tc, td, S });
}

/**
 * Second (Double Run) light: runs 2-3 s and less than one lap (20-49 squares), normally starting on the square
 * after the first stop. When s2 is fewer than 20 squares after s1 it starts 25 squares further back so the run
 * stays visible. It can only stop on the stored s2, and s2 != s1.
 */
export function planSecondRunV2(s1, s2, u1, u2) {
  if (s1 === s2) throw new Error('second stop equals first stop');
  const off = stepsBetween(advance(s1, 1), s2);
  const S = off >= 20 ? off : off + 25;
  const from = advance(s2, -S);
  const T = 2 + u1; // 2-3 s
  const ta = 0.4;
  const td = 0.9 + 0.3 * u2;
  const tc = T - ta - td;
  return makeProfile({ from, to: s2, ta, tc, td, S });
}

export { planFade as planFadeV2 };
