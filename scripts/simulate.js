#!/usr/bin/env node
// E2 seeded simulation. Drives the REAL engine (createGame + dispatch) with a seeded sfc32 RNG.
// Usage: node scripts/simulate.js [--rounds N] [--rounds-b N] [--seed S] [--strategy A|B|both] [--out dir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame } from '../src/engine/game.js';
import { createSeededRng } from '../src/engine/rng.js';
import { memoryBackend } from '../src/engine/storage.js';
import { MULT, TIERS, COUNT_BY_TIER, pRound, DOUBLE_RUN_ONE_IN } from '../src/engine/config.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const ROUNDS_A = Number(args.rounds || 5_000_000);
const ROUNDS_B = Number(args['rounds-b'] || args.rounds || 5_000_000);
const SEED = Number(args.seed ?? 20261022);
const STRATEGY = args.strategy || 'both';
const OUT = args.out || new URL('../test-results/', import.meta.url).pathname;

const THEO_RTP = TIERS.reduce((s, t) => s + COUNT_BY_TIER[t] * t * pRound(t), 0) / 50;

const JSON_STORAGE = args['json-storage'] === '1';

/** Simulation backend: keeps written values by reference (skips JSON serialization; engine logic unchanged). */
function objectBackend() {
  const m = new Map();
  return { getItem: () => null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), setJSON: (k, v) => m.set(k, v) };
}

function makeGame(seed) {
  let id = 0;
  const g = createGame({
    rng: createSeededRng(seed),
    backend: JSON_STORAGE ? memoryBackend() : objectBackend(),
    testMode: true,
    now: () => 0,
    idGen: () => `s${++id}`,
  });
  g.init();
  return g;
}

function must(g, action) {
  const r = g.dispatch(action);
  if (!r.ok) throw new Error(`${action.type} rejected in ${g.state.phase}: ${r.reason}`);
}

function run(strategy, rounds, seed) {
  const g = makeGame(seed);
  const TOP = 1_000_000_000;
  g.test.setBalance(TOP);
  for (let s = 1; s <= 50; s++) must(g, { type: 'ADD_BET', square: s }); // chip 1 on all 50 squares
  let wagered = 0, returned = 0, sumSq = 0, drRounds = 0, sameStops = 0;
  let flips = 0, flipWins = 0, gambleRounds = 0, roundsWithWin = 0;
  const tierHits = Object.fromEntries(TIERS.map((t) => [t, 0]));
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < rounds; i++) {
    if (g.state.phase !== 'BETTING') throw new Error(`unexpected phase ${g.state.phase}`);
    if (!Object.keys(g.state.bets).length) must(g, { type: 'REBET' });
    if (g.state.balance < 1000) g.test.setBalance(TOP); // simulation top-up hook
    const balBefore = g.state.balance;
    must(g, { type: 'START' });
    const r = g.state.round;
    wagered += r.totalBet;
    tierHits[MULT[r.s1]]++;
    if (r.doubleRun) {
      drRounds++;
      tierHits[MULT[r.s2]]++;
      if (r.s1 === r.s2) sameStops++;
    }
    must(g, { type: 'LIGHT1_DONE' });
    must(g, { type: 'RESOLVE_DONE' });
    if (g.state.phase === 'DOUBLE_RUN') must(g, { type: 'LIGHT2_DONE' });
    if (g.state.phase === 'GAMBLE_OFFER') {
      roundsWithWin++;
      if (strategy === 'B' && g.gambleBlock() === null) {
        gambleRounds++;
        must(g, { type: 'GAMBLE_OPEN' });
        must(g, { type: 'PICK', colour: 'red' });
        while (g.state.phase === 'GAMBLE' && g.gambleBlock() === null) {
          must(g, { type: 'GAMBLE_FLIP' });
          must(g, { type: 'REVEAL_DONE' });
          flips++;
          const last = r.gambles[r.gambles.length - 1];
          if (last.pick === last.result) flipWins++;
        }
        if (g.state.phase === 'GAMBLE') must(g, { type: 'COLLECT' });
      } else must(g, { type: 'COLLECT' });
      must(g, { type: 'PAYOUT_DONE' });
    }
    if (!r.settled) throw new Error('round not settled');
    const win = r.currentWin;
    if (g.state.balance !== balBefore - r.totalBet + win) throw new Error('balance integrity violated');
    returned += win;
    const x = win / r.totalBet;
    sumSq += x * x;
  }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  const rtp = returned / wagered;
  const meanX = rtp; // equal stake every round
  const varX = sumSq / rounds - meanX * meanX;
  const se = Math.sqrt(varX / rounds);
  const tiers = TIERS.map((t) => {
    const trials = rounds * COUNT_BY_TIER[t];
    const p = pRound(t);
    const rate = tierHits[t] / trials;
    return {
      tier: `${t}x`, squares: COUNT_BY_TIER[t], hits: tierHits[t],
      hitRatePerSquarePerRound: rate, theoreticalHitRate: p,
      z: (rate - p) / Math.sqrt((p * (1 - p)) / trials),
      rtp: (tierHits[t] * t) / trials, theoreticalRtp: p * t,
    };
  });
  const drRate = drRounds / rounds;
  const res = {
    strategy, seed, rounds, runtimeSeconds: +secs.toFixed(2),
    wagered, returned, rtp, theoreticalRtp: THEO_RTP, rtpStandardError: se,
    rtpZ: (rtp - THEO_RTP) / se,
    rtpBandPass: Math.abs(rtp - 0.9545) <= 0.003,
    doubleRun: { rounds: drRounds, rate: drRate, expected: 1 / DOUBLE_RUN_ONE_IN, z: (drRate - 0.04) / Math.sqrt((0.04 * 0.96) / rounds) },
    s1EqualsS2: sameStops,
    roundsWithWin,
    tiers,
  };
  if (strategy === 'B') {
    const wr = flips ? flipWins / flips : 0;
    res.gamble = {
      roundsGambled: gambleRounds, flips, wins: flipWins, winRate: wr,
      z: (wr - 0.5) / Math.sqrt(0.25 / flips), winRatePass: Math.abs(wr - 0.5) <= 0.002,
    };
  }
  return res;
}

