// E4: capture the mockup states at 1920x1080 (forced outcomes, test mode), plus side-by-side and diff images.
// Usage: node test/ui/screenshots.js   (requires npm run build)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { startServer, launch, openGame, sleep, waitPhase, clickId, centerOf } from './harness.js';
import { setup, playTo, dispatch, settle, BETS, H01, H03, H04, H06 } from './scenes.js';

const OUT = path.resolve(new URL('../../test-results/screenshots/', import.meta.url).pathname);
const MOCK = path.resolve(new URL('../../../design/session-one/mockups/', import.meta.url).pathname);
mkdirSync(path.join(OUT, 'compare'), { recursive: true });

const { server, url } = await startServer();
const browser = await launch();
const results = [];
const allIssues = [];

async function shot(name, fn, opts = {}) {
  const page = await openGame(browser, url, { seed: 7, timeScale: opts.timeScale || 1, ...opts });
  try {
    await fn(page);
    await page.mouse.move(opts.mouseX ?? 1910, opts.mouseY ?? 1075).catch(() => {});
    if (opts.keepHover) await opts.keepHover(page);
    await sleep(opts.extraWait ?? 150);
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    results.push({ name, file, w: opts.width || 1920, h: opts.height || 1080 });
    allIssues.push(...page.__issues.map((i) => `${name}: ${i}`));
    console.log('captured', name);
  } finally {
    await page.close();
  }
}

const focusRing = (page, id) => page.evaluate((i) => window.__rl.app.focusId(i), id);

// 01 betting: 9 bets (40), chip 5, hover tooltip on #49, keyboard focus on #20
await shot('01-board-betting', async (page) => {
  await setup(page);
  await focusRing(page, 'sq-20');
}, {
  keepHover: async (page) => {
    const p = await centerOf(page, 'sq-49');
    await page.mouse.move(p.x, p.y);
    await sleep(450);
  },
});

// 02 spinning: light on #19, trail #18/#17 (animation paused at that frame)
await shot('02-spinning', async (page) => {
  await setup(page);
  await page.evaluate(() => window.__rl.game.test.forceNextOutcome({ s1: 12 }));
  await dispatch(page, { type: 'START' });
  await page.evaluate(() => {
    const app = window.__rl.app;
    app.setPaused(true);
    app.ui.displayBalance = null;
    app.ui.light1 = { idx: 19, trail: [18, 17], level: null };
    app.render();
  });
});

// 03 single win #12 (5 x 96 = 480), Collect focused
await shot('03-win-single', async (page) => {
  await setup(page);
  await playTo(page, 12);
  await sleep(2000); // let the win pulse finish
  await focusRing(page, 'btn-collect');
}, { timeScale: 4 });

// 04 Double Run #24 + #13 (120 + 960 = 1,080)
await shot('04-double-run-result', async (page) => {
  await setup(page, { balance: 2160, history: H03 });
  await playTo(page, 24, 13);
  await sleep(2000);
  await focusRing(page, 'btn-collect');
}, { timeScale: 4 });

// 05 gamble: after flip 1 won (picked WHITE), RED picked for flip 2 (selected + focus)
await shot('05-gamble', async (page) => {
  await setup(page);
  await playTo(page, 12);
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'white' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing);
  await settle(page);
  await page.keyboard.press('r');
  await sleep(200);
}, { timeScale: 4 });

// 06 loss on #27 (no bet), bets kept, START focused
await shot('06-loss', async (page) => {
  await setup(page, { balance: 3200, history: H04 });
  await playTo(page, 27, null, 'BETTING');
  await focusRing(page, 'btn-start');
}, { timeScale: 4 });

// 07 refill modal at balance 0
await shot('07-refill-modal', async (page) => {
  await setup(page, { balance: 0, history: H06, bets: {} });
  await page.evaluate(() => window.__rl.app.render());
  await focusRing(page, 'm-refill');
});

// 08a/b/c tabbed modal over the 01 board
for (const [name, tab] of [['08a-settings', 'settings'], ['08b-paytable', 'paytable'], ['08c-help', 'help']]) {
  await shot(name, async (page) => {
    await setup(page);
    await dispatch(page, { type: 'OPEN_INFO', tab });
    await sleep(300);
    if (tab === 'settings') await focusRing(page, 'sl-music');
  });
}

// 09a error during the 02 round
await shot('09a-error', async (page) => {
  await setup(page);
  await page.evaluate(() => window.__rl.game.test.forceNextOutcome({ s1: 12 }));
  await dispatch(page, { type: 'START' });
  await sleep(300);
  await dispatch(page, { type: 'FAIL', message: 'screenshot: simulated failure' });
  await page.evaluate(() => { window.__rl.app.ui.light1 = null; window.__rl.app.ui.displayBalance = null; window.__rl.app.render(); });
  await sleep(300);
  await focusRing(page, 'm-reload');
});

