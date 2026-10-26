// v2 UI tests (puppeteer-core + installed Google Chrome): interaction, state copy, locks, layout at
// 1920x1080 / 1280x720 / 1024x768 / 768x1024 (touch), WIN-tag geometry, recovery, console and network checks.
// Run: npm run build && npm run test:ui
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openGame, waitPhase, state, sleep, clickId, centerOf } from './harness.js';
import { setup, playTo, dispatch, settle, force, BETS } from './scenes.js';

let server, url, browser;
const issues = [];
before(async () => {
  ({ server, url } = await startServer());
  browser = await launch();
});
after(async () => {
  await browser.close();
  server.close();
});

async function fresh(opts = {}) {
  const page = await openGame(browser, url, { seed: 11, timeScale: 4, ...opts });
  page.__done = () => { issues.push(...page.__issues); return page.close(); };
  return page;
}
const bets = async (page) => (await state(page)).bets;
const text = (page, sel) => page.evaluate((s) => (document.querySelector(s) || {}).textContent || '', sel);
const toastText = (page) => text(page, '#r-toast');
const attr = (page, id, a) => page.evaluate((i, x) => document.querySelector(`[data-id="${i}"]`)?.getAttribute(x) ?? null, id, a);
const ghostCount = (page) => page.evaluate(() => document.querySelectorAll('.tile .bet.ghost').length);

const SIZES = [[1920, 1080, 'desktop-xl'], [1280, 720, 'desktop'], [1024, 768, 'tablet-landscape'], [768, 1024, 'tablet-portrait']];

// ------------------------------------------------------------------ betting
test('bets by mouse: click adds, right-click and Shift+click remove (floor 0); square names', async () => {
  const page = await fresh();
  await clickId(page, 'chip-5');
  await clickId(page, 'sq-12');
  await clickId(page, 'sq-12');
  assert.deepEqual(await bets(page), { 12: 10 });
  await clickId(page, 'sq-12', { button: 'right' });
  assert.deepEqual(await bets(page), { 12: 5 });
  assert.equal(await attr(page, 'sq-12', 'aria-label'), 'Square 12, pays 96x, your bet 5');
  await page.keyboard.down('Shift');
  await clickId(page, 'sq-12');
  await page.keyboard.up('Shift');
  assert.deepEqual(await bets(page), {});
  await clickId(page, 'sq-12', { button: 'right' });
  assert.deepEqual(await bets(page), {});
  assert.equal(await attr(page, 'sq-12', 'aria-label'), 'Square 12, pays 96x, your bet 0');
  await page.__done();
});

test('bets by keyboard: 1-5 chips, Enter add, Backspace remove, arrows follow the track, Z/C', async () => {
  const page = await fresh();
  await page.evaluate(() => window.__rl.app.focusId('sq-16'));
  await page.keyboard.press('3');
  assert.equal((await state(page)).chip, 10);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight'); // 16 -> 17 (down the right column)
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  assert.deepEqual(await bets(page), { 16: 1, 17: 2 });
  await page.keyboard.press('Backspace');
  assert.deepEqual(await bets(page), { 16: 1, 17: 1 });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  assert.deepEqual(await bets(page), { 15: 1, 16: 1, 17: 1 });
  await page.keyboard.press('z');
  assert.deepEqual(await bets(page), { 16: 1, 17: 1 });
  await page.keyboard.press('c');
  assert.deepEqual(await bets(page), {});
  assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /^Square 15, pays 96x/);
  assert.ok(await page.evaluate(() => document.getElementById('app').classList.contains('kbd')), 'keyboard focus ring shown');
  await page.__done();
});

test('limit toasts: 10 per square, 200 per round, not enough credits (also announced)', async () => {
  const page = await fresh();
  await clickId(page, 'chip-25');
  await clickId(page, 'sq-1');
  assert.equal((await bets(page))[1], 10);
  assert.match(await toastText(page), /Max bet reached – 10 per square/);
  await setup(page, { balance: 1000, bets: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 10])), chip: 1 });
  await clickId(page, 'sq-30');
  assert.match(await toastText(page), /Round limit reached – 200 per round/);
  await setup(page, { balance: 3, bets: {}, chip: 5 });
  await clickId(page, 'sq-30');
  assert.equal((await bets(page))[30], 3);
  assert.match(await toastText(page), /Not enough credits/);
  assert.match(await text(page, '#live'), /Not enough credits/);
  await page.__done();
});

