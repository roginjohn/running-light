// Running Light v4 desktop, Christmas skin (design only). Builds the real v3 game with vite into a /tmp outDir,
// serves it, and renders every state twice with puppeteer-core: standard (no override) and Christmas
// (xmas-desktop.css injected after the game's own stylesheet). States are driven through the test-mode hooks
// exactly as test/ui/screenshots-v3.js does (same story: 20 credits on 6 squares, chip 5, credits 1,000).
// Writes png/<state>-<WxH>.png (Christmas), png/compare-*.png (standard left, Christmas right), measurements.json
// (element boxes, standard vs Christmas), contrast.json (WCAG) and weight.json (gzip). Exit 1 on any layout delta,
// contrast failure, weight over 5 KB gzip or page error.
// Run from the repo root: node docs/design-v4/christmas/desktop/render.mjs   (Chrome: $CHROME or /usr/bin/google-chrome)
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { launch, openGame, sleep, waitPhase } from '../../../../test/ui/harness.js';
import { setup, force, settle, H01 } from '../../../../test/ui/scenes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const PNG = path.join(HERE, 'png');
const DIST = '/tmp/rl-v4-xmas-desktop-dist';
const STD = '/tmp/rl-v4-xmas-desktop-std'; // standard renders (only used for the comparisons)
const XCSS = readFileSync(path.join(HERE, 'xmas-desktop.css'), 'utf8');
const FREEZE = ':is(.frame, .frame-rail, .screen > .bg)::after { animation: none !important; }'; // render-only: twinkle off
const MAX_GZIP = 5 * 1024;

// the screenshots-v3.js story
const MOCK_BETS = { 3: 2, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5 };
const MOCK_TOTALS = [20, 20, 15, 30, 10];
const MOCK_HISTORY = [1, 2, 4, 3, 6, 9, 7, 11].reverse();

async function play(page, s1, s2 = null, target = ['GAMBLE_OFFER', 'BETTING']) {
  await force(page, s1, s2);
  await page.evaluate(() => { window.__rl.app.ui.startLocked = false; window.__rl.game.dispatch({ type: 'START' }); });
  await waitPhase(page, target, 30000);
  await settle(page);
}
async function flip(page, pick, result) {
  await page.evaluate((p, r) => {
    const g = window.__rl.game;
    g.dispatch({ type: 'PICK', colour: p });
    g.test.forceNextGamble(r);
    g.dispatch({ type: 'GAMBLE_FLIP' });
  }, pick, result);
}
async function info(page, tab) {
  await page.evaluate((t) => window.__rl.game.dispatch({ type: 'OPEN_INFO', tab: t }), tab);
  await sleep(250);
  // at 1920 all three sections show side by side; the state's section heading gets the keyboard focus ring
  await page.evaluate((t) => { document.getElementById('app').classList.add('kbd'); document.querySelector(`[data-id="tab-${t}"]`)?.focus(); }, tab);
}

const SCENE = {
  start: (page) => page.evaluate(() => { window.__rl.app.ui.start = true; window.__rl.app.render(); }),
  loading: (page) => page.evaluate(() => window.__rlShowLoading(0.72, 0, 'Loading sounds…')),
  betting: async () => {},
  async running(page) {
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
  },
  'win-gamble-offer': (page) => play(page, 13),
  async 'gamble-flip'(page) {
    await play(page, 13);
    await page.evaluate(() => window.__rl.game.dispatch({ type: 'GAMBLE_OPEN' }));
    await flip(page, 'white', 'white');
    await page.waitForFunction(() => window.__rl.game.state.phase === 'GAMBLE' && !window.__rl.game.state.gamble.revealing);
    await settle(page);
    await flip(page, 'red', 'red');
    await sleep(60);
    await page.evaluate(() => {
      window.__rl.app.setPaused(true);
      const coin = document.querySelector('.flip .coin');
      for (const a of coin.getAnimations()) a.cancel();
      coin.style.transform = 'rotateY(72deg)';
    });
  },
  'double-run-result': (page) => play(page, 21, 33),
  loss: (page) => play(page, 26, null, 'BETTING'),
  'jackpot-win': (page) => play(page, 8), // 1 on #8 (1920x): You win 1,920
  settings: (page) => info(page, 'settings'),
  paytable: (page) => info(page, 'paytable'),
  help: (page) => info(page, 'help'),
  refill: (page) => page.evaluate(() => { window.__rl.game.test.setBets({}); window.__rl.game.test.setBalance(0); window.__rl.app.render(); }),
  async error(page) {
    await force(page, 30);
    await page.evaluate(() => { window.__rl.app.ui.startLocked = false; window.__rl.game.dispatch({ type: 'START' }); });
    await sleep(700);
    await page.evaluate(() => {
      const app = window.__rl.app;
      app.setPaused(true);
      app.ui.light1 = { idx: 30, trail: [], level: null };
      window.__rl.game.dispatch({ type: 'FAIL', message: 'storage setItem failed' });
    });
  },
};
const JOBS = [...Object.keys(SCENE).map((s) => [s, 1920, 1080]), ['betting', 1280, 720], ['win-gamble-offer', 1280, 720]];
const KEY_STATES = new Set(['betting', 'win-gamble-offer']);

