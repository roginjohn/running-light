// v2 screenshots: states 01-19 at 1920x1080, 1280x720, 1024x768, 768x1024 (forced outcomes, test mode only),
// WIN-tag checks, and side-by-side images against design/redesign-v2/mockups/<WxH>/<state>.png.
// Usage: npm run build && node test/ui/screenshots-v2.js [--size 1920x1080] [--only 05,06]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { startServer, launch, openGame, sleep, waitPhase } from './harness.js';
import { setup, playTo, dispatch, settle, force, BETS, H01, H03, H04, H06 } from './scenes.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const SIZES = (args.size ? [args.size] : ['1920x1080', '1280x720', '1024x768', '768x1024']).map((s) => s.split('x').map(Number));
const ONLY = args.only ? args.only.split(',') : null;
const OUT = path.resolve(new URL('../../test-results/v2/', import.meta.url).pathname);
const MOCK = path.resolve(new URL('../../../design/redesign-v2/mockups/', import.meta.url).pathname);

const { server, url } = await startServer();
const browser = await launch();
const results = [];
const issues = [];
const tagChecks = [];

const pause = (page) => page.evaluate(() => window.__rl.app.setPaused(true));
const focus = (page, id) => page.evaluate((i) => window.__rl.app.focusId(i), id);
const render = (page) => page.evaluate(() => window.__rl.app.render());

/** WIN-tag geometry check: the tag must not overlap any tile (bulb, frame, neighbour) or any bet badge. */
async function checkTags(page) {
  return page.evaluate(() => {
    const rect = (e) => e.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const tags = [...document.querySelectorAll('.wtag')];
    const tiles = [...document.querySelectorAll('.tile')];
    const badges = [...document.querySelectorAll('.tile .bet')];
    const out = [];
    for (const t of tags) {
      const r = rect(t);
      const overTiles = tiles.filter((x) => hit(r, rect(x))).map((x) => x.dataset.id);
      const overBadges = badges.filter((x) => hit(r, rect(x))).length;
      out.push({ tag: t.textContent.trim(), overTiles, overBadges, ok: !overTiles.length && !overBadges });
    }
    return out;
  });
}

async function shot(size, name, fn, opts = {}) {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  const [w, h] = size;
  const dir = path.join(OUT, `${w}x${h}`);
  mkdirSync(dir, { recursive: true });
  const page = await openGame(browser, url, { seed: 7, timeScale: opts.timeScale || 4, width: w, height: h, ...opts });
  try {
    await fn(page);
    if (!opts.keepMouse) await page.mouse.move(w - 2, h - 2).catch(() => {});
    if (opts.after) await opts.after(page);
    await sleep(opts.extraWait ?? 250);
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file });
    if (opts.tags) tagChecks.push({ size: `${w}x${h}`, name, tags: await checkTags(page) });
    results.push({ size: `${w}x${h}`, name, file });
    issues.push(...page.__issues.map((i) => `${w}x${h} ${name}: ${i}`));
    console.log('captured', `${w}x${h}`, name);
  } catch (e) {
    issues.push(`${w}x${h} ${name}: FAILED ${e.message}`);
    console.log('FAILED', `${w}x${h}`, name, e.message);
  } finally {
    await page.close();
  }
}