test('START locks squares and controls; Info/Settings locked (lock badge + line) through SPINNING..PAYOUT; double-click START -> one round', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 12: 1, 6: 1 }, chip: 1, history: [] });
  const b0 = (await state(page)).balance;
  await force(page, 12);
  const p = await centerOf(page, 'btn-start');
  await page.mouse.click(p.x, p.y, { clickCount: 2 });
  await page.mouse.click(p.x, p.y);
  const s = await state(page);
  assert.equal(s.phase, 'SPINNING');
  assert.equal(s.balance, b0 - 2, 'deducted once');
  const locked = await page.evaluate(() => [...document.querySelectorAll('.tile')].every((e) => e.getAttribute('aria-disabled') === 'true'));
  assert.ok(locked, 'all squares locked');
  for (const id of ['chip-1', 'btn-undo', 'btn-clear', 'btn-rebet', 'btn-start', 'icon-info', 'icon-settings', 'icon-help']) assert.equal(await attr(page, id, 'aria-disabled'), 'true', id);
  assert.equal(await attr(page, 'icon-sound', 'aria-disabled'), null, 'Sound stays live');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.ibtn .lk').length), 3, 'lock badges');
  assert.match(await text(page, '#r-util'), /Info & Settings unlock when the round ends/);
  assert.match(await text(page, '#r-centre'), /RUNNING…/);
  assert.match(await text(page, '#r-centre'), /Credits 1,000 − 2 bet = 998/);
  await clickId(page, 'sq-7');
  assert.deepEqual((await state(page)).round.bets, { 6: 1, 12: 1 });
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  assert.equal((await state(page)).history.length, 1, 'one round');
  assert.match(await text(page, '#r-util'), /Info & Settings open again after you collect/);
  assert.equal((await dispatch(page, { type: 'OPEN_INFO', tab: 'settings' })).ok, false);
  await clickId(page, 'btn-collect');
  assert.equal((await state(page)).phase, 'PAYOUT');
  assert.equal(await attr(page, 'icon-settings', 'aria-disabled'), 'true', 'still locked in PAYOUT');
  await waitPhase(page, 'BETTING');
  await settle(page);
  assert.equal(await attr(page, 'icon-settings', 'aria-disabled'), null, 'unlocked after settle');
  await page.__done();
});

test('light run (normal motion) takes 4-6 s and lands on the stored stop', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 30: 1 }, history: [] });
  await force(page, 30);
  const t0 = Date.now();
  await dispatch(page, { type: 'START' });
  await waitPhase(page, 'RESOLVING', 10000);
  const dt = Date.now() - t0;
  assert.ok(dt >= 3900 && dt <= 6600, `light took ${dt} ms`);
  assert.equal(await page.evaluate(() => window.__rl.app.ui.light1.idx), 30);
  await page.__done();
});