// ---------------------------------------------------------------- page-side measurement
function boxes() {
  const r4 = (r) => [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(2));
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  const all = [...document.body.querySelectorAll('*')].map((el) => ({ el: name(el), r: r4(el.getBoundingClientRect()), fs: getComputedStyle(el).fontSize }));
  const KEY = { 'board squares': '.tile', centre: '.centre', 'big number': '.big', 'centre pills': '.cp', chips: '.chip', buttons: '.btn, .ibtn', credits: '.credits',
    'bet field': '.betin', 'top row': '.toprow', rail: '.rail', 'bottom bar': '.bbar', frame: '.frame, .frame-rail, .frame-bar', 'result cards': '.card',
    'gamble band': '.gband', overlays: '.scrim, .dwrap, .dlg, .screen:not([hidden])' };
  const key = Object.fromEntries(Object.entries(KEY).map(([k, sel]) => [k, [...document.querySelectorAll(sel)].map((el) => ({ el: name(el).slice(0, 60), box: r4(el.getBoundingClientRect()) }))]));
  return { all, key };
}

function diff(std, xm) {
  const d = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  if (std.all.length !== xm.all.length) return { elements: xm.all.length, sameCount: false, maxDeltaPx: null, changed: [] };
  let max = 0; const changed = [];
  std.all.forEach((s, i) => {
    const x = xm.all[i], dd = d(s.r, x.r);
    max = Math.max(max, dd);
    if (dd > 0 || s.fs !== x.fs || s.el !== x.el) changed.push({ el: s.el, standard: s.r, christmas: x.r, fs: [s.fs, x.fs] });
  });
  return { elements: xm.all.length, sameCount: true, maxDeltaPx: max, changed: changed.slice(0, 20), changedCount: changed.length };
}
function keyDiff(std, xm) {
  return Object.fromEntries(Object.keys(std.key).map((k) => {
    const a = std.key[k], b = xm.key[k];
    const max = a.length === b.length ? Math.max(0, ...a.flatMap((e, i) => e.box.map((v, j) => Math.abs(v - b[i].box[j])))) : null;
    return [k, { count: a.length, christmasCount: b.length, maxDeltaPx: max, sample: b.slice(0, 3) }];
  }));
}

