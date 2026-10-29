// Running Light v4 mobile mocks, Christmas skin: build the pages, render them to png/<state>-<WxH>.png with
// puppeteer-core (same approach and same checks as ../mobile/render.mjs) and write measurements.json. Fails (exit 1)
// when any visible tap target is under 44 px, any visible text is under 12 px, body copy is under 14 px, a board
// square overlaps the centre / dock / top bar, an interactive element leaves the safe area, text is clipped, a
// contrast pair fails WCAG AA, the added weight is over 5 KB gzip, or any element's box differs from the base page
// (the skin must not move anything). Also renders the standard vs Christmas comparisons.
// Run from the repo root: node docs/design-v4/christmas/render.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, normalize, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { build, HOLLY, LIGHTS } from './build.mjs';
import { contrast } from './contrast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(HERE, '../../..'));
const PNG = join(HERE, 'png');
const MIN_TAP = 44, MIN_FONT = 12, MIN_BODY = 14, MAX_GZIP = 5 * 1024;

const P390 = { w: 390, h: 844, inset: { t: 47, r: 0, b: 34, l: 0 } };
const P360 = { w: 360, h: 640, inset: { t: 24, r: 0, b: 0, l: 0 } };
const LAND = { w: 844, h: 390, inset: { t: 0, r: 47, b: 21, l: 47 } };
const TAB = { w: 768, h: 1024, inset: { t: 24, r: 0, b: 20, l: 0 } };
const jobs = [
  ...['betting', 'running', 'win-gamble-offer', 'gamble-flip', 'loss', 'settings', 'start', 'loading'].map((s) => ({ page: s, out: s, ...P390 })),
  ...['betting', 'win-gamble-offer'].map((s) => ({ page: s, out: s, ...P360 })),
  { page: 'betting', out: 'landscape-A-betting', ...LAND }, { page: 'win-gamble-offer', out: 'landscape-A-win', ...LAND },
  { page: 'betting', out: 'betting', ...TAB },
];
const COMPARE = [{ out: 'compare-betting-390x844', png: 'betting-390x844.png' }, { out: 'compare-win-390x844', png: 'win-gamble-offer-390x844.png' }];

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

// runs in the page: identical to measure() in ../mobile/render.mjs
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

  const taps = [...document.querySelectorAll('button, [role=button], input, select, a')].filter((el) => vis(el) && !el.closest('[inert]'));
  let minT = null;
  for (const el of taps) {
    const r = R(el); const s = Math.min(r.w, r.h);
    if (!minT || s < minT.size) minT = { size: s, ...r, el: desc(el) };
    if (s < minTap - 0.01) v.push({ kind: 'tap-target', size: s, rect: r, el: desc(el) });
    let sc = el.parentElement; while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
    const box = sc ? R(sc) : r;
    if (box.x < safe.x - 0.5 || box.y < safe.y - 0.5 || box.x + box.w > safe.r + 0.5 || box.y + box.h > safe.b + 0.5) v.push({ kind: 'outside-safe-area', rect: box, safe, el: desc(sc || el) });
  }

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

  const tiles = [...document.querySelectorAll('.tile')].filter(vis).map(R);
  const guard = [...document.querySelectorAll('.centre > *, .dock, .top')].filter(vis);
  for (const g of guard) { const gr = R(g); const t = tiles.find((tr) => hit(tr, gr)); if (t) v.push({ kind: 'overlap', el: desc(g), rect: gr, tile: t }); }
  for (const c of [...document.querySelectorAll('.centre')].filter(vis)) if (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1) v.push({ kind: 'centre-overflow', scrollH: c.scrollHeight, clientH: c.clientHeight, scrollW: c.scrollWidth, clientW: c.clientWidth });
  for (const t of tiles) if (t.x < -0.5 || t.y < -0.5 || t.x + t.w > W + 0.5 || t.y + t.h > H + 0.5) { v.push({ kind: 'tile-offscreen', rect: t }); break; }

  const tileSize = tiles.length ? Math.min(...tiles.map((t) => Math.min(t.w, t.h))) : null;
  return {
    coarsePointer: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches,
    tapTargets: taps.length, minTapTarget: minT, minFont: minF, minBodyFont: minB, ringTileMin: tileSize ? +tileSize.toFixed(1) : null, violations: v,
  };
}

// runs in the page: every element's box (decorations excluded), to compare the skin against the base page
function boxes() {
  return [...document.body.querySelectorAll('*')].filter((el) => !el.closest('.xd')).map((el) => {
    const r = el.getBoundingClientRect(), f = getComputedStyle(el).fontSize;
    return `${el.tagName}.${typeof el.className === 'string' ? el.className : ''}|${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}|${f}`;
  });
}

async function open(page, url, j) {
  await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: j.w > j.h });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate((i) => {
    const s = document.documentElement.style;
    s.setProperty('--sim-sat', `${i.t}px`); s.setProperty('--sim-sar', `${i.r}px`); s.setProperty('--sim-sab', `${i.b}px`); s.setProperty('--sim-sal', `${i.l}px`);
    document.documentElement.setAttribute('data-sim', '');
  }, j.inset);
  await page.evaluate(() => document.fonts.ready);
}

