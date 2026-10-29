// v5 math design renders (docs only). Serves the real v3 build twice: as built (v3) and with the v5 patches from
// v5-inject.js applied in memory plus v5-override.css (v5). Drives the real engine through its test-mode hooks
// (window.__RL_TEST__, as test/ui/harness.js does) and screenshots into png/.
// Usage (from the repo root):
//   npx vite build --outDir /tmp/rl-v5-build --emptyOutDir
//   node docs/design-v5/math/render.mjs [--build /tmp/rl-v5-build] [--scenes betting,win-200x,...]
// Needs puppeteer-core (repo devDependency) and Google Chrome (CHROME env, default /usr/bin/google-chrome).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { patchBundle, V5 } from './v5-inject.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const BUILD = path.resolve(args.build || '/tmp/rl-v5-build');
const OUT = path.join(HERE, 'png');
const ONLY = args.scenes ? new Set(args.scenes.split(',')) : null;
const CSS = readFileSync(path.join(HERE, 'v5-override.css'), 'utf8');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!existsSync(path.join(BUILD, 'index.html'))) throw new Error(`${BUILD}/index.html missing: run npx vite build --outDir ${BUILD} --emptyOutDir`);
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ servers (v3 = as built, v5 = patched)
let patchReport = null;
function serve(v5) {
  const server = http.createServer(async (req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (v5 && u === '/__v5/v5-override.css') return res.writeHead(200, { 'content-type': 'text/css' }).end(CSS);
    const f = path.join(BUILD, u === '/' ? 'index.html' : u);
    if (!f.startsWith(BUILD)) return res.writeHead(403).end();
    try {
      let body = await readFile(f);
      if (v5 && f.endsWith('.js')) {
        const r = patchBundle(body.toString('utf8'));
        patchReport = r.report;
        body = r.src;
      } else if (v5 && f.endsWith('index.html')) {
        body = body.toString('utf8').replace('</head>', '<link rel="stylesheet" href="/__v5/v5-override.css"></head>');
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(body);
    } catch (e) {
      console.error(`serve ${u}: ${e.message}`);
      res.writeHead(f.endsWith('.js') ? 500 : 404).end(String(e.message));
    }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});
const S = { v3: await serve(false), v5: await serve(true) };
const issues = [];

async function open(ver, { w = 1920, h = 1080, timeScale = 4, top200 = false } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`${ver}: console: ${m.text()}`); });
  page.on('pageerror', (e) => issues.push(`${ver}: pageerror: ${e.message}`));
  await page.setViewport({ width: w, height: h });
  await page.evaluateOnNewDocument((t) => { window.__RL_TEST__ = t; }, { seed: 7, timeScale, noStorage: false, noReload: true, startScreen: false });
  const url = S[ver].url;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rl && window.__rl.game.state.phase !== 'INIT', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__rl && window.__rl.game.state.phase !== 'INIT', { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'));
  await page.evaluate(() => document.fonts.ready);
  if (top200) await page.evaluate(() => document.documentElement.classList.add('v5-top200'));
  await sleep(400);
  return page;
}

/** Board story: balance, bets, chip, history (s1 or [s1, s2]), last-bet totals. */
async function setup(page, { balance, bets = {}, chip = 1, history = [], totals = [] }) {
  await page.evaluate((o) => {
    const g = window.__rl.game;
    g.test.setBalance(o.balance);
    g.test.setHistory(o.history.map((e, i) => (Array.isArray(e) ? { roundId: `h${i}`, s1: e[0], s2: e[1], win: 0 } : { roundId: `h${i}`, s1: e, s2: null, win: 0 })));
    g.dispatch({ type: 'SELECT_CHIP', value: o.chip });
    g.test.setBets(o.bets);
    window.__rl.app.ui.betTotals = o.totals.map((t, i) => ({ id: `m${i}`, t }));
    window.__rl.app.ui.lightIndex = 1;
    window.__rl.app.render();
  }, { balance, bets, chip, history, totals });
  await sleep(50);
}
const settle = (page) => page.waitForFunction(() => window.__rl.app.pendingTasks() === 0, { timeout: 20000 }).then(() => sleep(150));
async function play(page, s1, s2 = null, target = ['GAMBLE_OFFER', 'BETTING']) {
  await page.evaluate((a, b) => window.__rl.game.test.forceNextOutcome({ s1: a, s2: b }), s1, s2);
  const r = await page.evaluate(() => { window.__rl.app.ui.startLocked = false; return window.__rl.game.dispatch({ type: 'START' }); });
  if (r && r.ok === false) throw new Error(`START rejected: ${r.reason}`);
  await page.waitForFunction((x) => x.includes(window.__rl.game.state.phase), { timeout: 30000 }, target);
  await settle(page);
}