// ---------------------------------------------------------------- contrast (WCAG 2.x)
function contrast() {
  const vars = {};
  for (const css of [readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8'), XCSS])
    for (const b of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/:root\s*\{([^}]*)\}/g)) for (const [, k, v] of b[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[k] = v.trim();
  const col = (v) => { let s = v; for (let i = 0; i < 9 && s.startsWith('var('); i++) s = vars[s.slice(4, -1)]; if (!/^#[0-9a-f]{6}$/i.test(s)) throw new Error(`not a hex colour: ${v} -> ${s}`); return s.toLowerCase(); };
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const v = (n) => `var(--${n})`;
  const PAIRS = [
    ['Primary text / labels on frame', v('c-text-primary'), v('c-bg-frame'), 'text'],
    ['Strong text (titles, Start hint bold) on frame', v('c-text-strong'), v('c-bg-frame'), 'text'],
    ['Muted text on frame', v('c-text-muted'), v('c-bg-frame'), 'text'],
    ['Muted text on rail', v('c-text-muted'), v('c-bg-rail'), 'text'],
    ['Primary text on rail (Credits, disclaimer)', v('c-text-primary'), v('c-bg-rail'), 'text'],
    ['Muted text on bottom bar', v('c-text-muted'), v('c-bg-bottombar'), 'text'],
    ['Primary text on bottom bar', v('c-text-primary'), v('c-bg-bottombar'), 'text'],
    ['Muted text on page (start / loading)', v('c-text-muted'), v('c-bg-page'), 'text'],
    ['Muted text on card / centre pill', v('c-text-muted'), v('c-bg-card'), 'text'],
    ['Muted text on input (½, x2)', v('c-text-muted'), v('c-bg-input'), 'text'],
    ['Primary text on input (bet amount, Clear, last bets)', v('c-text-primary'), v('c-bg-input'), 'text'],
    ['Strong text on newest last bet', v('c-text-strong'), v('c-border-input'), 'text'],
    ['Pill text on card pill (paytable pills, card ×)', v('c-text-primary'), v('c-bg-card-pill'), 'text'],
    ['Square number on square', v('c-text-muted'), v('c-tile'), 'text'],
    ['24x on square', v('c-tier-24'), v('c-tile'), 'text'],
    ['96x on square', v('c-tier-96'), v('c-tile'), 'text'],
    ['480x / 960x on square', v('c-tier-480'), v('c-tile'), 'text'],
    ['Ghost bet badge on square', v('c-accent-blue-text'), v('c-tile'), 'text'],
    ['1920x on jackpot berry square / pill', v('c-tier-1920'), v('c-tile-jackpot'), 'text'],
    ['Lit (snow) square text', v('c-text-on-light'), v('c-tile-lit'), 'text'],
    ['Win square / Collect (green, unchanged)', v('c-text-on-green'), v('c-accent-green'), 'text'],
    ['Win amount on gold-rimmed win card', v('c-accent-green-text'), '#1b2a1a', 'text'],
    ['Win label (muted) on win card', v('c-text-muted'), '#1b2a1a', 'text'],
    ['Win delta next to credits (rail)', v('c-accent-green-text'), v('c-bg-rail'), 'text'],
    ['Loss / error text on frame', v('c-accent-red-text'), v('c-bg-frame'), 'text'],
    ['Loss note on card pill (rail)', v('c-accent-red-text'), v('c-bg-card-pill'), 'text'],
    ['Error icon on its berry tint', v('c-accent-red-text'), '#381f20', 'ui'],
    ['Start / Play / Refill / Reload (gold)', v('x-gold-ink'), v('x-gold'), 'text'],
    ['Gold button hover', v('x-gold-ink'), v('x-gold-hi'), 'text'],
    ['Gamble ×2, bet badge, Betting open, tabs, toggles (blue, unchanged)', v('c-text-strong'), v('c-accent-blue'), 'text'],
    ['Chip 1 (snow)', v('c-chip-1-ink'), v('c-chip-1'), 'text'],
    ['Chip 5 (berry)', v('c-chip-5-ink'), v('c-chip-5'), 'text'],
    ['Chip 10 (pine)', v('c-chip-10-ink'), v('c-chip-10'), 'text'],
    ['Chip 25 (gold)', v('c-chip-25-ink'), v('c-chip-25'), 'text'],
    ['Chip 50 (dark pine)', v('c-chip-50-ink'), v('c-chip-50'), 'text'],
    ['Gamble band / panel text (navy, unchanged)', '#a9bbd6', v('c-bg-panel-navy'), 'text'],
    ['Strong text on navy panel', v('c-text-strong'), v('c-bg-panel-navy'), 'text'],
    ['Centre number, idle (88 / 64 px)', v('c-big-number'), v('c-bg-frame'), 'large'],
    ['Centre number, win (gold, 88 / 64 px)', v('c-big-number-win'), v('c-bg-frame'), 'large'],
    ['Lit square (snow) vs square', v('c-tile-lit'), v('c-tile'), 'ui'],
    ['Win square (green) vs square', v('c-accent-green'), v('c-tile'), 'ui'],
    ['Bet badge (blue) vs square', v('c-accent-blue'), v('c-tile'), 'ui'],
    ['Jackpot gold rim vs frame', v('x-gold-edge'), v('c-bg-frame'), 'ui'],
    ['Win card gold rim vs frame', v('x-gold-edge'), v('c-bg-frame'), 'ui'],
    ['Gold Start vs rail', v('x-gold'), v('c-bg-rail'), 'ui'],
    ['Blue Gamble vs rail', v('c-accent-blue'), v('c-bg-rail'), 'ui'],
    ['Berry chip 5 vs rail', v('c-chip-5'), v('c-bg-rail'), 'ui'],
    ['Pine chip 10 vs rail (gold rim dashes carry it)', v('x-gold'), v('c-bg-rail'), 'ui'],
    ['Dark pine chip 50 rim (gold dashes) vs rail', v('x-gold'), v('c-chip-50'), 'ui'],
    ['Selected chip ring (white, unchanged) vs rail', v('c-focus-ring'), v('c-bg-rail'), 'ui'],
    ['Loading bar (gold) vs track', v('x-gold'), v('c-bg-input'), 'ui'],
    ['Disabled button text (info, exempt)', v('c-btn-disabled-text'), v('c-btn-disabled'), 'disabled'],
    ['Dim (disabled) text on input (info, exempt)', v('c-text-dim'), v('c-bg-input'), 'disabled'],
  ];
  const NEED = { text: 4.5, large: 3, ui: 3 };
  return PAIRS.map(([where, f, b, kind]) => {
    const fg = col(f), bg = col(b), raw = ratio(fg, bg);
    return { where, fg, bg, kind, ratio: +raw.toFixed(2), need: NEED[kind] ?? null, pass: NEED[kind] ? raw >= NEED[kind] : null };
  });
}

function weight() {
  const css = Buffer.from(XCSS), svgs = [...XCSS.matchAll(/url\("data:image\/svg\+xml,([^"]+)"\)/g)].map((m) => decodeURIComponent(m[1]));
  const gz = (b) => gzipSync(b, { level: 9 }).length;
  return { file: 'xmas-desktop.css', bytes: css.length, gzipBytes: gz(css), inlineSvgCount: svgs.length, inlineSvgBytes: Buffer.byteLength(svgs.join('')),
    inlineSvgGzipBytes: gz(Buffer.from(svgs.join(''))), note: 'the SVGs are inline data URIs inside the CSS, so gzipBytes already includes them; no other file is added', limitBytes: MAX_GZIP, pass: gz(css) < MAX_GZIP };
}

// ---------------------------------------------------------------- server, pages
function serve() {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
  const server = http.createServer(async (req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(DIST, u === '/' ? 'index.html' : u);
    if (!f.startsWith(DIST)) return res.writeHead(403).end();
    try { const body = await readFile(f); res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(body); }
    catch { res.writeHead(404).end('not found'); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

async function scene(browser, url, [name, w, h], xmas) {
  const page = await browser.newPage();
  if (xmas) await page.evaluateOnNewDocument((css) => {
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.id = 'xmas-desktop'; s.textContent = css; document.head.append(s); });
  }, XCSS + '\n' + FREEZE);
  await openGame(browser, url, { seed: 7, timeScale: name === 'betting' || name === 'running' ? 1 : 4, width: w, height: h }, page);
  await setup(page, { balance: 1000, history: H01, bets: MOCK_BETS, chip: 5 });
  await page.evaluate((t, hist) => {
    window.__rl.game.test.setHistory(hist.map((s1, i) => ({ roundId: `h${i}`, s1, s2: null, win: 0 })));
    window.__rl.app.ui.betTotals = t.map((v, i) => ({ id: `m${i}`, t: v }));
    window.__rl.app.render();
  }, MOCK_TOTALS, MOCK_HISTORY);
  await SCENE[name](page);
  await page.mouse.move(w - 2, h - 2);
  await page.evaluate((keepKbd) => { window.__rl.app.ui.ringOn = false; if (!keepKbd) document.getElementById('app').classList.remove('kbd'); }, ['settings', 'paytable', 'help'].includes(name));
  await sleep(400);
  const file = path.join(xmas ? PNG : STD, `${name}-${w}x${h}.png`);
  await page.screenshot({ path: file });
  const m = await page.evaluate(boxes);
  const issues = page.__issues.slice();
  await page.close();
  return { file, m, issues };
}

// twinkle check: runs only with prefers-reduced-motion: no-preference and the in-game setting off
async function motionCheck(browser, url) {
  const out = {};
  for (const reduced of [false, true]) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument((css) => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }), XCSS);
    await openGame(browser, url, { seed: 7, width: 1920, height: 1080, reducedMotion: reduced }, page);
    out[reduced ? 'prefersReducedMotion' : 'noPreference'] = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'xtw').length);
    if (!reduced) {
      await page.evaluate(() => { // the setting is only changeable with Game info open
        const g = window.__rl.game;
        g.dispatch({ type: 'OPEN_INFO', tab: 'settings' });
        g.dispatch({ type: 'SET_SETTING', key: 'reducedMotion', value: true });
        g.dispatch({ type: 'CLOSE_INFO' });
        window.__rl.app.render();
      });
      await sleep(200);
      out.inGameReducedSetting = await page.evaluate(() => ({ reducedClass: document.getElementById('app').classList.contains('reduced'), twinkles: document.getAnimations().filter((a) => a.animationName === 'xtw').length }));
    }
    await page.close();
  }
  out.pass = out.noPreference > 0 && out.prefersReducedMotion === 0 && out.inGameReducedSetting.reducedClass && out.inGameReducedSetting.twinkles === 0;
  return out;
}

async function compare(browser, std, xm, out) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const fig = (f, label) => `<figure><figcaption>${label}</figcaption><img src="${img(f)}"></figure>`;
  await page.setContent(`<!doctype html><style>body{margin:0;width:1920px;height:1080px;display:flex;align-items:center;justify-content:center;gap:24px;background:#30363d;font:700 20px/28px system-ui,sans-serif;color:#fff}
    figure{margin:0}figcaption{margin-bottom:10px}img{display:block;width:936px;height:526.5px;outline:1px solid #555}</style>
    ${fig(std, 'Standard (v3 live)')}${fig(xm, 'Christmas skin (xmas-desktop.css)')}`, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(PNG, out) });
  await page.close();
}

