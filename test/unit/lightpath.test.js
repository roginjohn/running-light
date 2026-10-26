// Light path: outcome-first, exact landing, duration independent of outcome (spec B11, C integrity)
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFirstRun, planSecondRun, planFade, advance } from '../../src/engine/lightpath.js';

test('first run lands exactly on the stored stop for every from/to and cosmetic draw', () => {
  for (let from = 1; from <= 50; from++) {
    for (let to = 1; to <= 50; to++) {
      for (const [u1, u2] of [[0, 0], [0.5, 0.3], [0.999, 0.999]]) {
        const p = planFirstRun(from, to, u1, u2);
        assert.equal(p.indexAt(p.durationMs), to);
        assert.equal(advance(from, p.steps), to);
        assert.ok(p.durationMs >= 4000 && p.durationMs <= 6000, `duration ${p.durationMs}`);
        assert.ok(p.steps >= 25, 'visible run');
        assert.ok(p.cruise > 7 && p.cruise < 31, `cruise ${p.cruise}`);
        // monotonic, no reversals/creeps: position never decreases and never exceeds S
        let last = -1;
        for (let t = 0; t <= p.durationMs; t += 16) {
          const x = p.pos(t);
          assert.ok(x >= last - 1e-9 && x <= p.steps + 1e-9);
          last = x;
        }
      }
    }
  }
});

test('first-run duration depends only on cosmetic draws, not on the outcome', () => {
  const d = new Set();
  for (let to = 1; to <= 50; to++) d.add(planFirstRun(7, to, 0.25, 0.75).durationMs);
  assert.equal(d.size, 1);
});

test('second run starts after s1, ends on s2, 2-3 s, never ends on s1', () => {
  for (let s1 = 1; s1 <= 50; s1++) {
    for (let s2 = 1; s2 <= 50; s2++) {
      if (s1 === s2) {
        assert.throws(() => planSecondRun(s1, s2, 0.5, 0.5));
        continue;
      }
      const p = planSecondRun(s1, s2, 0.5, 0.5);
      assert.equal(p.indexAt(0), advance(s1, 1));
      assert.equal(p.indexAt(p.durationMs), s2);
      assert.notEqual(p.indexAt(p.durationMs), s1);
      assert.ok(p.durationMs >= 2000 && p.durationMs <= 3000);
    }
  }
});

test('reduced motion: 3 steps over 0.8 s at the stop only', () => {
  const p = planFade(13);
  assert.deepEqual([0, 300, 600, 800].map(p.levelAt), [0, 0.4, 0.7, 1]);
  assert.equal(p.indexAt(0), 13);
  assert.equal(p.durationMs, 800);
});