const hoverSq = async (page, n) => {
  const p = await page.evaluate((i) => { const r = document.querySelector(`[data-id="sq-${i}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, n);
  await page.mouse.move(p.x, p.y);
  await sleep(450);
};

async function gamblePick(page) {
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
}

for (const size of SIZES) {
  const [w] = size;
  const pointer = w >= 900; // hover tooltips only on pointer layouts (as in the mockups)
  await shot(size, '01-loading', async (page) => {
    await page.evaluate(() => window.__rlShowLoading(0.72, 5, 'Warming up the bulbs…'));
  });
  await shot(size, '02-start-menu', async (page) => {
    await setup(page, { bets: {} });
    await pause(page);
    await render(page);
    await focus(page, 'start-play');
  }, { startScreen: true });
  await shot(size, '03-betting', async (page) => {
    await setup(page);
    await dispatch(page, { type: 'ADD_BET', square: 31 }); // 10 already -> "Max bet reached" toast
    await focus(page, 'sq-20');
  }, { keepMouse: pointer, after: async (page) => { if (pointer) await hoverSq(page, 49); else await page.mouse.move(size[0] - 2, size[1] - 2); } });
  await shot(size, '04-spinning', async (page) => {
    await setup(page);
    await force(page, 12);
    await dispatch(page, { type: 'START' });
    await sleep(400);
    await pause(page);
    await page.evaluate(() => { const a = window.__rl.app; a.ui.displayBalance = null; a.ui.light1 = { idx: 19, trail: [18, 17], level: null }; a.render(); });
  });
  await shot(size, '05-win-gamble-offer', async (page) => {
    await setup(page);
    await playTo(page, 12);
    await sleep(800);
    await focus(page, 'btn-collect');
  });
  await shot(size, '06-gamble-pick', gamblePick);
  await shot(size, '07-gamble-loss', async (page) => {
    await gamblePick(page);
    await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
    await dispatch(page, { type: 'GAMBLE_FLIP' });
    await page.waitForFunction(() => window.__rl.app.ui.gambleLoss);
    await pause(page);
    await focus(page, 'm-back');
  }, { timeScale: 2 });
  await shot(size, '08-payout', async (page) => {
    await gamblePick(page);
    await dispatch(page, { type: 'COLLECT' });
    await sleep(120);
    await pause(page);
    await page.evaluate(() => { const a = window.__rl.app; a.ui.displayBalance = null; a.render(); });
  }, { timeScale: 1 });
  await shot(size, '09-rebet-ghosts', async (page) => {
    await setup(page, { balance: 1720 });
    await playTo(page, 12);
    await page.keyboard.press('Enter');
    await waitPhase(page, 'BETTING');
    await settle(page);
    await page.evaluate(() => { window.__rl.app.ui.toast = null; window.__rl.app.render(); });
  });
  await shot(size, '10-double-run-mid', async (page) => {
    await setup(page, { balance: 2160, history: H03 });
    await force(page, 24, 13);
    await dispatch(page, { type: 'START' });
    await waitPhase(page, 'DOUBLE_RUN', 20000);
    await sleep(300);
    await pause(page);
    await page.evaluate(() => { const a = window.__rl.app; a.ui.light2 = { idx: 11, trail: [10, 9], level: null }; a.render(); });
  }, { tags: true });
  await shot(size, '11-double-run-result', async (page) => {
    await setup(page, { balance: 2160, history: H03 });
    await playTo(page, 24, 13);
    await sleep(800);
    await focus(page, 'btn-collect');
  }, { tags: true });
  await shot(size, '12-loss', async (page) => {
    await setup(page, { balance: 3200, history: H04 });
    await playTo(page, 27, null, 'BETTING');
    await focus(page, 'btn-start');
  });
  await shot(size, '13-jackpot', async (page) => {
    await setup(page, { balance: 3160, history: H06 });
    await force(page, 8);
    await dispatch(page, { type: 'START' });
    await waitPhase(page, 'GAMBLE_OFFER', 20000);
    await sleep(900);
    await pause(page);
  }, { timeScale: 1, tags: true });
  await shot(size, '14-refill', async (page) => {
    await setup(page, { balance: 0, history: H06, bets: {} });
    await render(page);
    await focus(page, 'm-refill');
  });
  for (const [name, tab] of [['15-settings', 'settings'], ['16-paytable', 'paytable'], ['17-help', 'help']]) {
    await shot(size, name, async (page) => {
      await setup(page);
      await page.evaluate(() => { window.__rl.app.ui.toast = null; });
      await dispatch(page, { type: 'OPEN_INFO', tab });
      await sleep(300);
      if (tab === 'settings') await focus(page, 'sl-music');
    }, tab === 'settings' ? { presetStorage: { 'rl.v1.settings': '{not json' } } : {});
  }
  await shot(size, '18-error', async (page) => {
    await setup(page);
    await force(page, 12);
    await dispatch(page, { type: 'START' });
    await sleep(300);
    await dispatch(page, { type: 'FAIL', message: 'Storage write failed: simulated (screenshot)' });
    await sleep(200);
    await focus(page, 'm-reload');
  });
  await shot(size, '19-recovery', async (page) => {
    await setup(page);
    await force(page, 12);
    await dispatch(page, { type: 'START' });
    await sleep(300);
    await openGame(browser, url, { seed: 99, keepStorage: true, width: size[0], height: size[1] }, page);
    await waitPhase(page, 'RECOVERY');
    await focus(page, 'm-continue');
  });
  // WIN-tag checks: Double Run #13 + #24 (above), #8 single, right column #21 + left column #46
  await shot(size, 'tags-08-single', async (page) => {
    await setup(page, { bets: { ...BETS } });
    await playTo(page, 8);
    await page.evaluate(() => { const a = window.__rl.app; a.ui.celebration = null; a.ui.confetti = []; a.render(); });
  }, { tags: true });
  await shot(size, 'tags-21-right-46-left', async (page) => {
    await setup(page, { bets: { 21: 2, 46: 3, 12: 1 } });
    await playTo(page, 21, 46);
    await sleep(800);
  }, { tags: true });
  await shot(size, 'tags-13-then-8', async (page) => {
    await setup(page, { bets: { ...BETS } });
    await playTo(page, 13, 8);
    await page.evaluate(() => { const a = window.__rl.app; a.ui.celebration = null; a.ui.confetti = []; a.render(); });
  }, { tags: true });
}

// ---------------------------------------------------------------- side-by-side
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1200 });
for (const r of results) {
  const mock = path.join(MOCK, r.size, `${r.name}.png`);
  if (!existsSync(mock)) continue;
  const [w, h] = r.size.split('x').map(Number);
  const sc = Math.min(940 / w, 1100 / h);
  const a = readFileSync(mock).toString('base64');
  const b = readFileSync(r.file).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:#111;color:#eee;font:16px sans-serif"><div style="display:flex;gap:20px;padding:10px">
    <div><div style="padding:4px">MOCKUP ${r.size}/${r.name}</div><img width=${Math.round(w * sc)} height=${Math.round(h * sc)} src="data:image/png;base64,${a}"></div>
    <div><div style="padding:4px">BUILD ${r.size}/${r.name}</div><img width=${Math.round(w * sc)} height=${Math.round(h * sc)} src="data:image/png;base64,${b}"></div></div></body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const dir = path.join(OUT, 'compare', r.size);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${r.name}-side-by-side.png`), clip: { x: 0, y: 0, width: Math.round(w * sc) * 2 + 40, height: Math.round(h * sc) + 50 } });
}
writeFileSync(path.join(OUT, 'screenshots.json'), JSON.stringify({ captured: results.map((r) => `${r.size}/${r.name}.png`), tagChecks, issues }, null, 2));
const badTags = tagChecks.flatMap((t) => t.tags.filter((x) => !x.ok).map((x) => `${t.size} ${t.name}: ${x.tag} over ${x.overTiles.join(',')} badges ${x.overBadges}`));
console.log(`captured ${results.length}; WIN-tag checks ${tagChecks.reduce((a, t) => a + t.tags.length, 0)} tags, ${badTags.length} overlaps`);
if (badTags.length) console.log(badTags.join('\n'));
console.log('console/network issues:', issues.length ? issues : 'none');
await browser.close();
server.close();
process.exitCode = issues.length || badTags.length ? 1 : 0;