function weight() {
  const css = readFileSync(join(HERE, 'xmas.css')), svg = Buffer.from(HOLLY + LIGHTS);
  const gz = (b) => gzipSync(b, { level: 9 }).length;
  return { xmasCssBytes: css.length, injectedSvgBytes: svg.length, gzipXmasCss: gz(css), gzipInjectedSvg: gz(svg), gzipTotal: gz(Buffer.concat([css, svg])), limit: MAX_GZIP };
}

async function main() {
  build();
  await mkdir(PNG, { recursive: true });
  const srv = await serve();
  const url = (dir) => `http://127.0.0.1:${srv.address().port}/${relative(ROOT, join(HERE, dir)).split('\\').join('/')}`;
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--hide-scrollbars'], headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    // still frames: the optional twinkle is off so every PNG is deterministic
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    for (const j of jobs) {
      await open(page, `${url('../mobile/mocks')}/${j.page}.html`, j);
      const before = await page.evaluate(boxes);
      await open(page, `${url('mocks')}/${j.page}.html`, j);
      const after = await page.evaluate(boxes);
      const m = await page.evaluate(measure, MIN_TAP);
      const drift = before.length !== after.length ? [{ kind: 'layout-drift', base: before.length, xmas: after.length }]
        : before.flatMap((b, i) => (b === after[i] ? [] : [{ kind: 'layout-drift', base: b, xmas: after[i] }]));
      m.violations.push(...drift.slice(0, 5));
      const file = `png/${j.out}-${j.w}x${j.h}.png`;
      await page.screenshot({ path: join(HERE, file) });
      results.push({ file, page: `mocks/${j.page}.html`, viewport: `${j.w}x${j.h}`, safeArea: j.inset, elementsComparedWithBase: after.length, layoutDrift: drift.length, ...m });
      const flag = m.violations.length ? `  !! ${m.violations.length} violation(s)` : '';
      console.log(`${file.padEnd(40)} tap>=${m.minTapTarget ? m.minTapTarget.size : '-'}  font>=${m.minFont ? m.minFont.size : '-'}  body>=${m.minBodyFont ? m.minBodyFont.size : '-'}  tile=${m.ringTileMin ?? '-'}  drift=${drift.length}/${after.length}${flag}`);
    }

    // side-by-side comparisons: standard (base PNG) left, Christmas right
    for (const c of COMPARE) {
      await page.setViewport({ width: 2 * 390 + 3 * 24, height: 844 + 72, deviceScaleFactor: 1 });
      const fig = (src, label) => `<figure><figcaption>${label}</figcaption><img src="${src}" width="390" height="844"></figure>`;
      await page.setContent(`<!doctype html><style>body{margin:0;padding:16px 24px;display:flex;gap:24px;background:#30363d;font:700 16px/24px system-ui,sans-serif;color:#fff}
        figure{margin:0}figcaption{margin-bottom:8px}img{display:block;outline:1px solid #555}</style>
        ${fig(`${url('../mobile/png')}/${c.png}`, 'Standard (v4 mobile)')}${fig(`${url('png')}/${c.png}`, 'Christmas skin')}`, { waitUntil: 'load' });
      await page.screenshot({ path: join(PNG, `${c.out}.png`) });
      console.log(`png/${c.out}.png`);
    }
  } finally { await browser.close(); srv.close(); }

  const contrastRows = contrast();
  const w = weight();
  const bad = results.filter((r) => r.violations.length);
  const badContrast = contrastRows.filter((r) => r.pass === false);
  const summary = {
    generated: new Date().toISOString(), rules: { minTapTarget: MIN_TAP, minFont: MIN_FONT, minBodyFont: MIN_BODY, layoutDrift: 0, wcag: 'AA', maxGzipBytes: MAX_GZIP },
    pages: results.length, failing: bad.length, contrastPairs: contrastRows.length, contrastFailing: badContrast.length, weight: w,
    minTapTargetOverall: Math.min(...results.filter((r) => r.minTapTarget).map((r) => r.minTapTarget.size)),
    minFontOverall: Math.min(...results.filter((r) => r.minFont).map((r) => r.minFont.size)),
    minBodyFontOverall: Math.min(...results.filter((r) => r.minBodyFont).map((r) => r.minBodyFont.size)),
  };
  await writeFile(join(HERE, 'measurements.json'), JSON.stringify({ summary, contrast: contrastRows, results }, null, 2) + '\n');
  console.log(`\nweight: xmas.css ${w.xmasCssBytes} B (${w.gzipXmasCss} B gzip) + injected SVG ${w.injectedSvgBytes} B (${w.gzipInjectedSvg} B gzip) = ${w.gzipTotal} B gzip together`);
  let fail = false;
  if (bad.length) { fail = true; console.error(`\nFAIL: ${bad.length} page(s) break the mobile rules:`); for (const r of bad) for (const x of r.violations) console.error(`  ${r.file}: ${x.kind} ${JSON.stringify(x)}`); }
  if (badContrast.length) { fail = true; for (const r of badContrast) console.error(`FAIL contrast ${r.ratio}:1 < ${r.need}:1  ${r.where}`); }
  if (w.gzipTotal > MAX_GZIP) { fail = true; console.error(`FAIL weight ${w.gzipTotal} B gzip > ${MAX_GZIP}`); }
  if (fail) process.exit(1);
  console.log(`OK: ${results.length} pages, tap >= ${MIN_TAP}px, text >= ${MIN_FONT}px, body >= ${MIN_BODY}px, no overlap, no layout drift vs base; ${contrastRows.length} contrast pairs AA. measurements.json written.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
