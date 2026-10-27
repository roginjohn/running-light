// Running Light v4 mobile mocks: build the static pages, render them to png/<state>-<WxH>.png with puppeteer-core,
// and measure every page. Fails (exit 1) when any visible tap target is under 44 px on either side, any visible text
// is under 12 px, body copy is under 14 px, a board square overlaps the centre or the dock, an interactive element
// sits outside the safe area, or text is clipped. Results go to measurements.json either way.
// Run from the repo root: node docs/design-v4/mobile/render.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { build } from './build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(HERE, '../../..')); // repo root, so the mocks can load src/ tokens, fonts and icons
const PNG = join(HERE, 'png');
const MIN_TAP = 44, MIN_FONT = 12, MIN_BODY = 14;

// simulated safe-area insets (px) per device: notch / status bar, home indicator, landscape notch sides
const PHONES = [
  { w: 360, h: 640, inset: { t: 24, r: 0, b: 0, l: 0 } },   // small Android, status bar only
  { w: 390, h: 844, inset: { t: 47, r: 0, b: 34, l: 0 } },  // iPhone 12-15 class
  { w: 430, h: 932, inset: { t: 59, r: 0, b: 34, l: 0 } },  // iPhone Pro Max class (dynamic island)
];
const LAND = { w: 844, h: 390, inset: { t: 0, r: 47, b: 21, l: 47 } };
const TABLETS = [{ w: 768, h: 1024, inset: { t: 24, r: 0, b: 20, l: 0 } }, { w: 1024, h: 1366, inset: { t: 24, r: 0, b: 20, l: 0 } }];

const PHONE_STATES = ['betting', 'running', 'win-gamble-offer', 'gamble-flip', 'loss', 'settings', 'paytable', 'help', 'refill', 'start', 'loading', 'error'];
const jobs = [];
for (const d of PHONES) for (const s of PHONE_STATES) jobs.push({ page: s, out: s, ...d });
jobs.push({ page: 'tip-sheet', out: 'tip-sheet', ...PHONES[1] });
jobs.push({ page: 'betting', out: 'landscape-A-betting', ...LAND }, { page: 'running', out: 'landscape-A-running', ...LAND },
  { page: 'win-gamble-offer', out: 'landscape-A-win', ...LAND }, { page: 'rotate', out: 'landscape-B-rotate', ...LAND });