/** Text that does not fit its box: scroll size over client size on any element with its own text, or text whose
 *  box leaves the viewport. Ignores the hidden overflow line of the top-row pill lists (by design). */
const overflowCheck = (page) => page.evaluate(() => {
  const out = [];
  const W = innerWidth, H = innerHeight;
  for (const el of document.querySelectorAll('#app *')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // empty, or the visually-hidden live region
    // v3 as built: the total <output> has an 18 px line box in a 16 px content box (no visible clipping)
    if (el.matches('.betin .v') && el.scrollHeight - el.clientHeight <= 2 && el.scrollWidth <= el.clientWidth) continue;
    if (el.closest('.tps') && r.top >= el.closest('.tps').getBoundingClientRect().bottom) continue; // wrapped-away pill
    const txt = el.textContent.trim().slice(0, 40);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.overflowX !== 'visible') out.push(`clipped x (${el.scrollWidth}>${el.clientWidth}): "${txt}"`);
    if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0 && cs.overflowY !== 'visible') out.push(`clipped y (${el.scrollHeight}>${el.clientHeight}): "${txt}"`);
    // text wider than its box even with overflow visible (spills onto neighbours)
    const range = document.createRange();
    range.selectNodeContents(el);
    const tr = range.getBoundingClientRect();
    if (tr.width > r.width + 2 && cs.overflowX === 'visible' && cs.display !== 'inline') out.push(`spills x (${Math.round(tr.width)}>${Math.round(r.width)}): "${txt}"`);
    // text that leaves its button, tile, chip or pill (nowrap labels centred with overflow visible)
    const box = el.closest('button, .btn, .tile, .chip, .tp, .lb, .tb, .ppill, .gc, .card');
    if (box) {
      const b = box.getBoundingClientRect();
      if (tr.left < b.left - 1 || tr.right > b.right + 1) out.push(`leaves its ${box.className.split(' ')[0]} (${Math.round(tr.width)}>${Math.round(b.width)}): "${txt}"`);
    }
    if (tr.left < -1 || tr.right > W + 1 || tr.top < -1 || tr.bottom > H + 1) out.push(`off-screen: "${txt}"`);
  }
  return [...new Set(out)];
});

async function shot(page, name, clip = null) {
  await page.mouse.move(page.viewport().width - 2, page.viewport().height - 2);
  await page.evaluate(() => { window.__rl.app.ui.ringOn = false; document.getElementById('app').classList.remove('kbd'); });
  await sleep(300);
  const o = await overflowCheck(page);
  issues.push(...o.map((x) => `${name}: ${x}`));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });
  console.log(`  ${name}.png${o.length ? `  (${o.length} overflow warnings)` : ''}`);
}

// ------------------------------------------------------------------ stories (squares from V5.SQUARES_BY_TIER)
// betting: 800 on 6 squares across tiers, chip 100; history 10 newest-first stops incl. one Double Run
const BET_V5 = { 3: 500, 8: 50, 13: 100, 21: 25, 27: 100, 33: 25 };
const HIST_V5 = [5, 31, 12, 44, 3, 27, [24, 13], 36, 8, 50];
const TOTALS_V5 = [800, 1000, 250, 500, 60];
// v3 baseline (unmodified build): the v3 batch-7 betting story
const BET_V3 = { 3: 2, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5 };
const HIST_V3 = [1, 2, 4, 3, 6, 9, 7, 11];
const FULL_20 = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i + 1, 20])); // 50 x 20 = 1,000