// ---------------------------------------------------------------- main
mkdirSync(PNG, { recursive: true });
mkdirSync(STD, { recursive: true });
await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'warn', build: { outDir: DIST, emptyOutDir: true } });
if (!existsSync(path.join(DIST, 'index.html'))) throw new Error('vite build failed');
const { server, url } = await serve();
const browser = await launch();
const states = [], keys = {}, issues = [];
let motion;
try {
  for (const job of JOBS) {
    const s = await scene(browser, url, job, false);
    const x = await scene(browser, url, job, true);
    const id = `${job[0]}-${job[1]}x${job[2]}`;
    const d = diff(s.m, x.m);
    states.push({ state: id, png: `png/${id}.png`, ...d });
    if (KEY_STATES.has(job[0])) keys[id] = keyDiff(s.m, x.m);
    issues.push(...[...s.issues, ...x.issues].map((i) => `${id}: ${i}`));
    console.log(`${`png/${id}.png`.padEnd(42)} elements ${d.elements}  max box delta ${d.maxDeltaPx} px${d.changedCount ? `  !! ${d.changedCount} changed` : ''}`);
  }
  await compare(browser, path.join(STD, 'betting-1920x1080.png'), path.join(PNG, 'betting-1920x1080.png'), 'compare-betting-1920x1080.png');
  await compare(browser, path.join(STD, 'win-gamble-offer-1920x1080.png'), path.join(PNG, 'win-gamble-offer-1920x1080.png'), 'compare-win-1920x1080.png');
  motion = await motionCheck(browser, url);
} finally {
  await browser.close();
  server.close();
}

