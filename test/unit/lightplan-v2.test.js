// v2 light path (UI-side, src/ui/lightplan.js): 4-6 s, ~18 squares/s cruise, 1-2 laps, exact landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFirstRunV2, planSecondRunV2, advance } from '../../src/ui/lightplan.js';

const DRAWS = [[0, 0], [0.5, 0.3], [0.999, 0.999], [0.2, 0.8]];

test('v2 first run: lands on the stored stop, 4-6 s, 1-2 laps, cruise ~18 sq/s, monotonic', () => {
  let minC = Infinity, maxC = 0;
  for (let from = 1; from <= 50; from++) {
    for (let to = 1; to <= 50; to++) {
      for (const [u1, u2] of DRAWS) {
        const p = planFirstRunV2(from, to, u1, u2);
        assert.equal(p.indexAt(p.durationMs), to);
        assert.equal(p.indexAt(p.durationMs + 500), to);
        assert.equal(advance(from, p.steps), to);
        assert.ok(p.durationMs >= 4000 && p.durationMs <= 6000, `duration ${p.durationMs}`);
        assert.ok(p.laps >= 1 && p.laps < 2, `laps ${p.laps}`);
        assert.ok(p.phases.cruiseMs > 0);
        minC = Math.min(minC, p.cruise);
        maxC = Math.max(maxC, p.cruise);
        let last = -1;
        for (let t = 0; t <= p.durationMs; t += 16) {
          const x = p.pos(t);
          assert.ok(x >= last - 1e-9 && x <= p.steps + 1e-9);
          last = x;
        }
      }
    }
  }
  assert.ok(minC >= 15 && maxC <= 22, `cruise range ${minC.toFixed(1)}-${maxC.toFixed(1)} sq/s`);
});

test('v2 second run: lands on s2, 2-3 s, < 1 lap, never ends on s1', () => {
  for (let s1 = 1; s1 <= 50; s1++) {
    for (let s2 = 1; s2 <= 50; s2++) {
      if (s1 === s2) {
        assert.throws(() => planSecondRunV2(s1, s2, 0.5, 0.5));
        continue;
      }
      for (const [u1, u2] of DRAWS) {
        const p = planSecondRunV2(s1, s2, u1, u2);
        assert.equal(p.indexAt(p.durationMs), s2);
        assert.notEqual(p.indexAt(p.durationMs), s1);
        assert.ok(p.durationMs >= 2000 && p.durationMs <= 3000);
        assert.ok(p.steps >= 20 && p.steps < 50, `steps ${p.steps}`);
      }
    }
  }
});

test('v2 duration does not depend on the outcome beyond the distance (same draws, same profile shape)', () => {
  const a = planFirstRunV2(1, 30, 0.4, 0.4);
  const b = planFirstRunV2(11, 40, 0.4, 0.4); // same offset -> identical timing
  assert.equal(a.durationMs, b.durationMs);
  assert.equal(a.steps, b.steps);
});