// ------------------------------------------------------------------ win, gamble, payout
test('win -> gamble (R/W pick, G, Space on focused GAMBLE, Enter collect) -> payout copy, toast and header delta', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5, history: [] });
  await playTo(page, 12);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'btn-collect', 'Collect is the initial focus');
  assert.match(await text(page, '#r-centre'), /YOU WIN 480/);
  assert.match(await text(page, '#r-centre'), /#12 · 5 × 96 = 480/);
  assert.match(await text(page, '#r-controls'), /Uncollected/);
  await page.keyboard.press('g');
  await waitPhase(page, 'GAMBLE');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'm-collect');
  assert.match(await text(page, '#r-modal'), /DOUBLE OR NOTHING|Double or nothing/i);
  assert.equal(await attr(page, 'm-gamble', 'aria-disabled'), 'true', 'no pick yet');
  await page.keyboard.press('g');
  assert.equal((await state(page)).round.gambles.length, 0);
  await page.keyboard.press('r');
  assert.equal((await state(page)).gamble.pick, 'red');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'pick-red');
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  await page.keyboard.press('g');
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing && window.__rl.game.state.round.gambles.length === 1);
  assert.equal((await state(page)).round.currentWin, 960);
  assert.match(await text(page, '#r-modal'), /MATCH! RED lit\. Your win is now 960\./);
  assert.match(await text(page, '#r-modal'), /Flip 1: you picked RED · RED lit · 480 → 960/);
  await page.keyboard.press('w');
  await page.evaluate(() => window.__rl.app.focusId('pick-red'));
  const order = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => document.activeElement.dataset.id));
  }
  assert.deepEqual(order, ['pick-white', 'm-gamble', 'm-collect'], 'focus stays in the dialog');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await page.keyboard.press(' '); // Space presses the focused GAMBLE button
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing && window.__rl.game.state.round.gambles.length === 2);
  assert.equal((await state(page)).round.currentWin, 1920);
  const bal = (await state(page)).balance;
  await page.evaluate(() => { window.__rl.app.ui.toast = null; });
  await page.keyboard.press('Enter'); // Collect
  assert.equal((await state(page)).phase, 'PAYOUT');
  assert.match(await text(page, '#r-centre'), /\+1,920 COLLECTED/);
  assert.match(await text(page, '#r-centre'), /Added to your credits: 995 → 2,915/);
  assert.match(await text(page, '#r-hdr'), /\+1,920/, 'header delta chip');
  assert.match(await toastText(page), /\+1,920 added to your credits/);
  await waitPhase(page, 'BETTING');
  const s = await state(page);
  assert.equal(s.balance, bal + 1920);
  assert.equal(s.round.settled, true);
  await page.__done();
});

test('gamble loss: loss result view in the dialog, credits unchanged, auto-continue after 3 s; button path too', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5, history: [] });
  await playTo(page, 12);
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'red' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  await page.waitForFunction(() => window.__rl.app.ui.gambleLoss);
  const t0 = Date.now();
  const m = await text(page, '#r-modal');
  assert.match(m, /No match/i);
  assert.match(m, /WHITE lit\. Your pick was RED, so the 480 gamble is lost\./);
  assert.match(m, /Your credits stay at 995\. Nothing else was taken\./);
  assert.match(m, /continues by itself in 3 s/);
  assert.match(await text(page, '#r-controls'), /gamble lost/);
  assert.match(await text(page, '#r-centre'), /Gamble lost/);
  assert.equal((await state(page)).balance, 995);
  await waitPhase(page, 'BETTING', 6000);
  const dt = Date.now() - t0;
  assert.ok(dt >= 2700 && dt < 4500, `auto-continue after ${dt} ms`);
  assert.equal(await text(page, '#r-modal'), '');
  // button path (Enter) at the next loss
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5 });
  await playTo(page, 12);
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'white' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  await page.waitForFunction(() => window.__rl.app.ui.gambleLoss);
  await page.keyboard.press('Enter');
  assert.equal((await state(page)).phase, 'BETTING');
  await page.__done();
});

test('Double Run: mid copy (DOUBLE RUN!, first stop, This round so far) and one double history entry', async () => {
  const page = await fresh({ timeScale: 2 });
  await setup(page, { balance: 1000, bets: { 24: 5, 13: 2 }, history: [] });
  await force(page, 24, 13);
  await dispatch(page, { type: 'START' });
  await waitPhase(page, 'DOUBLE_RUN', 15000);
  const c = await text(page, '#r-centre');
  assert.match(c, /DOUBLE RUN!/);
  assert.match(c, /A second light is running\. #24 stays lit, and the second light can’t stop on it\./);
  assert.match(c, /First stop: #24 · 5 × 24 = 120/);
  assert.match(c, /Double Run on/);
  const r = await text(page, '#r-controls');
  assert.match(r, /This round/);
  assert.match(r, /so far · second light running/);
  assert.match(r, /Double Run…/);
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  await settle(page);
  assert.match(await text(page, '#r-centre'), /YOU WIN 1,080/);
  assert.match(await text(page, '#r-centre'), /Two squares won this round\./);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.wtag.m').length), 1);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.wtag.c').length), 1);
  const dbl = await page.evaluate(() => [...document.querySelectorAll('.he.dr')].map((e) => e.textContent));
  assert.equal(dbl.length, 1, 'one double-width entry');
  assert.match(dbl[0], /DOUBLE.*#24.*#13/);
  await page.__done();
});