const maxDelta = Math.max(...states.map((s) => s.maxDeltaPx ?? Infinity));
const contrastRows = contrast();
const w = weight();
writeFileSync(path.join(HERE, 'measurements.json'), JSON.stringify({
  generated: new Date().toISOString(),
  method: 'getBoundingClientRect() of every element in <body>, standard (no override) vs Christmas (xmas-desktop.css injected), same seed / story / viewport; pseudo-element decor is not an element, so it cannot move a box',
  summary: { states: states.length, elementsCompared: states.reduce((a, s) => a + s.elements, 0), maxDeltaPx: maxDelta, statesWithChanges: states.filter((s) => s.changedCount || !s.sameCount).length },
  keyElements: keys, states, twinkle: motion,
}, null, 2) + '\n');
writeFileSync(path.join(HERE, 'contrast.json'), JSON.stringify({ rule: 'WCAG 2.x AA: text 4.5:1, large text (>= 24 px, or 18.66 px bold) and UI parts 3:1; disabled controls listed for information (exempt)',
  pairs: contrastRows.length, failing: contrastRows.filter((r) => r.pass === false).length, minRequired: Math.min(...contrastRows.filter((r) => r.need).map((r) => r.ratio)), rows: contrastRows }, null, 2) + '\n');
writeFileSync(path.join(HERE, 'weight.json'), JSON.stringify(w, null, 2) + '\n');

console.log(`\nlayout: ${states.length} states, max box delta ${maxDelta} px`);
console.log(`contrast: ${contrastRows.length} pairs, ${contrastRows.filter((r) => r.pass === false).length} failing`);
console.log(`weight: xmas-desktop.css ${w.bytes} B, ${w.gzipBytes} B gzip (${w.inlineSvgCount} inline SVGs, ${w.inlineSvgBytes} B raw)`);
console.log(`twinkle: ${JSON.stringify(motion)}`);
let fail = false;
if (maxDelta !== 0) { fail = true; console.error('FAIL: layout delta'); }
if (contrastRows.some((r) => r.pass === false)) { fail = true; for (const r of contrastRows.filter((x) => x.pass === false)) console.error(`FAIL contrast ${r.ratio} < ${r.need}: ${r.where}`); }
if (!w.pass) { fail = true; console.error('FAIL: weight'); }
if (!motion.pass) { fail = true; console.error('FAIL: twinkle / reduced motion'); }
if (issues.length) { fail = true; console.error(issues.join('\n')); }
process.exitCode = fail ? 1 : 0;