const SCENES = {
  async betting() {
    for (const [w, h] of [[1920, 1080], [1280, 720]]) {
      const p = await open('v5', { w, h, timeScale: 1 });
      await setup(p, { balance: 10000, bets: BET_V5, chip: 100, history: HIST_V5, totals: TOTALS_V5 });
      await shot(p, `01-betting-${w}x${h}`);
      await p.close();
    }
    const p = await open('v5', { timeScale: 1, top200: true });
    await setup(p, { balance: 10000, bets: BET_V5, chip: 100, history: HIST_V5, totals: TOTALS_V5 });
    await shot(p, '01-betting-top200-option-1920x1080');
    await p.close();
  },
  async 'large-bets'() {
    const p = await open('v5', { timeScale: 1 });
    await setup(p, { balance: 10000, bets: FULL_20, chip: 25, history: HIST_V5, totals: [1000, 800, 1000, 250, 500] });
    const st = await p.evaluate(() => { const b = window.__rl.game.state.bets; return { n: Object.keys(b).length, total: Object.values(b).reduce((a, x) => a + x, 0) }; });
    if (st.n !== 50 || st.total !== 1000) throw new Error(`large-bets: ${st.n} squares, total ${st.total}`);
    await shot(p, '02-large-bets-full-board-1920x1080');
    await p.close();
  },
  async 'win-200x'() {
    for (const top200 of [false, true]) {
      const p = await open('v5', { top200 });
      await setup(p, { balance: 10000, bets: { 3: 1000 }, chip: 500, history: HIST_V5, totals: TOTALS_V5 });
      await play(p, 3);
      const r = await p.evaluate(() => ({ win: window.__rl.game.state.round.baseWin, phase: window.__rl.game.state.phase, why: window.__rl.game.gambleBlock() }));
      if (r.win !== 200000 || r.phase !== 'GAMBLE_OFFER' || r.why !== 'cap') throw new Error(`win-200x: ${JSON.stringify(r)}`);
      await shot(p, top200 ? '03-win-200x-top200-option-1920x1080' : '03-win-200x-gamble-capped-1920x1080');
      await p.close();
    }
  },
  async 'win-5x'() {
    const p = await open('v5');
    await setup(p, { balance: 10000, bets: { 8: 100, 2: 50, 14: 50 }, chip: 50, history: HIST_V5, totals: TOTALS_V5 });
    await play(p, 8);
    const r = await p.evaluate(() => ({ win: window.__rl.game.state.round.baseWin, why: window.__rl.game.gambleBlock() }));
    if (r.win !== 500 || r.why) throw new Error(`win-5x: ${JSON.stringify(r)}`);
    await shot(p, '04-win-5x-gamble-offer-1920x1080');
    await p.close();
  },
  async paytable() {
    for (const ver of ['v5', 'v3']) {
      const p = await open(ver);
      if (ver === 'v5') {
        // the panel's one-in-N values come from the patched engine: they must equal the spec table
        await p.evaluate(() => window.__rl.game.dispatch({ type: 'OPEN_INFO', tab: 'paytable' }));
        await sleep(200);
        const rows = await p.evaluate(() => [...document.querySelectorAll('.ptab tr')].slice(1).map((tr) => [...tr.children].map((td) => td.textContent.trim())));
        for (const [pill, count, hit] of rows) {
          const t = parseInt(pill, 10);
          if (+count !== V5.COUNT_BY_TIER[t] || hit !== `1 in ${V5.HIT_ONE_IN[t]}`) throw new Error(`paytable row ${pill}: ${count}, ${hit} (spec ${V5.COUNT_BY_TIER[t]}, 1 in ${V5.HIT_ONE_IN[t]})`);
        }
      } else {
        await p.evaluate(() => window.__rl.game.dispatch({ type: 'OPEN_INFO', tab: 'paytable' }));
      }
      await shot(p, ver === 'v5' ? '05-paytable-game-info-1920x1080' : 'v3-paytable-game-info-1920x1080');
      await p.close();
    }
  },
  async refill() {
    const p = await open('v5');
    await setup(p, { balance: 0, bets: {}, chip: 100, history: HIST_V5, totals: TOTALS_V5 });
    await shot(p, '06-refill-1920x1080');
    await p.close();
  },
  async toasts() {
    // real toasts from the engine's clamp: square cap (1,000 on #3, add more) and round cap (500 + 500, add a third)
    for (const [kind, bets, sq] of [['square', { 3: 1000 }, 3], ['round', { 3: 500, 6: 500 }, 9]]) {
      const p = await open('v5', { timeScale: 1 });
      await setup(p, { balance: 10000, bets, chip: 100, history: HIST_V5, totals: TOTALS_V5 });
      await p.evaluate((n) => window.__rl.game.dispatch({ type: 'ADD_BET', square: n }), sq);
      await sleep(250);
      const t = await p.evaluate(() => document.querySelector('[data-role="toast"]')?.textContent);
      const want = kind === 'square' ? 'Max bet reached – 1,000 per square' : 'Round limit reached – 1,000 per round';
      if (t !== want) throw new Error(`toast ${kind}: "${t}"`);
      await shot(p, `06-toast-${kind}-limit-1920x1080`);
      await p.close();
    }
  },
  async 'last-results'() {
    const p = await open('v5', { timeScale: 1 });
    // newest first: one of every tier, a Double Run (100x · 100x) and a 200x win
    await setup(p, { balance: 10000, bets: BET_V5, chip: 100, history: [8, 21, [3, 13], 2, 5, 1, 3, 31, 46, 14].reverse(), totals: [1000, 800, 250, 500, 60] });
    await shot(p, '07-last-results-history-1920x1080');
    const box = await p.evaluate(() => document.querySelector('.toprow').getBoundingClientRect().toJSON());
    await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await sleep(300);
    await shot(p, '07-last-results-history-zoom', { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 });
    await p.close();
  },
  async compare() {
    const p3 = await open('v3', { timeScale: 1 });
    await setup(p3, { balance: 1000, bets: BET_V3, chip: 5, history: HIST_V3.slice().reverse(), totals: [20, 20, 15, 30, 10] });
    await shot(p3, 'v3-betting-1920x1080');
    await p3.close();
    for (const [name, a, b] of [['betting', 'v3-betting-1920x1080', '01-betting-1920x1080'], ['paytable', 'v3-paytable-game-info-1920x1080', '05-paytable-game-info-1920x1080']]) {
      const img = (f) => `data:image/png;base64,${readFileSync(path.join(OUT, `${f}.png`)).toString('base64')}`;
      const c = await browser.newPage();
      await c.setViewport({ width: 1920, height: 600 });
      const cap = (t) => `<div style="font:600 18px Poppins,system-ui,sans-serif;color:#e6eaee;margin:0 0 8px">${t}</div>`;
      await c.setContent(`<body style="margin:0;padding:16px;background:#0f1216;display:flex;gap:16px">
        <div>${cap('v3 (live build, unmodified)')}<img src="${img(a)}" style="width:936px;height:526.5px;display:block"></div>
        <div>${cap('v5 math (design override)')}<img src="${img(b)}" style="width:936px;height:526.5px;display:block"></div></body>`, { waitUntil: 'load' });
      await c.screenshot({ path: path.join(OUT, `08-compare-${name}-v3-vs-v5.png`), fullPage: true });
      console.log(`  08-compare-${name}-v3-vs-v5.png`);
      await c.close();
    }
  },
};

try {
  // compare needs the v5 betting and both paytable PNGs: it runs last
  for (const [name, fn] of Object.entries(SCENES)) {
    if (ONLY && !ONLY.has(name)) continue;
    console.log(name);
    await fn();
  }
} catch (e) {
  console.error(issues.join('\n'));
  throw e;
} finally {
  await browser.close();
  S.v3.server.close();
  S.v5.server.close();
}
console.log(`v5 patches: ${patchReport ? patchReport.length : 0} applied`);
if (issues.length) {
  console.log(`\n${issues.length} issue(s):`);
  for (const i of issues) console.log(`  ${i}`);
  process.exitCode = 1;
} else console.log('no overflow or console issues');