test('loss keeps bets; after Collect ghost badges appear, hide on the first live bet; Rebet restores', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 12: 5, 3: 1 }, chip: 5, history: [] });
  await playTo(page, 27, null, 'BETTING');
  assert.deepEqual(await bets(page), { 3: 1, 12: 5 }, 'bets kept after a loss');
  assert.match(await text(page, '#r-centre'), /NO WIN THIS TIME/);
  assert.match(await text(page, '#r-centre'), /The light stopped on #27 \(96x\)\. Your bets are still on the board\./);
  assert.match(await text(page, '#r-controls'), /no win this round/);
  await playTo(page, 12);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  assert.deepEqual(await bets(page), {});
  assert.equal(await ghostCount(page), 2, 'two dashed ghost badges');
  assert.match(await text(page, '#r-centre'), /Press Rebet to place all 6 again/);
  assert.match(await text(page, '#r-controls'), /Rebet 6/);
  await clickId(page, 'sq-40'); // first live bet hides every ghost
  assert.equal(await ghostCount(page), 0, 'ghosts hidden on the first live bet');
  await clickId(page, 'sq-40', { button: 'right' });
  assert.equal(await ghostCount(page), 0, 'ghosts stay hidden until the next settle');
  await page.keyboard.press('r');
  assert.deepEqual(await bets(page), { 3: 1, 12: 5 });
  assert.match(await toastText(page), /Bets restored from last round/);
  await page.__done();
});

test('refill at 0: dialog cannot be dismissed, Enter refills to 1,000', async () => {
  const page = await fresh();
  await setup(page, { balance: 0, bets: {}, history: [] });
  await page.evaluate(() => window.__rl.app.render());
  assert.match(await text(page, '#r-modal'), /Out of play credits/);
  await page.keyboard.press('Escape');
  assert.match(await text(page, '#r-modal'), /Out of play credits/, 'Esc does not close Refill');
  await page.evaluate(() => window.__rl.app.focusId('m-refill'));
  await page.keyboard.press('Enter');
  assert.equal((await state(page)).balance, 1000);
  await settle(page);
  assert.equal(await text(page, '#r-modal'), '');
  await page.__done();
});

// ------------------------------------------------------------------ settings, storage, recovery
test('corrupt settings key -> defaults + notice + toast (no ERROR); other keys untouched', async () => {
  const page = await fresh({ presetStorage: { 'rl.v1.settings': '{not json', 'rl.v1.balance': JSON.stringify({ v: 777, seq: 3 }) } });
  const s = await state(page);
  assert.equal(s.phase, 'BETTING');
  assert.deepEqual(s.settings, { mute: false, music: 60, sfx: 80, reducedMotion: false });
  assert.equal(s.balance, 777, 'credits not affected');
  assert.match(await toastText(page), /Settings were reset to the defaults/);
  await clickId(page, 'icon-settings');
  assert.match(await text(page, '#r-modal'), /Your saved settings couldn’t be read, so they were reset to the defaults\./);
  assert.match(await text(page, '#r-modal'), /PLACEHOLDER – pending approval/);
  assert.equal(await attr(page, 'tg-turbo', 'aria-disabled'), 'true', 'Turbo is a disabled placeholder');
  // invalid (parseable) settings are reset too
  const p2 = await fresh({ presetStorage: { 'rl.v1.settings': JSON.stringify({ mute: 'yes', music: 500 }) } });
  assert.equal((await state(p2)).phase, 'BETTING');
  await p2.__done();
  await page.__done();
});

