// v3 batch 4 performance evidence: a Chrome performance trace (puppeteer Tracing, devtools.timeline) of one full
// light run at 1920x1080, real speed, with and without 4x CPU throttling. Counts per light step: Layout events
// (and how big they are), forced (synchronous) layouts triggered from script, style recalcs, paints, and the
// script time per animation frame and long tasks. Prints a JSON summary.
// Usage: npm run build && node test/ui/perf-trace.js [--trace /tmp/rl-trace.json]
import { writeFileSync } from 'node:fs';
import { startServer, launch, openGame, waitPhase, sleep } from './harness.js';
import { setup, force } from './scenes.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const { server, url } = await startServer();
const browser = await launch();
const out = {};

async function one(label, throttle) {
  const page = await openGame(browser, url, { seed: 3, timeScale: 1, width: 1920, height: 1080 });
  await setup(page, { balance: 1000, bets: { 3: 2, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5 }, chip: 5 });
  await force(page, 30);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // count light steps from the UI state in a rAF loop (reads JS state only, no DOM)
  await page.evaluate(() => {
    const S = window.__steps = { n: 0, last: null, on: true };
    const tick = () => {
      const L = window.__rl.app.ui.light1;
      const idx = L ? L.idx : null;
      if (idx != null && idx !== S.last) { S.n += 1; S.last = idx; }
      if (S.on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await sleep(200);
  await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'blink.user_timing'] });
  await page.evaluate(() => { performance.mark('run-start'); window.__rl.game.dispatch({ type: 'START' }); });
  await waitPhase(page, ['RESOLVING', 'GAMBLE_OFFER'], 30000);
  await page.evaluate(() => performance.mark('run-end'));
  const buf = Buffer.from(await page.tracing.stop());
  const steps = await page.evaluate(() => { window.__steps.on = false; return window.__steps.n; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.close();

  const trace = JSON.parse(buf.toString());
  if (args.trace && throttle === 1) writeFileSync(args.trace, buf);
  const ev = trace.traceEvents || trace;
  const mark = (n) => ev.find((e) => e.name === n && e.cat.includes('user_timing'));
  const t0 = mark('run-start').ts, t1 = mark('run-end').ts;
  // the renderer main thread = the thread that ran our rAF callbacks
  const fire = ev.filter((e) => e.name === 'FireAnimationFrame' && e.ts >= t0 && e.ts <= t1);
  const main = fire.length ? `${fire[0].pid}:${fire[0].tid}` : null;
  const inRun = ev.filter((e) => `${e.pid}:${e.tid}` === main && e.ts >= t0 && e.ts <= t1);
  const named = (n) => inRun.filter((e) => e.name === n && e.ph === 'X');
  // a layout is "forced" when it runs inside script (FunctionCall / FireAnimationFrame / EvaluateScript), i.e.
  // a synchronous layout read, instead of in the frame's own rendering lifecycle
  const scripts = inRun.filter((e) => ['FunctionCall', 'FireAnimationFrame', 'EvaluateScript', 'TimerFire', 'EventDispatch'].includes(e.name) && e.ph === 'X');
  const inside = (e) => scripts.some((s) => e.ts >= s.ts && e.ts + (e.dur || 0) <= s.ts + s.dur);
  const layouts = named('Layout');
  // skip START's one-off re-render (rail, centre copy, credits tween start): the first frame of the run
  const firstFrameEnd = fire.length ? fire[0].ts + fire[0].dur : t0;
  const runLayouts = layouts.filter((e) => e.ts > firstFrameEnd);
  const forced = layouts.filter(inside);
  const dirty = runLayouts.map((e) => e.args?.beginData?.dirtyObjects ?? null).filter((x) => x != null);
  const total = runLayouts.map((e) => e.args?.beginData?.totalObjects ?? null).filter((x) => x != null);
  const roots = runLayouts.map((e) => (e.args?.endData?.layoutRoots || []).length);
  const ms = (us) => Math.round(us / 10) / 100;
  const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
  const fireDur = fire.map((e) => e.dur);
  const longTasks = inRun.filter((e) => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.ph === 'X' && e.dur > 50000);
  out[label] = {
    cpuThrottle: throttle, runMs: ms(t1 - t0), lightSteps: steps, animationFrames: fire.length,
    layoutEvents: layouts.length, layoutEventsAfterFirstFrame: runLayouts.length,
    layoutsPerStep: Math.round((runLayouts.length / steps) * 100) / 100,
    forcedLayoutsFromScript: forced.length,
    layoutDirtyObjects: { max: Math.max(0, ...dirty), median: pct(dirty, 0.5) },
    layoutTotalObjects: { max: Math.max(0, ...total), median: pct(total, 0.5) },
    layoutRootsPerLayout: { max: Math.max(0, ...roots) },
    layoutTimeMs: { total: ms(runLayouts.reduce((a, e) => a + e.dur, 0)), max: ms(Math.max(0, ...runLayouts.map((e) => e.dur))) },
    styleRecalcs: named('UpdateLayoutTree').length, paints: named('Paint').length,
    rafScriptMs: { median: ms(pct(fireDur, 0.5)), p95: ms(pct(fireDur, 0.95)), max: ms(Math.max(0, ...fireDur)) },
    longTasksOver50ms: longTasks.length,
  };
}

try {
  await one('desktop', 1);
  await one('cpu4x', 4);
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(out, null, 2));
