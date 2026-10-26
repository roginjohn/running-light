// v3 batch screenshots: the betting scene (mockup story: 20 credits on 6 squares, chip 5, last bets 20 20 15 30 10)
// at 1920x1080, 1280x720 and 768x1024, plus side-by-side compare-*.png (build left, mockup right) against
// docs/design-v3/betting*.png. Test mode only (window.__rl hooks).
// Usage: npm run build && node test/ui/screenshots-v3.js [--out docs/design-v3/batch-3]
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { startServer, launch, openGame, sleep } from './harness.js';
import { setup, H01 } from './scenes.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const OUT = path.resolve(ROOT, args.out || 'docs/design-v3/batch-3');
const MOCK = path.join(ROOT, 'docs/design-v3');
const SIZES = [[1920, 1080, 'betting.png'], [1280, 720, 'betting-1280x720.png'], [768, 1024, 'betting-768x1024.png']];
export const MOCK_BETS = { 3: 2, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5 }; // betting.png: 20 credits on 6 squares
const MOCK_TOTALS = [20, 20, 15, 30, 10];

mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer();
const browser = await launch();
const issues = [];
try {
  for (const [w, h, mock] of SIZES) {
    const page = await openGame(browser, url, { seed: 7, timeScale: 4, width: w, height: h, touch: w < 900 });
    await setup(page, { balance: 1000, history: H01, bets: MOCK_BETS, chip: 5 });
    await page.evaluate((t) => {
      window.__rl.app.ui.betTotals = t.map((v, i) => ({ id: `m${i}`, t: v }));
      window.__rl.app.render();
    }, MOCK_TOTALS);
    await page.mouse.move(w - 2, h - 2);
    await sleep(300);
    const file = path.join(OUT, `betting-${w}x${h}.png`);
    await page.screenshot({ path: file });
    issues.push(...page.__issues.map((i) => `${w}x${h}: ${i}`));
    await page.close();
    // side by side: build | mockup, each scaled to the same height
    const ch = w > h ? 540 : 1024;
    const cw = Math.round((w * ch) / h);
    const gap = 24;
    const cmp = await browser.newPage();
    await cmp.setViewport({ width: cw * 2 + gap, height: ch });
    const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
    await cmp.setContent(`<body style="margin:0;background:#0f1216;display:flex;gap:${gap}px"><img src="${img(file)}" style="width:${cw}px;height:${ch}px"><img src="${img(path.join(MOCK, mock))}" style="width:${cw}px;height:${ch}px"></body>`, { waitUntil: 'load' });
    await cmp.screenshot({ path: path.join(OUT, `compare-betting-${w}x${h}.png`) });
    await cmp.close();
    console.log('captured', `${w}x${h}`);
  }
} finally {
  await browser.close();
  server.close();
}
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
}