test('corrupt round key -> ERROR dialog -> Reload resets only that key', async () => {
  const page = await fresh({ noReload: true, presetStorage: { 'rl.v1.round': '{broken', 'rl.v1.balance': JSON.stringify({ v: 500, seq: 2 }) } });
  assert.equal((await state(page)).phase, 'ERROR');
  assert.match(await text(page, '#r-modal'), /Something went wrong/);
  assert.match(await text(page, '#r-modal'), /E-CORRUPT-ROUND/);
  assert.match(await text(page, '#r-centre'), /PAUSED/);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'm-reload');
  await page.keyboard.press('Enter');
  const s = await state(page);
  assert.equal(s.phase, 'BETTING');
  assert.equal(s.balance, 500);
  assert.equal(await page.evaluate(() => localStorage.getItem('rl.v1.round')), null);
  await page.__done();
});

test('mute and volume persist across a reload', async () => {
  const page = await fresh();
  await page.keyboard.press('m');
  assert.equal((await state(page)).settings.mute, true);
  await clickId(page, 'icon-settings');
  await page.evaluate(() => window.__rl.app.focusId('sl-music'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.__rl.app.focusId('sl-sfx'));
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual((await state(page)).settings, { mute: true, music: 70, sfx: 75, reducedMotion: false });
  await openGame(browser, url, { seed: 2, keepStorage: true }, page);
  assert.deepEqual((await state(page)).settings, { mute: true, music: 70, sfx: 75, reducedMotion: false });
  assert.match(await attr(page, 'icon-sound', 'aria-label'), /muted/);
  await page.__done();
});

test('reduced motion: defaults from prefers-reduced-motion; light reaches the stop in <= 0.8 s', async () => {
  const page = await fresh({ reducedMotion: true, timeScale: 1 });
  assert.equal((await state(page)).settings.reducedMotion, true);
  await setup(page, { balance: 1000, bets: { 12: 1 }, history: [] });
  await force(page, 30);
  const t0 = Date.now();
  await dispatch(page, { type: 'START' });
  await waitPhase(page, ['RESOLVING', 'BETTING']);
  assert.ok(Date.now() - t0 < 1300, `light took ${Date.now() - t0} ms`);
  assert.ok(await page.evaluate(() => document.getElementById('app').classList.contains('reduced')));
  assert.equal(await page.evaluate(() => document.querySelectorAll('.tile.trail1, .tile.trail2').length), 0, 'no trail');
  await page.__done();
});

test('Esc closes only the Info window (not the gamble dialog); Info tabs by arrows', async () => {
  const page = await fresh();
  await clickId(page, 'icon-info');
  assert.equal((await state(page)).info, 'paytable');
  assert.match(await text(page, '#r-modal'), /≈95\.45%/);
  await page.keyboard.press('ArrowRight');
  assert.equal((await state(page)).info, 'help');
  assert.match(await text(page, '#r-modal'), /Play credits only\. No real money value\./);
  await page.keyboard.press('Escape');
  assert.equal((await state(page)).info, null);
  await setup(page, { balance: 1000, bets: { 12: 1 }, history: [] });
  await playTo(page, 12);
  await page.keyboard.press('g');
  await waitPhase(page, 'GAMBLE');
  await page.keyboard.press('Escape');
  assert.equal((await state(page)).phase, 'GAMBLE');
  await page.__done();
});

test('reload mid-spin -> Recovery -> same result, no redraw, no double credit', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i + 1, 1])), history: [] });
  await dispatch(page, { type: 'START' }); // real seeded draw
  const s0 = await state(page);
  await sleep(500);
  await openGame(browser, url, { seed: 777, keepStorage: true, timeScale: 4 }, page);
  await waitPhase(page, 'RECOVERY');
  const s1 = await state(page);
  assert.equal(s1.balance, s0.balance);
  assert.deepEqual([s1.round.s1, s1.round.s2], [s0.round.s1, s0.round.s2]);
  assert.match(await text(page, '#r-modal'), /Round restored/i);
  assert.match(await text(page, '#r-modal'), /Light running/);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'GAMBLE_OFFER');
  const s2 = await state(page);
  assert.equal(s2.round.s1, s0.round.s1, 'same stop shown');
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  const credited = (await state(page)).balance;
  assert.equal(credited, s0.balance + s0.round.baseWin);
  await openGame(browser, url, { seed: 5, keepStorage: true }, page);
  assert.equal((await state(page)).phase, 'BETTING');
  assert.equal((await state(page)).balance, credited, 'no double credit');
  await page.__done();
});