function pct(x, d = 3) {
  return (x * 100).toFixed(d) + '%';
}

function report(res) {
  const L = [];
  L.push(`### Strategy ${res.strategy} — seed ${res.seed}, ${res.rounds.toLocaleString('en-US')} rounds, ${res.runtimeSeconds}s`);
  L.push('');
  L.push(`- RTP: **${pct(res.rtp)}** (theoretical ${pct(res.theoreticalRtp)}; SE ${(res.rtpStandardError * 100).toFixed(3)} pp; z = ${res.rtpZ.toFixed(2)}) — band 95.45% ± 0.3 pp: **${res.rtpBandPass ? 'PASS' : 'FAIL'}**`);
  L.push(`- Wagered ${res.wagered.toLocaleString('en-US')}, returned ${res.returned.toLocaleString('en-US')}`);
  L.push(`- Double Run rate: ${pct(res.doubleRun.rate)} vs 4.000% (z = ${res.doubleRun.z.toFixed(2)}), ${res.doubleRun.rounds.toLocaleString('en-US')} rounds`);
  L.push(`- s1 == s2 occurrences: **${res.s1EqualsS2}** (must be 0)`);
  if (res.gamble) {
    L.push(`- Gamble: ${res.gamble.flips.toLocaleString('en-US')} flips, win rate **${pct(res.gamble.winRate)}** (z = ${res.gamble.z.toFixed(2)}) — 50% ± 0.2 pp: **${res.gamble.winRatePass ? 'PASS' : 'FAIL'}**`);
  }
  L.push('');
  L.push('| Tier | Squares | Hit rate / square / round | Theoretical | z | Tier RTP | Theoretical |');
  L.push('|---|---|---|---|---|---|---|');
  for (const t of res.tiers) {
    L.push(`| ${t.tier} | ${t.squares} | ${pct(t.hitRatePerSquarePerRound, 4)} | ${pct(t.theoreticalHitRate, 4)} | ${t.z.toFixed(2)} | ${pct(t.rtp)} | ${pct(t.theoreticalRtp)} |`);
  }
  L.push('');
  return L.join('\n');
}

mkdirSync(OUT, { recursive: true });
const results = [];
if (STRATEGY === 'A' || STRATEGY === 'both') results.push(run('A', ROUNDS_A, SEED));
if (STRATEGY === 'B' || STRATEGY === 'both') results.push(run('B', ROUNDS_B, SEED + 1));
const md = [
  '# E2 seeded simulation (real engine)',
  '',
  `Command: \`node scripts/simulate.js ${process.argv.slice(2).join(' ')}\` · Node ${process.version} · ${new Date().toISOString()}`,
  `Storage backend: ${JSON_STORAGE ? 'in-memory JSON strings (same as browser)' : 'in-memory object references (JSON serialization skipped for speed; same engine code path)'}.`,
  'PRNG: sfc32 seeded via splitmix32 (test mode only). Strategy A: 1 credit on all 50 squares, always Collect, balance topped up by the simulation hook. Strategy B: same bets, always gamble the maximum allowed (pick RED), then Collect.',
  '',
  ...results.map(report),
].join('\n');
writeFileSync(`${OUT}/simulation.json`, JSON.stringify(results, null, 2));
writeFileSync(`${OUT}/simulation.md`, md + '\n');
console.log(md);
const pass = results.every((r) => r.rtpBandPass && r.s1EqualsS2 === 0 && (!r.gamble || r.gamble.winRatePass));
console.log(pass ? '\nE2 RESULT: PASS' : '\nE2 RESULT: FAIL');
process.exitCode = pass ? 0 : 1;