// 09b recovery: reload mid-spin
await shot('09b-recovery', async (page) => {
  await setup(page);
  await page.evaluate(() => window.__rl.game.test.forceNextOutcome({ s1: 12 }));
  await dispatch(page, { type: 'START' });
  await sleep(300);
  await openGame(browser, url, { seed: 99, keepStorage: true }, page);
  await waitPhase(page, 'RECOVERY');
  await focusRing(page, 'm-continue');
});

// B13 fix 1 checks: Double Run winners on #13 and #8 (both orders)
await shot('fix1-double-run-13-then-8', async (page) => {
  await setup(page, { bets: { ...BETS } });
  await playTo(page, 13, 8);
  await sleep(4500); // 1920x jackpot celebration finishes
}, { timeScale: 4 });
await shot('fix1-double-run-8-then-13', async (page) => {
  await setup(page);
  await playTo(page, 8, 13);
  await sleep(4500);
}, { timeScale: 4 });

// 01 at 1280x720 (scaled stage)
await shot('01-board-betting-1280x720', async (page) => {
  await setup(page);
}, { width: 1280, height: 720 });

// Below minimum -> "Please enlarge window"
await shot('enlarge-window-1200x700', async () => {}, { width: 1200, height: 700 });

// Extra state (no mockup): 1920x jackpot celebration frame (ribbon, marquee chase, confetti)
await shot('extra-jackpot-1920x', async (page) => {
  await setup(page);
  await page.evaluate(() => window.__rl.game.test.forceNextOutcome({ s1: 8 }));
  await dispatch(page, { type: 'START' });
  await waitPhase(page, 'GAMBLE_OFFER', 20000);
  await sleep(700);
}, { timeScale: 1, extraWait: 0 });

// ---------------------------------------------------------------- side-by-side + diff
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 600 });
const notes = [];
for (const r of results) {
  const base = r.name.replace(/-1280x720$/, '');
  let mock;
  try {
    mock = readFileSync(path.join(MOCK, `${base}.png`)).toString('base64');
  } catch {
    continue;
  }
  const shotB64 = readFileSync(r.file).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:#111;color:#eee;font:16px sans-serif">
    <div style="display:flex"><div><div style="padding:4px">MOCKUP ${base}</div><img id=a width=960 height=540 src="data:image/png;base64,${mock}"></div>
    <div><div style="padding:4px">BUILD ${r.name}</div><img id=b width=960 height=540 src="data:image/png;base64,${shotB64}"></div></div></body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: path.join(OUT, 'compare', `${r.name}-side-by-side.png`), clip: { x: 0, y: 0, width: 1920, height: 570 } });
  if (r.w !== 1920) continue;
  // pixel diff at full resolution (amplified), plus metrics
  const metrics = await page.evaluate(async (m, s) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const [A, B] = await Promise.all([load(`data:image/png;base64,${m}`), load(`data:image/png;base64,${s}`)]);
    const c = document.createElement('canvas');
    c.width = 1920; c.height = 1080;
    const x = c.getContext('2d');
    x.drawImage(A, 0, 0, 1920, 1080);
    const a = x.getImageData(0, 0, 1920, 1080).data;
    x.drawImage(B, 0, 0, 1920, 1080);
    const b = x.getImageData(0, 0, 1920, 1080);
    let sum = 0, big = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = (Math.abs(a[i] - b.data[i]) + Math.abs(a[i + 1] - b.data[i + 1]) + Math.abs(a[i + 2] - b.data[i + 2])) / 3;
      sum += d;
      if (d > 40) big++;
      const v = Math.min(255, d * 3);
      b.data[i] = v; b.data[i + 1] = v * 0.4; b.data[i + 2] = 0; b.data[i + 3] = 255;
    }
    x.putImageData(b, 0, 0);
    return { meanDiff: +(sum / (a.length / 4) / 2.55).toFixed(2), pctPixelsOver40: +((100 * big) / (a.length / 4)).toFixed(2), png: c.toDataURL('image/png').split(',')[1] };
  }, mock, shotB64);
  writeFileSync(path.join(OUT, 'compare', `${r.name}-diff.png`), Buffer.from(metrics.png, 'base64'));
  notes.push({ name: r.name, mockup: `${base}.png`, meanAbsDiffPct: metrics.meanDiff, pctPixelsDiffOver40: metrics.pctPixelsOver40 });
}
writeFileSync(path.join(OUT, 'compare', 'metrics.json'), JSON.stringify({ notes, issues: allIssues }, null, 2));
console.log(JSON.stringify(notes, null, 1));
console.log('console/network issues:', allIssues.length ? allIssues : 'none');
await browser.close();
server.close();