test('1920x jackpot celebration shows and is skippable (Space) without collecting', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 8: 1 }, history: [] });
  await force(page, 8);
  await dispatch(page, { type: 'START' });
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  await sleep(200);
  assert.match(await text(page, '#r-fx'), /Jackpot square #8/);
  assert.ok(await page.evaluate(() => document.querySelectorAll('.confetti i').length <= 40));
  await page.keyboard.press(' ');
  assert.equal(await page.evaluate(() => window.__rl.app.ui.celebration), null);
  assert.equal(await text(page, '#r-fx'), '');
  assert.equal((await state(page)).phase, 'GAMBLE_OFFER', 'skip does not collect');
  await page.__done();
});

test('animation suspended mid-spin (hidden tab) -> result unchanged on return', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 12: 1 }, history: [] });
  await dispatch(page, { type: 'START' });
  const s1 = (await state(page)).round.s1;
  await sleep(700);
  await page.evaluate(() => window.__rl.app.setPaused(true));
  await sleep(2500);
  assert.equal((await state(page)).phase, 'SPINNING');
  await page.evaluate(() => window.__rl.app.setPaused(false));
  await waitPhase(page, ['GAMBLE_OFFER', 'BETTING'], 15000);
  const s = await state(page);
  assert.equal(s.round.s1, s1);
  assert.equal(await page.evaluate(() => window.__rl.app.ui.lightIndex), s.round.s2 || s.round.s1);
  await page.__done();
});

test('storage unavailable -> plays in memory with a "Progress won\'t be saved" toast', async () => {
  const page = await fresh({ noStorage: true });
  assert.match(await toastText(page), /Progress won't be saved on this device/);
  await clickId(page, 'sq-1');
  assert.deepEqual(await bets(page), { 1: 1 });
  await page.__done();
});

test('Start screen (flag on): PLAY is the first gesture, unlocks audio, then the board', async () => {
  const page = await fresh({ startScreen: true });
  assert.equal(await page.evaluate(() => document.getElementById('r-start').hidden), false);
  assert.match(await text(page, '#r-start'), /PLAY/i);
  assert.match(await text(page, '#r-start'), /1,000/);
  assert.equal(await page.evaluate(() => window.__rl.app.audio.unlocked), false);
  assert.equal(await page.evaluate(() => document.getElementById('r-track').inert), true, 'board inert behind the start screen');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.getElementById('r-start').hidden), true);
  assert.equal(await page.evaluate(() => window.__rl.app.audio.unlocked), true, 'PLAY unlocks audio');
  await clickId(page, 'sq-5');
  assert.deepEqual(await bets(page), { 5: 1 });
  await page.__done();
});

