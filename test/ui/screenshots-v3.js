// v3 batch screenshots: the betting scene (mockup story: 20 credits on 6 squares, chip 5, last bets 20 20 15 30 10)
// and the running scene (the same bets after START: credits 980, the light on #30 with its trail on #29 and #28,
// as in running.png) at 1920x1080, 1280x720 and 768x1024, plus side-by-side compare-*.png (build left, mockup
// right) against docs/design-v3/betting*.png and running.png. Test mode only (window.__rl hooks).
// Usage: npm run build && node test/ui/screenshots-v3.js [--out docs/design-v3/batch-4] [--scenes betting,running]
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { startServer, launch, openGame, sleep } from './harness.js';
import { setup, force, H01 } from './scenes.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const OUT = path.resolve(ROOT, args.out || 'docs/design-v3/batch-4');
const MOCK = path.join(ROOT, 'docs/design-v3');
const SCENES = (args.scenes || 'betting,running').split(',');
const SIZES = [[1920, 1080, 'betting.png'], [1280, 720, 'betting-1280x720.png'], [768, 1024, 'betting-768x1024.png']];
export const MOCK_BETS = { 3: 2, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5 }; // betting.png: 20 credits on 6 squares
const MOCK_TOTALS = [20, 20, 15, 30, 10];
const MOCK_HISTORY = [1, 2, 4, 3, 6, 9, 7, 11].reverse(); // shown newest first: 24x 96x 24x 480x 24x 24x 96x 24x

mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer();
const browser = await launch();
const issues = [];

async function compare(file, mock, w, h, name) {
  // side by side: build | mockup, each scaled to the same height
  const ch = w > h ? 540 : 1024;
  const cw = Math.round((w * ch) / h);
  const gap = 24;
  const cmp = await browser.newPage();
  await cmp.setViewport({ width: cw * 2 + gap, height: ch });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  await cmp.setContent(`<body style="margin:0;background:#0f1216;display:flex;gap:${gap}px"><img src="${img(file)}" style="width:${cw}px;height:${ch}px"><img src="${img(path.join(MOCK, mock))}" style="width:${cw}px;height:${ch}px;object-fit:contain"></body>`, { waitUntil: 'load' });
  await cmp.screenshot({ path: path.join(OUT, `compare-${name}.png`) });
  await cmp.close();
}

try {
  for (const scene of SCENES) {
    for (const [w, h, betMock] of SIZES) {
      const page = await openGame(browser, url, { seed: 7, timeScale: 1, width: w, height: h, touch: w < 900 });
      await setup(page, { balance: 1000, history: H01, bets: MOCK_BETS, chip: 5 });
      await page.evaluate((t, hist) => {
        const g = window.__rl.game;
        g.test.setHistory(hist.map((s1, i) => ({ roundId: `h${i}`, s1, s2: null, win: 0 })));
        window.__rl.app.ui.betTotals = t.map((v, i) => ({ id: `m${i}`, t: v }));
        window.__rl.app.render();
      }, MOCK_TOTALS, MOCK_HISTORY);
      if (scene === 'running') {
        // START for real (bet taken, controls locked), then freeze the run and show the mockup frame:
        // light on #30, trail on #29 (.34) and #28 (.20)
        await force(page, 30);
        await page.evaluate(() => { window.__rl.app.ui.startLocked = false; window.__rl.game.dispatch({ type: 'START' }); });
        await sleep(700);
        await page.evaluate(() => {
          const app = window.__rl.app;
          app.setPaused(true);
          app.ui.displayBalance = null;
          app.ui.light1 = { idx: 30, trail: [29, 28], level: null };
          app.render();
        });
      }
      await page.mouse.move(w - 2, h - 2);
      await sleep(400);
      const name = `${scene}-${w}x${h}`;
      const file = path.join(OUT, `${name}.png`);
      await page.screenshot({ path: file });
      issues.push(...page.__issues.map((i) => `${name}: ${i}`));
      await page.close();
      // running.png exists at 1920x1080 only: the smaller running shots are compared against it scaled
      await compare(file, scene === 'running' ? 'running.png' : betMock, w, h, name);
      console.log('captured', name);
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
}