for (const d of TABLETS) for (const s of ['betting', 'win-gamble-offer']) jobs.push({ page: s, out: s, ...d });

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  const srv = createServer(async (req, res) => {
    const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try { const body = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(body); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

// runs in the page
function measure(minTap) {
  const vis = (el) => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }) && el.getClientRects().length > 0;
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const desc = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.getAttribute('aria-label') ? ` "${el.getAttribute('aria-label')}"` : el.textContent.trim() ? ` "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}"` : ''}`;
  const hit = (a, b, tol = 0.5) => a.x < b.x + b.w - tol && b.x < a.x + a.w - tol && a.y < b.y + b.h - tol && b.y < a.y + a.h - tol;
  const cs = getComputedStyle(document.documentElement);
  const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
  const W = innerWidth, H = innerHeight;
  const safe = { x: px('--sim-sal'), y: px('--sim-sat'), r: W - px('--sim-sar'), b: H - px('--sim-sab') };
  const v = [];

  // 1. tap targets (inert subtrees behind a modal are not tappable, so they are skipped)
  const taps = [...document.querySelectorAll('button, [role=button], input, select, a')].filter((el) => vis(el) && !el.closest('[inert]'));
  let minT = null;
  for (const el of taps) {
    const r = R(el); const s = Math.min(r.w, r.h);
    if (!minT || s < minT.size) minT = { size: s, ...r, el: desc(el) };
    if (s < minTap - 0.01) v.push({ kind: 'tap-target', size: s, rect: r, el: desc(el) });
    // inside the safe area, unless it lives in a scrolling box (then the box is checked instead)
    let sc = el.parentElement; while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
    const box = sc ? R(sc) : r;
    if (box.x < safe.x - 0.5 || box.y < safe.y - 0.5 || box.x + box.w > safe.r + 0.5 || box.y + box.h > safe.b + 0.5) v.push({ kind: 'outside-safe-area', rect: box, safe, el: desc(sc || el) });
  }

  // 2. text sizes (every visible text node), body copy, clipped text
  let minF = null, minB = null;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 2) });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement; if (!vis(el)) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden') continue;
    const f = parseFloat(st.fontSize);
    if (!minF || f < minF.size) minF = { size: f, text: n.textContent.trim().slice(0, 40), el: desc(el) };
    if (f < 12) v.push({ kind: 'font', size: f, text: n.textContent.trim().slice(0, 40), el: desc(el) });
  }
  for (const el of document.querySelectorAll('.body, p:not(.fn)')) {
    if (!vis(el)) continue; const f = parseFloat(getComputedStyle(el).fontSize);
    if (!minB || f < minB.size) minB = { size: f, el: desc(el) };
    if (f < 14) v.push({ kind: 'body-font', size: f, el: desc(el) });
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el) || !el.childNodes.length) continue;
    const st = getComputedStyle(el);
    if (st.overflowX === 'visible' && st.textOverflow !== 'ellipsis') continue;
    if (['auto', 'scroll'].includes(st.overflowX) || el.classList.contains('tps')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) v.push({ kind: 'clipped-text', el: desc(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
  }

  // 3. board overlap: no square may touch the centre content, the dock or the top bar
  const tiles = [...document.querySelectorAll('.tile')].filter(vis).map(R);
  const guard = [...document.querySelectorAll('.centre > *, .dock, .top')].filter(vis);
  for (const g of guard) { const gr = R(g); const t = tiles.find((tr) => hit(tr, gr)); if (t) v.push({ kind: 'overlap', el: desc(g), rect: gr, tile: t }); }
  for (const c of [...document.querySelectorAll('.centre')].filter(vis)) if (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1) v.push({ kind: 'centre-overflow', scrollH: c.scrollHeight, clientH: c.clientHeight, scrollW: c.scrollWidth, clientW: c.clientWidth });
  // every board square fully on screen
  for (const t of tiles) if (t.x < -0.5 || t.y < -0.5 || t.x + t.w > W + 0.5 || t.y + t.h > H + 0.5) { v.push({ kind: 'tile-offscreen', rect: t }); break; }

  const tileSize = tiles.length ? Math.min(...tiles.map((t) => Math.min(t.w, t.h))) : null;
  return {
    coarsePointer: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches,
    tapTargets: taps.length, minTapTarget: minT, minFont: minF, minBodyFont: minB, ringTileMin: tileSize ? +tileSize.toFixed(1) : null, violations: v,
  };
}

async function main() {
  build();
  await mkdir(PNG, { recursive: true });
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/${relative(ROOT, join(HERE, 'mocks')).split('\\').join('/')}`;
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--hide-scrollbars'], headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    for (const j of jobs) {
      const touch = true; // every target here is a touch device
      await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch, isLandscape: j.w > j.h });
      await page.goto(`${base}/${j.page}.html`, { waitUntil: 'networkidle0' });
      await page.evaluate((i) => {
        const s = document.documentElement.style;
        s.setProperty('--sim-sat', `${i.t}px`); s.setProperty('--sim-sar', `${i.r}px`); s.setProperty('--sim-sab', `${i.b}px`); s.setProperty('--sim-sal', `${i.l}px`);
        document.documentElement.setAttribute('data-sim', '');
      }, j.inset);
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(measure, MIN_TAP);
      const file = `png/${j.out}-${j.w}x${j.h}.png`;
      await page.screenshot({ path: join(HERE, file) });
      results.push({ file, page: `mocks/${j.page}.html`, viewport: `${j.w}x${j.h}`, safeArea: j.inset, ...m });
      const flag = m.violations.length ? `  !! ${m.violations.length} violation(s)` : '';
      console.log(`${file.padEnd(44)} tap>=${m.minTapTarget ? m.minTapTarget.size : '-'}  font>=${m.minFont ? m.minFont.size : '-'}  body>=${m.minBodyFont ? m.minBodyFont.size : '-'}  tile=${m.ringTileMin ?? '-'}  coarse=${m.coarsePointer}${flag}`);
    }
  } finally { await browser.close(); srv.close(); }

  const bad = results.filter((r) => r.violations.length);
  const summary = {
    generated: new Date().toISOString(), rules: { minTapTarget: MIN_TAP, minFont: MIN_FONT, minBodyFont: MIN_BODY },
    pages: results.length, failing: bad.length,
    minTapTargetOverall: Math.min(...results.filter((r) => r.minTapTarget).map((r) => r.minTapTarget.size)),
    minFontOverall: Math.min(...results.filter((r) => r.minFont).map((r) => r.minFont.size)),
    minBodyFontOverall: Math.min(...results.filter((r) => r.minBodyFont).map((r) => r.minBodyFont.size)),
  };
  await writeFile(join(HERE, 'measurements.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
  if (bad.length) {
    console.error(`\nFAIL: ${bad.length} page(s) break the mobile rules:`);
    for (const r of bad) for (const x of r.violations) console.error(`  ${r.file}: ${x.kind} ${JSON.stringify(x)}`);
    process.exit(1);
  }
  console.log(`\nOK: ${results.length} pages, every tap target >= ${MIN_TAP}px, text >= ${MIN_FONT}px, body >= ${MIN_BODY}px, no overlap. measurements.json written.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