// ------------------------------------------------------------------ layout per breakpoint
for (const [w, h, bp] of SIZES) {
  test(`layout ${w}x${h} -> ${bp}: 50 tiles on screen, no overlaps, controls visible, WIN tags clear of tiles`, async () => {
    const page = await fresh({ width: w, height: h, touch: w < 900 });
    const geo = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.tile')].map((e) => ({ id: e.dataset.id, ...r(e).toJSON() }));
      let overlaps = 0;
      for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i], b = tiles[j];
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps++;
      }
      const inView = tiles.every((t) => t.left >= 0 && t.top >= 0 && t.right <= innerWidth && t.bottom <= innerHeight);
      const start = r(document.querySelector('[data-id="btn-start"]'));
      return { bp: document.getElementById('app').dataset.bp, n: tiles.length, overlaps, inView, startVisible: start.bottom <= innerHeight && start.right <= innerWidth && start.width > 0, scrollW: document.documentElement.scrollWidth, small: [...document.querySelectorAll('#r-controls *, #r-centre *, #r-util *, #r-track *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 9).map((e) => `${e.className}:${e.textContent.trim().slice(0, 12)}:${getComputedStyle(e).fontSize}`) };
    });
    assert.equal(geo.bp, bp);
    assert.equal(geo.n, 50);
    assert.equal(geo.overlaps, 0);
    assert.ok(geo.inView, 'all tiles inside the viewport');
    assert.ok(geo.startVisible, 'START visible');
    assert.ok(geo.scrollW <= w, 'no horizontal overflow');
    assert.deepEqual(geo.small, [], 'no text below the 9 px token minimum');
    // track order: #1 top-left, clockwise
    const pos = await page.evaluate(() => Object.fromEntries([1, 16, 17, 25, 26, 41, 42, 50].map((n) => { const b = document.querySelector(`[data-id="sq-${n}"]`).getBoundingClientRect(); return [n, [Math.round(b.left), Math.round(b.top)]]; })));
    assert.ok(pos[1][0] < pos[16][0] && pos[1][1] === pos[16][1], 'top row 1..16 left to right');
    assert.ok(pos[17][1] < pos[25][1] && pos[17][0] === pos[16][0], 'right column 17..25 downward');
    assert.ok(pos[26][0] > pos[41][0], 'bottom row 26..41 right to left');
    assert.ok(pos[42][1] > pos[50][1] && pos[50][0] === pos[1][0], 'left column 42..50 upward');
    // WIN tags (Double Run #21 right column + #46 left column) never overlap any tile or badge
    await setup(page, { bets: { ...BETS, 46: 3 } });
    await playTo(page, 21, 46);
    const tags = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      return [...document.querySelectorAll('.wtag')].map((t) => [...document.querySelectorAll('.tile, .tile .bet')].filter((x) => hit(r(t), r(x))).length);
    });
    assert.equal(tags.length, 2);
    assert.deepEqual(tags, [0, 0], 'WIN tags clear of tiles, bulbs and badges');
    await page.__done();
  });
}

test('touch (768x1024): tap adds the selected chip; long-press opens the square sheet with -chip', async () => {
  const page = await fresh({ width: 768, height: 1024, touch: true });
  const p = await centerOf(page, 'sq-12');
  await page.touchscreen.tap(p.x, p.y);
  assert.deepEqual(await bets(page), { 12: 1 });
  await page.touchscreen.touchStart(p.x, p.y);
  await sleep(600);
  await page.touchscreen.touchEnd();
  await sleep(100);
  assert.deepEqual(await bets(page), { 12: 1 }, 'long-press does not add');
  const sheet = await text(page, '#r-tip');
  assert.match(sheet, /Square 12/);
  assert.match(sheet, /Your bet: 1 \/ 10/);
  const q = await centerOf(page, 'tip-remove');
  await page.touchscreen.tap(q.x, q.y);
  assert.deepEqual(await bets(page), {});
  await page.__done();
});

test('narrow viewport (390x844) falls back to the tablet layout; below 320 wide shows Rotate / enlarge', async () => {
  const page = await fresh({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.getElementById('app').dataset.bp), 'tablet-portrait');
  assert.equal(await page.evaluate(() => document.getElementById('rotate').hidden), true);
  await clickId(page, 'sq-3');
  assert.deepEqual(await bets(page), { 3: 1 });
  await page.setViewport({ width: 300, height: 600 });
  await sleep(150);
  assert.equal(await page.evaluate(() => document.getElementById('rotate').hidden), false);
  assert.match(await text(page, '#rotate'), /Turn your phone upright, or make the window bigger/);
  await page.__done();
});

test('no console errors, no failed or external requests, fonts loaded locally (Bungee + Plus Jakarta Sans)', async () => {
  const page = await fresh();
  const fonts = await page.evaluate(() => ['400 20px Bungee', "500 20px 'Plus Jakarta Sans'", "700 20px 'Plus Jakarta Sans'", "800 20px 'Plus Jakarta Sans'"].map((f) => document.fonts.check(f)));
  assert.deepEqual(fonts, [true, true, true, true]);
  const external = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => !n.startsWith(location.origin) && !n.startsWith('data:')));
  assert.deepEqual(external, [], 'no external requests');
  await page.__done();
  assert.deepEqual(issues, [], 'console errors / failed or external requests across all UI tests');
});
