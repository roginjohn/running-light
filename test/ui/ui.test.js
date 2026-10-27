// v2 UI tests (puppeteer-core + installed Google Chrome): interaction, state copy, locks, layout at
// 1920x1080 / 1280x720 / 1024x768 / 768x1024 (touch), WIN-tag geometry, recovery, console and network checks.
// Run: npm run build && npm run test:ui
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openGame, waitPhase, state, sleep, clickId, centerOf } from './harness.js';
import { setup, playTo, dispatch, settle, force, staged, BETS } from './scenes.js';
import { MAX_GAMBLES, GAMBLE_CAP } from '../../src/engine/config.js';

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

test('START locks squares and controls; bottom-bar Settings/Stats/Fairness locked (lock badge + reason) through SPINNING..PAYOUT; double-click START -> one round', async () => {
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
  for (const id of ['chip-1', 'btn-half', 'btn-double', 'btn-undo', 'btn-clear', 'btn-rebet', 'btn-start', 'icon-settings', 'icon-stats', 'icon-fair']) assert.equal(await attr(page, id, 'aria-disabled'), 'true', id);
  assert.equal(await attr(page, 'icon-sound', 'aria-disabled'), null, 'Sound stays live');
  assert.equal(await page.evaluate(() => document.querySelectorAll('#r-bar .ibtn .lk').length), 3, 'lock badges');
  assert.match(await attr(page, 'icon-settings', 'aria-label'), /Settings: unlocks when the round ends/);
  assert.match(await text(page, '#r-centre'), /RUNNING…/i);
  assert.match(await text(page, '#r-centre'), /Credits 1,000 − 2 bet = 998/i);
  await clickId(page, 'sq-7');
  assert.deepEqual((await state(page)).round.bets, { 6: 1, 12: 1 });
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  assert.equal((await state(page)).history.length, 1, 'one round');
  await staged(page); // the bar is rendered one frame after the board and centre (batch 7)
  assert.match(await attr(page, 'icon-stats', 'aria-label'), /Paytable and help: opens again after you collect/);
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
test('win -> gamble (R/W pick, G, Space on focused Gamble, Enter collect) -> payout copy, toast and credits delta', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5, history: [] });
  await playTo(page, 12);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'btn-collect', 'Collect is the initial focus');
  assert.match(await text(page, '#r-centre'), /YOU WIN 480/i);
  assert.match(await text(page, '#r-centre'), /#12\s*96x\s*Bet × pays\s*5 × 96 = 480/i);
  assert.match(await text(page, '#r-controls'), /Uncollected/);
  await page.keyboard.press('g');
  await waitPhase(page, 'GAMBLE');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'btn-collect');
  await staged(page);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'btn-collect', 'still on Collect once the gamble rail is in');
  assert.match(await text(page, '#r-centre'), /Double or nothing · flip 1/);
  assert.equal(await text(page, '#r-modal'), '', 'the gamble lives in the centre, not in a dialog');
  assert.equal(await attr(page, 'btn-flip', 'aria-disabled'), 'true', 'no pick yet');
  await page.keyboard.press('g');
  assert.equal((await state(page)).round.gambles.length, 0);
  await page.keyboard.press('r');
  assert.equal((await state(page)).gamble.pick, 'red');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'pick-red');
  assert.match(await text(page, '[data-id="btn-flip"]'), /Gamble on red\s*480 → 960 or 0 · G/);
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  await page.keyboard.press('g');
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing && window.__rl.game.state.round.gambles.length === 1);
  await staged(page);
  assert.equal((await state(page)).round.currentWin, 960);
  assert.match(await text(page, '#r-centre'), /Match! Red lit\. Your win is now 960\./);
  assert.match(await text(page, '#r-centre'), /Flip 1: you picked Red · Red lit · 480 → 960/);
  await page.keyboard.press('w');
  await page.evaluate(() => window.__rl.app.focusId('pick-red'));
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'pick-white', 'Tab moves red -> white');
  await page.evaluate(() => window.__rl.app.focusId('btn-flip'));
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await page.keyboard.press(' '); // Space presses the focused Gamble button
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing && window.__rl.game.state.round.gambles.length === 2);
  assert.equal((await state(page)).round.currentWin, 1920);
  const bal = (await state(page)).balance;
  await page.evaluate(() => { window.__rl.app.ui.toast = null; });
  await page.keyboard.press('Enter'); // Collect
  assert.equal((await state(page)).phase, 'PAYOUT');
  assert.match(await text(page, '#r-centre'), /\+1,920 COLLECTED/i);
  assert.match(await text(page, '#r-centre'), /Added to your credits: 995 → 2,915/i);
  assert.match(await text(page, '#r-credits'), /\+1,920/, 'credits delta in the rail');
  assert.match(await toastText(page), /\+1,920 added to your credits/);
  await waitPhase(page, 'BETTING');
  const s = await state(page);
  assert.equal(s.balance, bal + 1920);
  assert.equal(s.round.settled, true);
  await page.__done();
});

test('gamble flip lose: No match in the centre panel, credits unchanged, auto-continue after 3 s; button path too', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5, history: [] });
  await playTo(page, 12);
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'red' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  await page.waitForFunction(() => window.__rl.app.ui.gambleLoss);
  const t0 = Date.now();
  await staged(page); // the rail follows the centre one frame later (batch 7)
  const m = await text(page, '#r-centre');
  assert.match(m, /Gamble lost/);
  assert.match(m, /No match\. White lit\. Your pick was Red, so the 480 gamble is lost\./);
  assert.match(m, /Gamble lost\s*480\s*Credits\s*995/);
  assert.match(m, /Your credits stay at 995\. Nothing else was taken\./);
  const look = await page.evaluate(() => ({
    flip: document.querySelector('#r-centre .flip').className, pill: getComputedStyle(document.querySelector('#r-centre [data-role="status"]')).color,
    lost: getComputedStyle(document.querySelector('#r-centre .gc .lost')).color, picks: [...document.querySelectorAll('#r-centre .pick')].map((p) => p.getAttribute('aria-disabled')),
  }));
  assert.equal(look.flip, 'flip w', 'the disc rests on the white face');
  assert.deepEqual([look.pill, look.lost], ['rgb(248, 113, 113)', 'rgb(248, 113, 113)'], 'red text (accent-red-text)');
  assert.deepEqual(look.picks, ['true', 'true'], 'discs locked');
  assert.match(await text(page, '[data-id="btn-back"]'), /Back to the board\s*continues in 3 s · Enter/);
  assert.match(await text(page, '#r-controls'), /gamble lost/);
  assert.equal((await state(page)).balance, 995);
  await waitPhase(page, 'BETTING', 6000);
  const dt = Date.now() - t0;
  assert.ok(dt >= 2700 && dt < 4500, `auto-continue after ${dt} ms`);
  assert.equal(await text(page, '#r-modal'), '');
  assert.doesNotMatch(await text(page, '#r-centre'), /No match/, 'back to the board');
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
  assert.match(c, /Double Run!/);
  assert.match(c, /A second light is running\. #24 stays lit, and the second light can’t stop on it\./);
  assert.match(c, /1 · #24\s*24x\s*Bet × pays\s*5 × 24 = 120/);
  assert.match(c, /Double Run on/);
  assert.equal(await text(page, '[data-id="sq-24"] .mkt'), '1st', 'first stop marked while the second light runs');
  const r = await text(page, '#r-controls');
  assert.match(r, /This round/);
  assert.match(r, /so far · second light running/);
  assert.match(r, /Double Run…/);
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  await settle(page);
  assert.match(await text(page, '#r-centre'), /YOU WIN 1,080/i);
  assert.match(await text(page, '#r-centre'), /Two squares won this round\./i);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.tile.win')].map((e) => [e.dataset.id, e.querySelector('.mkt').textContent])), [['sq-13', '2nd'], ['sq-24', '1st']]);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.wtag').length), 0, 'no WIN tags');
  // top row "Last results": one Double Run pill with both multipliers
  const dbl = await page.evaluate(() => [...document.querySelectorAll('#r-top [data-role="history"] .tp.kdr')].map((e) => e.textContent));
  assert.deepEqual(dbl, ['24x · 480x'], 'one Double Run entry');
  assert.match(await page.evaluate(() => document.querySelector('#r-top [data-role="history"]').getAttribute('aria-label')), /#24 24x and #13 480x/);
  await page.__done();
});

test('loss keeps bets; after Collect ghost badges appear, hide on the first live bet; Rebet restores', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 12: 5, 3: 1 }, chip: 5, history: [] });
  await playTo(page, 27, null, 'BETTING');
  assert.deepEqual(await bets(page), { 3: 1, 12: 5 }, 'bets kept after a loss');
  assert.match(await text(page, '#r-centre'), /NO WIN THIS TIME/i);
  assert.match(await text(page, '#r-centre'), /The light stopped on #27 \(96x\)\. Your bets are still on the board\./i);
  assert.match(await text(page, '#r-controls'), /no win this round/);
  await playTo(page, 12);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  assert.deepEqual(await bets(page), {});
  assert.equal(await ghostCount(page), 2, 'two dashed ghost badges');
  assert.match(await text(page, '#r-centre'), /Press Rebet to place all 6 again/i);
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
  assert.match(await text(page, '#r-modal'), /Turbo ?Placeholder – pending approval/i);
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
  assert.match(await text(page, '#r-centre'), /PAUSED/i);
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
  await clickId(page, 'icon-stats');
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

test('1920x jackpot: the flat win state (Jackpot pill, 1920.00x), no confetti or celebration overlay; gamble off above 30,000', async () => {
  const page = await fresh({ timeScale: 2 });
  await setup(page, { balance: 1000, bets: { 8: 1 }, history: [] });
  await force(page, 8);
  await dispatch(page, { type: 'START' });
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  await sleep(200);
  assert.match(await words(page, '#r-centre'), /^Jackpot Double Run · 1 in 25 1920\.00x You win 1,920 /);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.confetti, .celebrate, #r-fx').length), 0);
  await settle(page, 4000); // the rail count-up and audio un-duck end; no confetti or marquee loop keeps running
  assert.equal((await state(page)).phase, 'GAMBLE_OFFER');
  assert.equal(await attr(page, 'btn-gamble', 'aria-disabled'), null, '1,920 can be doubled');
  // 10 on #8 = 19,200: doubling would pass the 30,000 cap, so Gamble is off and the copy says why
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  await setup(page, { balance: 1000, bets: { 8: 10 }, history: [] });
  await playTo(page, 8);
  assert.equal(await attr(page, 'btn-gamble', 'aria-disabled'), 'true');
  assert.match(await text(page, '[data-id="btn-gamble"]'), /Doubling would go over the 30,000 cap/);
  assert.match(await text(page, '#r-centre'), /Collect it\. Gamble is off above 30,000 credits\./);
  assert.match(await text(page, '#r-centre .gband'), /Double or nothing\s*Doubling would go over the 30,000 cap\s*3 of 3 left/);
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

// ------------------------------------------------------------------ v3 frame and bottom bar (batch 2)
test('frame: centred rounded frame, 230 px rail + 1 px divider, game area, 40 px bottom bar; v2 header removed', async () => {
  for (const [w, h, fw, fh] of [[1920, 1080, 1600, 980], [1280, 720, 1248, 688]]) {
    const page = await fresh({ width: w, height: h });
    const g = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; };
      const cs = (s) => getComputedStyle(document.querySelector(s));
      return {
        frame: r('.frame'), rail: r('.frame-rail'), bar: r('.bbar'), controls: r('#r-controls .rail'), credits: r('.credits'), stage: r('#r-stage'),
        page: getComputedStyle(document.body).backgroundColor, frameBg: cs('.frame').backgroundColor, frameR: cs('.frame').borderTopLeftRadius,
        railBg: cs('.frame-rail').backgroundColor, divider: `${cs('.frame-rail').borderRightWidth} ${cs('.frame-rail').borderRightColor}`, barBg: cs('.frame-bar').backgroundColor,
        header: !!document.querySelector('#r-hdr, .header, .balance, .tagline'),
      };
    });
    assert.deepEqual([g.frame.width, g.frame.height], [fw, fh]);
    assert.deepEqual([g.frame.left, g.frame.top], [(w - fw) / 2, (h - fh) / 2], 'centred');
    assert.equal(g.frameR, '8px');
    assert.equal(g.page, 'rgb(15, 18, 22)', 'bg-page');
    assert.equal(g.frameBg, 'rgb(26, 31, 38)', 'bg-frame');
    assert.equal(g.railBg, 'rgb(28, 34, 42)', 'bg-rail');
    assert.equal(g.divider, '1px rgb(42, 49, 58)', 'divider');
    assert.equal(g.barBg, 'rgb(31, 38, 46)', 'bg-bottombar');
    assert.equal(g.rail.width, 231, 'rail 230 + 1 px divider');
    assert.deepEqual([g.controls.left, g.controls.width], [g.frame.left, 230], 'rail controls sit in the rail');
    assert.equal(g.stage.left, g.frame.left + 231, 'game area right of the divider');
    assert.deepEqual([g.bar.left, g.bar.width, g.bar.height, g.bar.bottom], [g.frame.left, fw, 40, g.frame.bottom]);
    assert.ok(g.credits.left >= g.rail.left && g.credits.right <= g.rail.right && g.credits.top < g.controls.top + 40, 'credits at the top of the rail');
    assert.equal(g.header, false, 'no v2 header bar or play-credits pill');
    assert.match(await text(page, '#r-credits'), /Credits\s*1,000/);
    await page.__done();
  }
});

test('bottom bar: sound, settings, stats left; title centre; fairness right; no star icon', async () => {
  const page = await fresh();
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.bbar');
    const ids = (s) => [...b.querySelectorAll(`${s} [data-id]`)].map((e) => e.dataset.id);
    return { left: ids('.bb-l'), right: ids('.bb-r'), centre: b.querySelector('.bb-c').textContent.replace(/\s+/g, ' ').trim(), all: b.querySelectorAll('button').length, html: b.innerHTML };
  });
  assert.deepEqual(bar.left, ['icon-sound', 'icon-settings', 'icon-stats']);
  assert.deepEqual(bar.right, ['icon-fair']);
  assert.equal(bar.all, 4);
  assert.equal(bar.centre, 'Running Light · Play credits only · No real money value');
  assert.doesNotMatch(bar.html, /star/i, 'no star icon');
  await page.__done();
});

test('bottom bar actions: sound toggles mute, settings opens Settings, stats opens Paytable/Help, Esc returns focus', async () => {
  const page = await fresh();
  assert.equal((await state(page)).settings.mute, false);
  await clickId(page, 'icon-sound');
  assert.equal((await state(page)).settings.mute, true);
  assert.equal(await attr(page, 'icon-sound', 'aria-checked'), 'false');
  await clickId(page, 'icon-sound');
  assert.equal((await state(page)).settings.mute, false);
  await clickId(page, 'icon-settings');
  assert.equal((await state(page)).info, 'settings');
  await page.keyboard.press('Escape');
  assert.equal((await state(page)).info, null);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'icon-settings');
  await clickId(page, 'icon-stats');
  assert.equal((await state(page)).info, 'paytable');
  assert.match(await text(page, '#r-modal'), /≈95\.45%/);
  await clickId(page, 'tab-help');
  assert.equal((await state(page)).info, 'help');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'icon-stats');
  await page.__done();
});

test('fairness panel: how results are decided (drawn first, 1/multiplier weights, RTP ~95.45%), no provably-fair claim; Esc/close', async () => {
  const page = await fresh();
  await clickId(page, 'icon-fair');
  const m = await text(page, '#r-modal');
  assert.match(m, /How results are decided/);
  assert.match(m, /drawn and saved on this device before the light starts/);
  assert.match(m, /1 ÷ what it pays: weights 80 \/ 20 \/ 4 \/ 2 \/ 1 of 2,093/);
  assert.match(m, /RTP about 95\.45%/);
  assert.match(m, /Double Run, 1 in 25/);
  assert.doesNotMatch(await page.evaluate(() => document.body.innerHTML), /provabl/i);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'f-close');
  assert.equal(await page.evaluate(() => document.getElementById('r-track').inert), true, 'board inert behind the panel');
  await page.keyboard.press('3'); // game keys are ignored while the panel is open
  assert.equal((await state(page)).chip, 1, 'chip key ignored');
  assert.match(await text(page, '#r-modal'), /How results are decided/, 'still open');
  await page.keyboard.press('Escape');
  assert.equal(await text(page, '#r-modal'), '');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'icon-fair');
  await clickId(page, 'icon-fair');
  await clickId(page, 'f-close');
  assert.equal(await text(page, '#r-modal'), '');
  await setup(page, { balance: 1000, bets: { 12: 1 }, history: [] });
  await playTo(page, 12);
  await clickId(page, 'icon-fair'); // locked while a win is uncollected
  assert.equal(await text(page, '#r-modal'), '');
  await page.__done();
});

// ------------------------------------------------------------------ v3 overlays and small screens (batch 6)
/** The open dialog's look, and every element in it that still has a shadow, filter, text shadow or gradient. */
const dialogLook = (page) => page.evaluate(() => {
  const d = document.querySelector('#r-modal .dlg');
  const cs = getComputedStyle(d);
  const sc = document.querySelector('#r-modal .scrim');
  const all = [d, ...d.querySelectorAll('*'), sc];
  const bad = all.filter((e) => { const c = getComputedStyle(e); return e !== document.activeElement && (c.boxShadow !== 'none' || c.filter !== 'none' || c.textShadow !== 'none' || /gradient/.test(c.backgroundImage)); }).map((e) => e.className);
  const r = (e) => e.getBoundingClientRect().toJSON();
  return {
    label: d.getAttribute('aria-label'), bg: cs.backgroundColor, border: `${cs.borderLeftWidth} ${cs.borderLeftColor}`, top: `${cs.borderTopWidth} ${cs.borderTopColor}`,
    radius: cs.borderBottomRightRadius, bad, scrimBg: getComputedStyle(sc).backgroundColor, scrim: r(sc), box: r(d), stage: r(document.getElementById('r-stage')),
    ring: document.querySelectorAll('.ring, .bunting, .bulb').length, inert: document.getElementById('r-track').inert,
  };
});
const FLAT = { bg: 'rgb(26, 31, 38)', border: '1px rgb(47, 55, 66)', radius: '8px', bad: [], scrimBg: 'rgba(15, 18, 22, 0.78)', ring: 0, inert: true };
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const textOf = (page, sel) => page.evaluate((s) => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);

test('overlays (refill.png, error.png, settings-paytable-help.png): flat bg-frame dialogs, 1 px border, flat scrim; no shadow, glow, gradient or bulb ring', async () => {
  const page = await fresh();
  // Game info at 1920: one window, three columns (Settings | Paytable | Help), header and footer
  await clickId(page, 'icon-settings');
  let d = await dialogLook(page);
  assert.deepEqual(pick(d, Object.keys(FLAT)), FLAT, 'game info');
  assert.equal(d.label, 'Game info');
  assert.deepEqual([d.scrim.width, d.scrim.height], [1920, 1080], 'scrim over the whole page');
  assert.ok(Math.abs(d.box.left + d.box.width / 2 - 960) <= 1 && d.box.width === 1180, 'centred, 1180 wide');
  const info = await page.evaluate(() => ({
    cols: [...document.querySelectorAll('#r-modal .icols .isec .ih')].map((e) => e.textContent),
    tablist: !!document.querySelector('#r-modal [role="tablist"]'),
    head: document.querySelector('#r-modal .ihead h2').textContent,
    foot: [...document.querySelectorAll('#r-modal .ifoot span')].map((e) => e.textContent),
    rows: [...document.querySelectorAll('#r-modal .ptab tr')].slice(1).map((tr) => [...tr.cells].map((c) => c.textContent)),
    toggle: getComputedStyle(document.querySelector('[data-id="tg-mute"]')).backgroundColor,
    focus: document.activeElement.dataset.id,
  }));
  assert.deepEqual(info.cols, ['Settings', 'Paytable', 'Help']);
  assert.equal(info.tablist, false, 'no tabs when all three sections fit');
  assert.equal(info.head, 'Running Light · Game info');
  assert.deepEqual(info.foot, ['Esc closes this window', 'Outcome is decided and saved before the light runs']);
  assert.deepEqual(info.rows[0], ['1920x', '1', '1 in 2,010', '8']);
  assert.deepEqual(info.rows[1], ['960x', '2', '1 in 1,005', '21, 46']);
  assert.equal(info.rows.length, 5);
  assert.equal(info.toggle, 'rgb(13, 110, 253)', 'Sound on: accent-blue switch');
  assert.equal(info.focus, 'tab-settings');
  await page.keyboard.press('ArrowRight'); // arrows still move between the sections (the engine's Info tab)
  assert.equal((await state(page)).info, 'paytable');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'tab-paytable');
  assert.deepEqual(await page.evaluate(() => { const e = document.querySelector('#r-modal .dlg'); return [e.classList.contains('still'), e.getAnimations().length]; }), [true, 0], 're-rendering the same dialog does not replay its entrance');
  await page.keyboard.press('Escape');
  // fairness panel: the same flat dialog
  await clickId(page, 'icon-fair');
  d = await dialogLook(page);
  assert.deepEqual(pick(d, Object.keys(FLAT)), FLAT, 'fairness');
  assert.equal(d.label, 'How results are decided');
  await page.keyboard.press('Escape');
  // refill: dims and centres on the game area only (the rail and bar stay lit, as in refill.png)
  await setup(page, { balance: 0, bets: {}, history: [] });
  await page.evaluate(() => window.__rl.app.render());
  d = await dialogLook(page);
  assert.deepEqual(pick(d, Object.keys(FLAT)), FLAT, 'refill');
  assert.equal(d.label, 'Out of play credits');
  assert.deepEqual([d.scrim.left, d.scrim.top, d.scrim.width, d.scrim.height], [d.stage.left, d.stage.top, d.stage.width, d.stage.height], 'scrim = game area');
  assert.ok(Math.abs(d.box.left + d.box.width / 2 - (d.stage.left + d.stage.width / 2)) <= 1 && d.box.width === 420, 'centred in the game area, 420 wide');
  assert.equal(await textOf(page, '#r-modal .dlg'), 'Out of play credits Take a free refill and keep playing. Refills are unlimited, with no waiting and no cost. Free refill 1,000 credits Refill 1,000 Free · Enter Play credits only. No real money value.');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-id="m-refill"]')).backgroundColor), 'rgb(13, 110, 253)', 'accent-blue Refill');
  await page.evaluate(() => window.__rl.app.focusId('m-refill'));
  await page.keyboard.press('Enter');
  await settle(page);
  // error: red top edge, the saved round on one mono line, Reload focused
  await setup(page, { balance: 1000, bets: { 12: 5 }, history: [] });
  await force(page, 30);
  await dispatch(page, { type: 'START' });
  await dispatch(page, { type: 'FAIL', message: 'storage setItem failed' });
  d = await dialogLook(page);
  assert.deepEqual(pick(d, Object.keys(FLAT)), FLAT, 'error');
  assert.equal(d.label, 'Something went wrong');
  assert.equal(d.top, '3px rgb(220, 38, 38)', 'accent-red top edge');
  const err = await page.evaluate(() => ({ code: document.querySelector('[data-role="error-code"]').textContent, font: getComputedStyle(document.querySelector('[data-role="error-code"]')).fontFamily, focus: document.activeElement.dataset.id }));
  assert.equal(err.code, 'Round in progress: bet 5 · 1 square · credits 995 · code E-STORAGE-WRITE');
  assert.match(err.font, /^"JetBrains Mono"/);
  assert.equal(err.focus, 'm-reload');
  assert.match(await textOf(page, '#r-modal'), /reloading won’t change the outcome or charge you again\. .* Reload Restores your round · Enter Play credits only\. No real money value\.$/);
  await page.__done();
});

test('Game info on smaller screens: tabs at 1280x720 and 1024x768, a bottom sheet at 768x1024; inside the viewport', async () => {
  for (const [w, h] of [[1280, 720], [1024, 768], [768, 1024]]) {
    const page = await fresh({ width: w, height: h, touch: w < 900 });
    await clickId(page, 'icon-stats');
    await sleep(250); // the 160 ms entrance (4 px rise) has ended
    const g = () => page.evaluate(() => {
      const d = document.querySelector('#r-modal .dlg').getBoundingClientRect();
      return { d: [d.left, d.top, d.right, d.bottom].map(Math.round), tabs: [...document.querySelectorAll('#r-modal [role="tab"]')].map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`), secs: document.querySelectorAll('#r-modal .isec').length, scroll: document.documentElement.scrollWidth };
    });
    let r = await g();
    assert.deepEqual(r.tabs, ['Settings:false', 'Paytable:true', 'Help:false'], `${w}: tabs`);
    assert.equal(r.secs, 1, `${w}: one section at a time`);
    assert.ok(r.d[0] >= 0 && r.d[1] >= 0 && r.d[2] <= w && r.d[3] <= h && r.scroll <= w, `${w}: dialog inside the viewport ${r.d}`);
    if (w === 768) assert.deepEqual([r.d[0], r.d[2], r.d[3]], [0, 768, 1024], 'tablet portrait: a full-width bottom sheet');
    await clickId(page, 'tab-help');
    assert.equal((await state(page)).info, 'help');
    assert.match(await text(page, '#r-modal [data-role="help-gamble"]'), /fair 50\/50/);
    r = await g();
    assert.ok(r.d[1] >= 0 && r.d[3] <= h, `${w}: help inside the viewport`);
    await page.__done();
  }
});

test('Help explains the gamble the way the engine plays it (fair 50/50 drawn and saved on Gamble, ×2 or lose the win, max 3, 30,000 cap)', async () => {
  const page = await fresh();
  await clickId(page, 'icon-stats');
  const g = await textOf(page, '#r-modal [data-role="help-gamble"]');
  assert.equal(g, [
    'After a win, press Gamble ×2, pick red or white, then press Gamble on your colour.',
    'Red or white is drawn at that moment, a fair 50/50, and saved before the disc flips.',
    'Match: your win doubles. Gamble again or Collect. No match: the win is lost. Nothing else is taken.',
    `Up to ${MAX_GAMBLES} gambles per win, and Collect is open between flips. Gamble is off when doubling would go over ${GAMBLE_CAP.toLocaleString('en-US')}.`,
  ].join(' '));
  const all = await textOf(page, '#r-modal');
  assert.doesNotMatch(all, /gamble window/i, 'no "gamble window" (there is none since batch 5)');
  assert.match(all, /Gamble: fair 50\/50 on red or white, up to 3 times per win\. Off when doubling would go over 30,000\./, 'paytable gamble line');
  assert.match(all, /R \/ W ← → Pick red \/ white/, 'keys: the pick, not a window');
  // the copy matches play: the draw is stored when Gamble is pressed, a match doubles, the cap stops a 4th or a >30,000 double
  await page.keyboard.press('Escape');
  await setup(page, { balance: 1000, bets: { 13: 5 }, history: [] });
  await playTo(page, 13); // 480x: 2,400
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'red' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  const stored = await state(page);
  assert.deepEqual([stored.round.gambles, stored.round.pendingReveal, stored.round.currentWin], [[{ pick: 'red', result: 'red' }], true, 2400], 'drawn and saved before the flip shows it');
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing);
  assert.equal((await state(page)).round.currentWin, 4800, 'match doubles');
  await settle(page);
  await dispatch(page, { type: 'PICK', colour: 'white' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing);
  await settle(page);
  assert.equal((await state(page)).round.currentWin, 9600);
  await dispatch(page, { type: 'PICK', colour: 'red' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  assert.equal((await dispatch(page, { type: 'GAMBLE_FLIP' })).ok, true, 'a third gamble (9,600 -> 19,200, under the cap)');
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing);
  await settle(page);
  assert.equal((await state(page)).round.currentWin, 19200);
  await dispatch(page, { type: 'PICK', colour: 'red' });
  assert.equal((await dispatch(page, { type: 'GAMBLE_FLIP' })).ok, false, 'no fourth gamble');
  assert.match(await textOf(page, '#r-centre .gmsg'), /^No gambles left for this win\. Collect your win\.$/);
  await page.__done();
});

test('start and loading screens: flat v3 mark and plain controls; no bulb ring, glow or ticker re-render', async () => {
  const page = await fresh({ startScreen: true });
  const look = (sel) => page.evaluate((s) => {
    const root = document.querySelector(s);
    const bad = [...root.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return e !== document.activeElement && (c.boxShadow !== 'none' || c.filter !== 'none' || c.textShadow !== 'none' || /gradient/.test(c.backgroundImage)); }).map((e) => e.className);
    return { bad, ring: root.querySelectorAll('.ring, .bunting, i.on').length, mark: root.querySelectorAll('svg.mark').length, h1: getComputedStyle(root.querySelector('h1')).fontFamily, text: root.innerText.replace(/\s+/g, ' ').trim() };
  }, sel);
  const st = await look('#r-start');
  assert.deepEqual([st.bad, st.ring, st.mark], [[], 0, 1]);
  assert.match(st.h1, /^Poppins/);
  assert.equal(st.text, 'Running Light Bet play credits on a 50-square track. The light runs, slows and stops on one square. Credits 1,000 Play Turns sound on · Enter How to play Sound: on Play credits only · No real money value · Free refill to 1,000');
  const before = await page.evaluate(() => document.getElementById('r-start').innerHTML);
  await sleep(500);
  assert.equal(await page.evaluate(() => document.getElementById('r-start').innerHTML), before, 'no ticker: the start screen is not re-rendered');
  assert.equal(await page.evaluate(() => window.__rl.app.pendingTasks()), 0, 'no animation tasks');
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__rlShowLoading(0.5, 3, 'Loading sounds…'));
  const ld = await look('#loading');
  assert.deepEqual([ld.bad, ld.ring, ld.mark], [[], 0, 1]);
  assert.match(ld.h1, /^Poppins/, 'not the mono big-number font');
  assert.equal(ld.text, 'Running Light Loading sounds… 50% Play credits only · No real money value');
  assert.equal(await page.evaluate(() => [document.querySelector('#loading .lbar i').style.width, document.getElementById('loading').getAttribute('aria-valuenow')].join()), '50%,50');
  await page.__done();
});

// ------------------------------------------------------------------ v3 rail controls (batch 3)
const railText = (page, role) => text(page, `#r-controls [data-role="${role}"]`);
const even = (n, v) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, v]));

test('bet field shows the TOTAL bet across all squares, with squares and the 200 round limit', async () => {
  const page = await fresh();
  assert.equal(await railText(page, 'total'), '0');
  assert.match(await railText(page, 'bet-hint'), /^1–10 per square · 200 per round$/); // refill.png wording (fits the 1920 rail)
  await clickId(page, 'chip-5');
  await clickId(page, 'sq-3');
  await clickId(page, 'sq-12');
  await clickId(page, 'chip-1');
  await clickId(page, 'sq-8');
  assert.deepEqual(await bets(page), { 3: 5, 8: 1, 12: 5 });
  assert.equal(await railText(page, 'total'), '11', 'sum of all squares, not the chip');
  assert.match(await railText(page, 'bet-hint'), /^3 squares · 11 \/ 200 per round$/);
  assert.match(await text(page, '[data-id="btn-start"]'), /Start\s*11 credits on 3 squares/);
  assert.match(await text(page, '#r-credits'), /Credits\s*1,000/);
  await setup(page, { balance: 1000, bets: even(20, 10), chip: 1 });
  assert.equal(await railText(page, 'total'), '200');
  assert.match(await railText(page, 'bet-hint'), /20 squares · 200 \/ 200 per round/);
  await page.__done();
});

test('x2 doubles every square, clamped to 10 per square, 200 per round and the balance (toasts); 1/2 halves (min 1); one Undo step each', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 1: 6, 2: 3, 5: 1 }, chip: 1, history: [] });
  assert.equal(await railText(page, 'total'), '10');
  await clickId(page, 'btn-double');
  assert.deepEqual(await bets(page), { 1: 10, 2: 6, 5: 2 }, 'square 1 capped at 10');
  assert.equal(await railText(page, 'total'), '18');
  assert.match(await toastText(page), /Max bet reached – 10 per square/);
  await clickId(page, 'btn-half');
  assert.deepEqual(await bets(page), { 1: 5, 2: 3, 5: 1 }, 'halved, rounded down, min 1');
  assert.equal(await railText(page, 'total'), '9');
  await page.keyboard.press('z');
  assert.deepEqual(await bets(page), { 1: 10, 2: 6, 5: 2 }, 'Undo reverts one scale step');
  await page.keyboard.press('z');
  assert.deepEqual(await bets(page), { 1: 6, 2: 3, 5: 1 });
  // round cap: 30 squares x 5 = 150 -> 200, shared evenly
  await setup(page, { balance: 1000, bets: even(30, 5), chip: 1 });
  await page.evaluate(() => { window.__rl.app.ui.toast = null; });
  await clickId(page, 'btn-double');
  const b = await bets(page);
  assert.equal(Object.values(b).reduce((a, x) => a + x, 0), 200);
  assert.ok(Object.values(b).every((x) => x === 6 || x === 7), 'even split');
  assert.equal(await railText(page, 'total'), '200');
  assert.match(await toastText(page), /Round limit reached – 200 per round/);
  assert.equal(await attr(page, 'btn-double', 'aria-disabled'), 'true', 'x2 off at the round cap');
  // balance cap
  await setup(page, { balance: 25, bets: { 1: 5, 2: 5, 3: 5 }, chip: 1 });
  await clickId(page, 'btn-double');
  assert.equal(await railText(page, 'total'), '25');
  assert.match(await toastText(page), /Not enough credits/);
  // nothing to do -> disabled
  await setup(page, { balance: 1000, bets: { 4: 1, 9: 1 }, chip: 1 });
  assert.equal(await attr(page, 'btn-half', 'aria-disabled'), 'true', '1/2 off when every square is at 1');
  await setup(page, { balance: 1000, bets: {}, chip: 1 });
  assert.equal(await attr(page, 'btn-double', 'aria-disabled'), 'true', 'x2 off with no bets');
  assert.equal(await attr(page, 'btn-half', 'aria-disabled'), 'true', '1/2 off with no bets');
  // the scaled bets are what START plays
  await setup(page, { balance: 1000, bets: { 12: 2, 3: 1 }, chip: 1, history: [] });
  await clickId(page, 'btn-double');
  await playTo(page, 27, null, 'BETTING');
  const s = await state(page);
  assert.deepEqual(s.round.bets, { 3: 2, 12: 4 });
  assert.equal(s.balance, 994);
  await page.__done();
});

test('last bets (top row, right of "Last results"): each round shows its TOTAL bet, newest first; none in the rail', async () => {
  const page = await fresh();
  assert.match(await text(page, '#r-top [data-role="last-bets"]'), /Last bets:\s*None yet/);
  assert.equal(await page.evaluate(() => document.querySelector('#r-controls [data-role="last-bets"]')), null, 'moved out of the rail');
  await setup(page, { balance: 1000, bets: { 12: 5, 3: 1 }, chip: 1, history: [] });
  await playTo(page, 27, null, 'BETTING'); // loss: bets stay on the board
  await clickId(page, 'btn-double');
  await playTo(page, 27, null, 'BETTING');
  const lbs = await page.evaluate(() => [...document.querySelectorAll('#r-top [data-role="last-bets"] .lb')].map((e) => [e.textContent, e.classList.contains('new')]));
  assert.deepEqual(lbs, [['12', true], ['6', false]]);
  assert.match(await page.evaluate(() => document.querySelector('[data-role="last-bets"]').getAttribute('aria-label')), /newest first: 12, 6/);
  await page.__done();
});

test('rail look (1920): flat token colours, blue Start, green Collect with dark text, blue Gamble; token sizes; no shadows', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5, history: [] });
  const look = await page.evaluate(() => {
    const cs = (id) => getComputedStyle(document.querySelector(`[data-id="${id}"]`));
    const h = (sel) => document.querySelector(sel).getBoundingClientRect().height;
    const shadows = [...document.querySelectorAll('#r-controls *, #r-controls .chip')].flatMap((e) => [getComputedStyle(e), getComputedStyle(e, '::after')]).filter((s) => s.boxShadow !== 'none' || s.textShadow !== 'none' || s.filter !== 'none').length;
    return {
      start: [cs('btn-start').backgroundColor, cs('btn-start').color], input: h('.betin'), main: h('[data-id="btn-start"]'), act: h('[data-id="btn-undo"]'), chip: h('[data-id="chip-5"]'),
      sel: getComputedStyle(document.querySelector('[data-id="chip-5"]'), '::after').borderTopColor, shadows,
    };
  });
  assert.deepEqual(look.start, ['rgb(13, 110, 253)', 'rgb(255, 255, 255)'], 'Start: accent-blue, white text');
  assert.deepEqual([look.input, look.main, look.act, look.chip], [40, 52, 32, 34]);
  assert.equal(look.sel, 'rgb(255, 255, 255)', 'selected chip: white ring');
  assert.equal(look.shadows, 0, 'no box/text shadows or filters in the rail');
  await playTo(page, 12);
  const win = await page.evaluate(() => {
    const cs = (id) => getComputedStyle(document.querySelector(`[data-id="${id}"]`));
    return { collect: [cs('btn-collect').backgroundColor, cs('btn-collect').color], gamble: cs('btn-gamble').backgroundColor };
  });
  assert.deepEqual(win.collect, ['rgb(22, 163, 74)', 'rgb(6, 33, 15)'], 'Collect: accent-green, dark text');
  assert.equal(win.gamble, 'rgb(13, 110, 253)');
  assert.match(await text(page, '[data-id="btn-collect"]'), /Collect 480/);
  assert.match(await text(page, '[data-id="btn-gamble"]'), /Fair 50\/50 · 3 of 3 left/);
  await page.__done();
});

// ------------------------------------------------------------------ v3 track and centre display (batch 4)
/** In-page probe: records every DOM mutation in the game regions (one batch per MutationObserver callback, i.e.
 *  per animation frame) with the lit square and the big number at that moment, and counts layout reads
 *  (getBoundingClientRect, offset*, client*, scroll*, getComputedStyle, ...) while it is on. */
async function installRunProbe(page) {
  await page.evaluate(() => {
    const P = window.__probe = { on: false, reads: {}, batches: [] };
    const count = (name) => { if (P.on) P.reads[name] = (P.reads[name] || 0) + 1; };
    for (const m of ['getBoundingClientRect', 'getClientRects', 'scrollIntoView']) {
      const orig = Element.prototype[m];
      Element.prototype[m] = function (...a) { count(m); return orig.apply(this, a); };
    }
    for (const p of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'clientWidth', 'clientHeight', 'clientTop', 'clientLeft', 'scrollWidth', 'scrollHeight', 'scrollTop', 'scrollLeft', 'innerText']) {
      const proto = p in HTMLElement.prototype && Object.getOwnPropertyDescriptor(HTMLElement.prototype, p) ? HTMLElement.prototype : Element.prototype;
      const d = Object.getOwnPropertyDescriptor(proto, p);
      Object.defineProperty(proto, p, { ...d, get() { count(p); return d.get.call(this); } });
    }
    const gcs = window.getComputedStyle;
    window.getComputedStyle = (...a) => { count('getComputedStyle'); return gcs(...a); };
    const what = (n) => (n.nodeType === 3 ? n.parentElement : n);
    const mo = new MutationObserver((recs) => {
      if (!P.on) return;
      const lit = document.querySelector('#r-track .tile.lit, #r-track .tile.lit2');
      P.batches.push({
        lit: lit ? lit.dataset.id : null, litMult: lit ? lit.querySelector('.m').textContent : null,
        big: document.querySelector('[data-role="big"]').textContent,
        recs: recs.map((r) => {
          const el = what(r.target);
          return { type: r.type, attr: r.attributeName, region: el.closest('[id^="r-"]').id, tile: el.classList.contains('tile') ? el.dataset.id : null, role: el.dataset.role || null, cls: el.className };
        }),
      });
    });
    for (const id of ['r-track', 'r-centre', 'r-top', 'r-controls', 'r-frame', 'r-bar']) mo.observe(document.getElementById(id), { subtree: true, attributes: true, childList: true, characterData: true });
  });
}

test('centre: the big mono number is the multiplier (00.00x idle; the square under the light while running; then the stop)', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 30: 1, 8: 1 }, history: [] });
  const idle = await page.evaluate(() => {
    const b = document.querySelector('#r-centre .big');
    const cs = getComputedStyle(b);
    return { text: b.textContent, font: cs.fontFamily, size: cs.fontSize, color: cs.color, contain: cs.contain };
  });
  assert.equal(idle.text, '00.00x');
  assert.match(idle.font, /^"JetBrains Mono"/);
  assert.deepEqual([idle.size, idle.color, idle.contain], ['88px', 'rgb(106, 116, 128)', 'strict'], 'big-number 88 px, #6a7480, contained');
  assert.match((await text(page, '#r-centre')).replace(/\s+/g, ' '), /Betting open ?Double Run · 1 in 25 ?00\.00x ?Place your bets ?Pick a chip, tap squares, then press Start\. ?24x ?21 squares.*1920x ?1 square/);
  await installRunProbe(page);
  await force(page, 30);
  await page.evaluate(() => { window.__probe.on = true; });
  await dispatch(page, { type: 'START' });
  await waitPhase(page, ['RESOLVING', 'GAMBLE_OFFER']);
  const P = await page.evaluate(() => { window.__probe.on = false; return window.__probe; });
  const running = P.batches.filter((b) => b.lit);
  assert.ok(running.length > 30, `sampled ${running.length} frames`);
  for (const b of running) assert.equal(`${b.big}x`, `${b.litMult.replace('x', '').padStart(2, '0')}.00x`, `${b.lit}: big ${b.big} vs ${b.litMult}`);
  assert.match(await text(page, '#r-centre'), /Running|You win/);
  await settle(page);
  assert.equal(await text(page, '#r-centre .big'), '96.00x', 'stopped on #30 (96x)');
  await page.__done();
});

test('light run: each step changes only tile classes (<= 4 tiles) and the big number text; no layout reads; flat lit / trail look', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: { 12: 1, 30: 2 }, history: [] });
  await installRunProbe(page);
  await force(page, 30);
  await page.evaluate(() => { window.__probe.on = true; });
  await dispatch(page, { type: 'START' });
  // mid-run look: lit = tile-lit fill with dark text, trail = white ::before overlay by opacity, no glow, no veil
  await page.waitForFunction(() => document.querySelector('#r-track .tile.trail2'), { timeout: 5000 });
  const look = await page.evaluate(() => {
    window.__probe.on = false; // our own getComputedStyle calls below are not the app's
    const cs = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo);
    const lit = cs('#r-track .tile.lit');
    const out = {
      lit: [lit.backgroundColor, lit.color, lit.boxShadow], litM: cs('#r-track .tile.lit .m').color,
      t1: cs('#r-track .tile.trail1', '::before').opacity,
      t2: [cs('#r-track .tile.trail2', '::before').transitionProperty, cs('#r-track .tile.trail2', '::before').transitionDuration],
      veils: document.querySelectorAll('#r-track .veil, #r-track .lock').length,
      shadows: [...document.querySelectorAll('#r-track .tile')].filter((t) => getComputedStyle(t).boxShadow !== 'none' || getComputedStyle(t).filter !== 'none').length,
    };
    window.__probe.on = true;
    return out;
  });
  assert.deepEqual(look.lit, ['rgb(233, 238, 243)', 'rgb(15, 18, 22)', 'none'], 'lit: #e9eef3, dark text, no glow');
  assert.equal(look.litM, 'rgb(15, 18, 22)');
  assert.equal(look.t1, '0.34', 'trail step 1: white overlay at .34, instant');
  assert.deepEqual(look.t2, ['opacity', '0.12s'], 'trail step 2 fades by opacity only, 120 ms');
  assert.equal(look.veils, 0, 'no lock veil while running');
  assert.equal(look.shadows, 0);
  await waitPhase(page, ['RESOLVING', 'GAMBLE_OFFER']);
  const P = await page.evaluate(() => { window.__probe.on = false; return window.__probe; });
  // only the frames of the light run itself (START's one-off rail/centre re-render comes before the first lit frame)
  const first = P.batches.findIndex((b) => b.lit);
  const run = P.batches.slice(first);
  assert.ok(run.length > 30);
  const recs = run.flatMap((b) => b.recs);
  const bad = recs.filter((r) => !((r.region === 'r-track' && r.type === 'attributes' && r.attr === 'class' && r.tile) || (r.region === 'r-centre' && r.role === 'big' && r.type === 'childList')));
  assert.deepEqual(bad.slice(0, 5), [], 'a light step only swaps tile classes and the big number text');
  const perFrame = run.map((b) => new Set(b.recs.filter((r) => r.tile).map((r) => r.tile)).size);
  assert.ok(Math.max(...perFrame) <= 6, `tiles changed per frame: max ${Math.max(...perFrame)}`);
  assert.ok(perFrame.filter((n) => n > 4).length <= 2, `frames over 4 tiles: ${perFrame.filter((n) => n > 4).length} (only when one 60 Hz frame covers two squares)`);
  assert.ok(Math.max(...run.map((b) => b.recs.filter((r) => r.role === 'big').length)) <= 1, 'big number written at most once per frame');
  assert.deepEqual(P.reads, {}, 'no layout reads while the light runs');
  // the landing square: lit + land on the stored stop
  const landed = await page.evaluate(() => [...document.querySelectorAll('#r-track .tile.land')].map((e) => e.dataset.id));
  assert.ok(landed.length <= 1 && (landed.length === 0 || landed[0] === 'sq-30'), `landing ${landed}`);
  await page.__done();
});

test('top row: "Last results:" newest first (tier colours, newest outlined) and "Last bets:" right; tiles flat with tier colours and blue bet badges', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: { 8: 1, 21: 2, 3: 2 }, history: [1, 2, 3, 8] });
  const top = await page.evaluate(() => {
    const t = document.querySelector('#r-top .toprow');
    const res = [...t.querySelectorAll('[data-role="history"] .tp')].map((e) => [e.textContent, e.classList.contains('new')]);
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { res, lr: r('#r-top [data-role="history"]').left < r('#r-top [data-role="last-bets"]').left, above: r('#r-top .toprow').bottom <= r('[data-id="sq-1"]').top };
  });
  assert.deepEqual(top.res, [['1920x', true], ['480x', false], ['96x', false], ['24x', false]]);
  assert.ok(top.lr && top.above, 'results left, bets right, above the track');
  const tiles = await page.evaluate(() => {
    const cs = (s) => getComputedStyle(document.querySelector(s));
    return {
      t1920: [cs('[data-id="sq-8"]').backgroundColor, cs('[data-id="sq-8"] .m').color], t960: cs('[data-id="sq-21"] .m').color, t24: cs('[data-id="sq-1"] .m').color,
      t96: cs('[data-id="sq-2"] .m').color, badge: [cs('[data-id="sq-21"] .bet').backgroundColor, cs('[data-id="sq-21"] .bet').color, cs('[data-id="sq-21"] .bet').height],
      num: cs('[data-id="sq-1"] .num').display, size: document.querySelector('[data-id="sq-1"]').getBoundingClientRect().width,
    };
  });
  assert.deepEqual(tiles.t1920, ['rgb(20, 41, 74)', 'rgb(255, 255, 255)'], '1920x: navy tile, white label');
  assert.equal(tiles.t960, 'rgb(110, 168, 254)');
  assert.equal(tiles.t24, 'rgb(138, 148, 160)');
  assert.equal(tiles.t96, 'rgb(195, 202, 210)');
  assert.deepEqual(tiles.badge, ['rgb(13, 110, 253)', 'rgb(255, 255, 255)', '18px'], 'bet badge: accent-blue, 18 px');
  assert.deepEqual([tiles.num, tiles.size], ['block', 64], '64 px tiles with square numbers at 1920x1080');
  await page.__done();
});

// ------------------------------------------------------------------ v3 result states (batch 5)
const MOCK_BETS = { 3: 2, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5 }; // the mockups' 20 credits on 6 squares
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const words = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText.replace(/\s+/g, ' ').trim(), sel);
/** Computed look of a tile (and its badge / marker) by square number. */
const tileStyle = (page, n) => page.evaluate((i) => {
  const t = document.querySelector(`[data-id="sq-${i}"]`);
  const cs = getComputedStyle(t);
  const b = t.querySelector('.bet');
  return { cls: t.className, bg: cs.backgroundColor, color: cs.color, m: getComputedStyle(t.querySelector('.m')).color, badge: b ? getComputedStyle(b).backgroundColor : null, mark: t.querySelector('.mkt')?.textContent || null, num: getComputedStyle(t.querySelector('.num')).display };
}, n);
const centreLook = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(`#r-centre ${s}`);
  return {
    pills: [...document.querySelectorAll('#r-centre .cp')].map((p) => [p.textContent, getComputedStyle(p).color, getComputedStyle(p).backgroundColor]),
    big: q('.big')?.textContent ?? null, bigColor: q('.big') ? getComputedStyle(q('.big')).color : null, big2: q('.big2')?.textContent ?? null,
    on: [...document.querySelectorAll('#r-centre .pay.on b')].map((b) => [b.textContent, getComputedStyle(b).backgroundColor, getComputedStyle(b).color]),
    cards: [...document.querySelectorAll('#r-centre .card')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
    band: q('.gband') ? q('.gband').innerText.replace(/\s+/g, ' ').trim() : null, bandBg: q('.gband') ? getComputedStyle(q('.gband')).backgroundColor : null,
  };
});
const GREEN = 'rgb(22, 163, 74)', ON_GREEN = 'rgb(6, 33, 15)';

test('result: win + gamble offer (win-gamble-offer.png): light 480.00x, green stop and pays pill, result card, navy band, Collect / Gamble ×2', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: MOCK_BETS, chip: 5, history: [] });
  await playTo(page, 13);
  const c = await centreLook(page);
  assert.deepEqual(c.pills.map((p) => p[0]), ['Win', 'Double Run · 1 in 25']);
  assert.equal(c.pills[0][1], 'rgb(74, 222, 128)', 'Win pill: green text');
  assert.deepEqual([c.big, c.bigColor, c.big2], ['480.00x', 'rgb(230, 234, 238)', null], 'the multiplier stays the big number, light when won');
  assert.match((await words(page, '#r-centre .ctxt')), /^You win 2,400 Collect it, or gamble it on a fair 50\/50\.$/);
  assert.deepEqual(c.on, [['480x', GREEN, ON_GREEN]], 'only the won tier is green');
  assert.deepEqual(c.cards, ['#13 480x Bet × pays 5 × 480 = 2,400']);
  assert.equal(c.band, 'Double or nothing Fair 50/50 · Win → 4,800 · Lose → 0 3 of 3 left');
  assert.equal(c.bandBg, 'rgb(20, 41, 74)', 'navy band');
  const t = await tileStyle(page, 13);
  assert.deepEqual([t.bg, t.color, t.m, t.badge, t.mark], [GREEN, ON_GREEN, ON_GREEN, 'rgb(15, 18, 22)', null], 'win stop: flat green, dark text, dark badge');
  assert.match(await attr(page, 'sq-13', 'aria-label'), /winning stop$/);
  const other = await tileStyle(page, 3);
  assert.deepEqual([other.bg, other.cls.includes('veil')], ['rgb(35, 42, 51)', false], 'other squares keep their look (no veil)');
  // rail: note above the Collect (green) / Gamble ×2 (blue) stack; Undo / Clear / Rebet hidden until settled
  const rail = await page.evaluate(() => [...document.querySelectorAll('#r-controls .rnote, #r-controls .mains .btn, #r-controls .acts')].map((e) => e.dataset.id || e.className));
  assert.deepEqual(rail, ['rnote', 'btn-collect', 'btn-gamble']);
  assert.equal((await words(page, '#r-controls .rnote')), 'Uncollected win 2,400');
  assert.match((await words(page, '[data-id="btn-collect"]')), /^Collect 2,400 Add to credits · Enter$/);
  assert.match((await words(page, '[data-id="btn-gamble"]')), /^Gamble ×2 Fair 50\/50 · 3 of 3 left · G$/);
  await page.__done();
});

test('result: gamble flip (gamble-flip.png): navy panel in the centre, one 700 ms rotateY disc, centre rebuilt only at start/end; flip win doubles', async () => {
  const page = await fresh({ timeScale: 1 });
  await setup(page, { balance: 1000, bets: MOCK_BETS, chip: 5, history: [] });
  await playTo(page, 13);
  await page.evaluate(() => { window.__rl.app.ui.displayWin = null; });
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'white' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('white'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  await page.waitForFunction(() => window.__rl.game.state.round.gambles.length === 1 && !window.__rl.game.state.gamble.revealing);
  await settle(page);
  assert.equal((await state(page)).round.currentWin, 4800, 'flip win doubles 2,400 -> 4,800');
  assert.match((await words(page, '#r-centre')), /Match! White lit\. Your win is now 4,800\. Gamble again or collect\./);
  assert.equal(await page.evaluate(() => document.querySelector('#r-centre .flip').className), 'flip w', 'disc rests on the result');
  // flip 2 at real speed: watch the centre region while the stored result is revealed
  await page.evaluate(() => {
    window.__rl.app.ui.displayWin = null;
    const P = window.__flipProbe = { rewrites: 0, on: true };
    new MutationObserver((recs) => { if (P.on && recs.some((r) => r.type === 'childList' && r.target.id === 'r-centre')) P.rewrites += 1; }).observe(document.getElementById('r-centre'), { childList: true });
  });
  await dispatch(page, { type: 'PICK', colour: 'red' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  const mid = await page.evaluate(() => {
    const coin = document.querySelector('#r-centre .flip.go .coin');
    const a = coin ? coin.getAnimations()[0] : null;
    const cs = coin ? getComputedStyle(coin) : null;
    const q = (s) => document.querySelector(s);
    return {
      anim: a ? [a.animationName, a.effect.getTiming().duration] : null, will: cs && cs.willChange,
      head: q('#r-centre .ghead').innerText.replace(/\s+/g, ' ').trim(), pills: [...document.querySelectorAll('#r-centre .cp')].map((p) => p.textContent),
      msg: q('#r-centre .gmsg').textContent, cards: [...document.querySelectorAll('#r-centre .gc')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
      recap: q('#r-centre .grec').textContent, note: q('#r-centre .gnote').textContent,
      sel: [...document.querySelectorAll('#r-centre .pick')].map((p) => [p.dataset.id, p.getAttribute('aria-checked'), p.innerText.replace(/\s+/g, ' ').trim()]),
      flipBtn: [q('[data-id="btn-flip"]').innerText.replace(/\s+/g, ' ').trim(), q('[data-id="btn-flip"]').getAttribute('aria-disabled')],
      collect: [q('[data-id="btn-collect"]').innerText.replace(/\s+/g, ' ').trim(), q('[data-id="btn-collect"]').getAttribute('aria-disabled'), getComputedStyle(q('[data-id="btn-collect"]')).backgroundColor],
      note2: q('#r-controls .rnote').innerText.replace(/\s+/g, ' ').trim(), big: q('#r-centre .big'), panel: getComputedStyle(q('#r-centre .gpanel')).backgroundColor,
    };
  });
  assert.deepEqual(mid.anim, ['flipr', 700], 'one disc, 700 ms, ending on the stored (red) face');
  assert.equal(mid.will, 'transform', 'will-change only while it flips');
  assert.equal(mid.head, 'Double or nothing · flip 2 2 of 3 left');
  assert.deepEqual(mid.pills, ['Gamble', '#13 · 480x · won 2,400']);
  assert.equal(mid.msg, 'Flipping… If red lights, your win doubles.');
  assert.deepEqual(mid.cards, ['Current win 4,800', 'Red lights 9,600', 'White lights 0']);
  assert.equal(mid.recap, 'Flip 1: you picked White · White lit · 2,400 → 4,800');
  assert.equal(mid.note, 'Gamble is turned off when doubling would go over 30,000 credits.');
  assert.deepEqual(mid.sel, [['pick-red', 'true', 'Red Your pick'], ['pick-white', 'false', 'White key W / →']]);
  assert.deepEqual(mid.flipBtn, ['Flipping… Red · 4,800 → 9,600 or 0', 'true']);
  assert.deepEqual(mid.collect, ['Collect 4,800 After the flip · Enter', 'true', 'rgba(0, 0, 0, 0)'], 'Collect locked (outline) during the flip');
  assert.equal(mid.note2, 'In gamble 4,800 · not collected');
  assert.equal(mid.big, null, 'no big number in the gamble');
  assert.equal(mid.panel, 'rgb(20, 41, 74)');
  await page.waitForFunction(() => window.__rl.game.state.round.gambles.length === 2 && !window.__rl.game.state.gamble.revealing);
  const rewrites = await page.evaluate(() => { window.__flipProbe.on = false; return window.__flipProbe.rewrites; });
  assert.ok(rewrites <= 4, `centre rebuilt ${rewrites} times for one flip (start, rest, result)`);
  assert.equal((await state(page)).round.currentWin, 9600);
  assert.match(await text(page, '#r-centre .gmsg'), /Match! Red lit\. Your win is now 9,600\./);
  await page.__done();
});

test('result: loss (loss.png): No win pill, 00.00x grey, light stop tile that keeps its look on hover, "No bet there" card', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: MOCK_BETS, chip: 5, history: [] });
  await playTo(page, 26, null, 'BETTING');
  const c = await centreLook(page);
  assert.deepEqual(c.pills.map((p) => p[0]), ['No win', 'Double Run · 1 in 25']);
  assert.equal(c.pills[0][1], 'rgb(248, 113, 113)', 'No win: red text');
  assert.deepEqual([c.big, c.bigColor], ['00.00x', 'rgb(106, 116, 128)'], 'loss: 00.00x in the idle grey');
  assert.equal((await words(page, '#r-centre .ctxt')), 'No win this time The light stopped on #26 (24x). Your bets are still on the board. Press Start to play them again.');
  assert.deepEqual(c.on, [], 'no pays pill lit');
  assert.deepEqual(c.cards, ['#26 24x Your bet No bet there']);
  assert.equal(c.band, null);
  const t = await tileStyle(page, 26);
  assert.deepEqual([t.bg, t.m], ['rgb(233, 238, 243)', 'rgb(15, 18, 22)'], 'loss stop: tile-lit fill, dark text');
  const p = await centerOf(page, 'sq-26');
  await page.mouse.move(p.x, p.y);
  await sleep(100);
  assert.equal((await tileStyle(page, 26)).bg, 'rgb(233, 238, 243)', 'hover keeps the lit look');
  assert.deepEqual(await bets(page), MOCK_BETS, 'bets stay on the board');
  assert.match((await words(page, '[data-id="btn-start"]')), /^Start 20 credits on 6 squares · Space$/, 'Start wording unchanged');
  await page.__done();
});

test('result: Double Run (double-run-result.png): "960.00x + 24.00x", both stops green with 1st / 2nd, two cards, both tiers lit', async () => {
  const page = await fresh();
  await setup(page, { balance: 1000, bets: MOCK_BETS, chip: 5, history: [] });
  await playTo(page, 21, 33);
  const c = await centreLook(page);
  assert.deepEqual(c.pills.map((p) => p[0]), ['Double Run win', 'Double Run on']);
  assert.deepEqual([c.pills[0][1], c.pills[1][2]], ['rgb(74, 222, 128)', 'rgb(13, 110, 253)']);
  assert.deepEqual([c.big, c.bigColor, c.big2], ['960.00x', 'rgb(230, 234, 238)', '+ 24.00x']);
  assert.equal((await words(page, '#r-centre .ctxt')), 'You win 2,040 Two squares won this round. A second light ran and could not stop on #21.');
  assert.deepEqual(c.on.map((x) => x[0]), ['24x', '960x']);
  assert.deepEqual(c.cards, ['1 · #21 960x Bet × pays 2 × 960 = 1,920', '2 · #33 24x Bet × pays 5 × 24 = 120']);
  assert.equal(c.band, 'Double or nothing Fair 50/50 · Win → 4,080 · Lose → 0 3 of 3 left');
  for (const [n, mark] of [[21, '1st'], [33, '2nd']]) {
    const t = await tileStyle(page, n);
    assert.deepEqual([t.bg, t.color, t.mark, t.num], [GREEN, ON_GREEN, mark, 'none'], `#${n}`);
  }
  assert.equal((await words(page, '#r-controls .rnote')), 'Uncollected win 2,040 · 2 squares');
  assert.match((await words(page, '[data-id="btn-collect"]')), /^Collect 2,040/);
  // a Double Run that misses both: both stops light, marked, two "No bet there" cards
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  await setup(page, { balance: 1000, bets: { 3: 2 }, chip: 5 });
  await playTo(page, 21, 33, 'BETTING');
  const l = await centreLook(page);
  assert.deepEqual([l.pills[0][0], l.big, l.big2], ['No win', '00.00x', null]);
  assert.deepEqual(l.cards, ['1 · #21 960x Your bet No bet there', '2 · #33 24x Your bet No bet there']);
  assert.deepEqual([(await tileStyle(page, 21)).mark, (await tileStyle(page, 33)).bg], ['1st', 'rgb(233, 238, 243)']);
  await page.__done();
});

test('no glow, pulse or WIN tag remains on tiles in any result state (win, gamble, Double Run, loss)', async () => {
  const page = await fresh();
  // the stylesheet: no v2 glow / pulse / chase / tag keyframes or rules are loaded at all
  const sheet = await page.evaluate(() => {
    const all = [...document.styleSheets].flatMap((s) => [...s.cssRules]);
    return {
      keyframes: all.filter((r) => r.type === CSSRule.KEYFRAMES_RULE).map((r) => r.name).sort(),
      tileGlow: all.filter((r) => r.selectorText && /\.tile|\.q\d/.test(r.selectorText) && !/:focus/.test(r.selectorText) && /box-shadow|filter|drop-shadow/.test(r.style.cssText)).map((r) => r.selectorText),
      tags: all.filter((r) => r.selectorText && /wtag|pulse|chase|win2|veil|celebrate|confetti/.test(r.selectorText)).map((r) => r.selectorText),
    };
  });
  assert.deepEqual(sheet.keyframes, ['cfade', 'dlgin', 'flipr', 'flipw', 'land', 'toastin', 'toastout']);
  assert.deepEqual(sheet.tileGlow, []);
  assert.deepEqual(sheet.tags, []);
  const scan = (label) => page.evaluate((l) => {
    const bad = [];
    for (const t of document.querySelectorAll('#r-track .tile')) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(t, pseudo);
        if (cs.boxShadow !== 'none') bad.push(`${t.dataset.id}${pseudo || ''} box-shadow ${cs.boxShadow}`);
        if (cs.filter !== 'none') bad.push(`${t.dataset.id}${pseudo || ''} filter ${cs.filter}`);
        if (!['none', 'land'].includes(cs.animationName)) bad.push(`${t.dataset.id}${pseudo || ''} animation ${cs.animationName}`);
        if (pseudo && cs.backgroundImage !== 'none') bad.push(`${t.dataset.id}${pseudo} gradient`);
      }
      if (/\b(pulse|chase|win2|fade)\b/.test(t.className)) bad.push(`${t.dataset.id} class ${t.className}`);
      if (t.querySelector('.veil, .lock')) bad.push(`${t.dataset.id} veil`);
    }
    if (document.querySelectorAll('.wtag, #r-tags, .confetti, .celebrate').length) bad.push('WIN tag / celebration element');
    if (/\bWIN\b/.test(document.getElementById('r-track').textContent)) bad.push('WIN text on the track');
    if (/provabl/i.test(document.body.textContent)) bad.push('provably-fair wording');
    return bad.map((b) => `${l}: ${b}`);
  }, label);
  await setup(page, { balance: 1000, bets: MOCK_BETS, chip: 5, history: [] });
  await playTo(page, 13); // 480x: v2 ran the chase marquee here
  assert.deepEqual(await scan('win'), []);
  await dispatch(page, { type: 'GAMBLE_OPEN' });
  await dispatch(page, { type: 'PICK', colour: 'red' });
  await page.evaluate(() => window.__rl.game.test.forceNextGamble('red'));
  await dispatch(page, { type: 'GAMBLE_FLIP' });
  assert.deepEqual(await scan('gamble flip'), []);
  await page.waitForFunction(() => !window.__rl.game.state.gamble.revealing);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  await setup(page, { balance: 1000, bets: MOCK_BETS, chip: 5 });
  await playTo(page, 21, 33);
  assert.deepEqual(await scan('Double Run'), []);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5 });
  await playTo(page, 12); // 96x: v2 pulsed here
  assert.deepEqual(await scan('small win'), []);
  await page.keyboard.press('Enter');
  await waitPhase(page, 'BETTING');
  await settle(page);
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5 });
  await playTo(page, 26, null, 'BETTING');
  assert.deepEqual(await scan('loss'), []);
  await page.__done();
});

// ------------------------------------------------------------------ layout per breakpoint
for (const [w, h, bp] of SIZES) {
  test(`layout ${w}x${h} -> ${bp}: 50 tiles on screen, no overlaps, controls visible; result centre and gamble panel fit`, async () => {
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
      return { bp: document.getElementById('app').dataset.bp, n: tiles.length, overlaps, inView, startVisible: start.bottom <= innerHeight && start.right <= innerWidth && start.width > 0, scrollW: document.documentElement.scrollWidth, small: [...document.querySelectorAll('#r-controls *, #r-centre *, #r-bar *, #r-credits *, #r-track *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 9).map((e) => `${e.className}:${e.textContent.trim().slice(0, 12)}:${getComputedStyle(e).fontSize}`) };
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
    // result states (Double Run #21 + #46, then the gamble panel): everything inside the ring interior, no text
    // clipped, the 1st / 2nd markers clear of the bet badges, no WIN tags
    const fits = () => page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const box = r(document.querySelector('#r-centre .centre'));
      const kids = [...document.querySelectorAll('#r-centre .centre *')].filter((e) => r(e).width > 0);
      const out = kids.filter((e) => { const b = r(e); return b.left < box.left - 0.5 || b.right > box.right + 0.5 || b.top < box.top - 0.5 || b.bottom > box.bottom + 0.5; }).map((e) => e.className || e.tagName);
      const clipped = kids.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => e.className);
      const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      // batch 6: markers clear of the badge (a 2-digit one on #21) and of the multiplier, and inside their tile
      const marks = [...document.querySelectorAll('.tile .mkt')].filter((m) => { const t = m.parentElement.parentElement, b = t.querySelector('.bet'), M = r(m), T = r(t); return (b && hit(M, r(b))) || hit(M, r(t.querySelector('.m'))) || (M.width > 0 && (M.left < T.left || M.top < T.top)); }).length;
      return { out, clipped, marks, tags: document.querySelectorAll('.wtag').length };
    });
    await setup(page, { bets: { ...BETS, 21: 10, 46: 3 } });
    await playTo(page, 21, 46);
    assert.deepEqual(await fits(), { out: [], clipped: [], marks: 0, tags: 0 }, 'Double Run result');
    await dispatch(page, { type: 'GAMBLE_OPEN' });
    await dispatch(page, { type: 'PICK', colour: 'red' });
    await settle(page);
    const f = await fits();
    assert.deepEqual([f.out, f.clipped], [[], []], 'gamble panel');
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

// ------------------------------------------------------------------ batch 7: performance
test('performance: the type warm-up leaves nothing behind; the credits count-up writes only the balance text; a win renders board and centre first, then the rail', async () => {
  const page = await fresh({ timeScale: 1 });
  await page.waitForFunction(() => !document.querySelector('#app > .warm'), { timeout: 5000 });
  const dup = await page.evaluate(() => { const ids = [...document.querySelectorAll('[data-id]')].map((e) => e.dataset.id); return ids.filter((x, i) => ids.indexOf(x) !== i); });
  assert.deepEqual(dup, [], 'no duplicate controls');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#r-credits .credits')).contain), 'size layout style');
  await setup(page, { balance: 1000, bets: { 12: 5 }, chip: 5, history: [] });
  await force(page, 12);
  await page.evaluate(() => {
    const P = window.__cu = { recs: [], frames: 0, first: {} };
    const tick = () => { P.frames += 1; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    new MutationObserver((rs) => { for (const r of rs) { const el = r.target.nodeType === 3 ? r.target.parentElement : r.target; P.recs.push({ type: r.type, role: el.dataset.role || el.className }); } })
      .observe(document.getElementById('r-credits'), { subtree: true, childList: true, characterData: true, attributes: true });
    for (const id of ['r-centre', 'r-controls']) {
      new MutationObserver(() => { if (window.__rl.game.state.phase === 'GAMBLE_OFFER' && P.first[id] == null) P.first[id] = P.frames; })
        .observe(document.getElementById(id), { subtree: true, childList: true, characterData: true, attributes: true });
    }
    window.__rl.game.dispatch({ type: 'START' });
  });
  await sleep(450);
  const cu = await page.evaluate(() => window.__cu.recs);
  // START's own render rebuilds the region once (the settled balance changes); every tween frame after it only
  // replaces the balance text
  const kinds = cu.map((r) => `${r.type}:${r.role}`);
  assert.equal(kinds[0], 'childList:', 'one region rebuild at START');
  assert.ok(kinds.length >= 4, `${kinds.length - 1} count-up writes`);
  assert.deepEqual([...new Set(kinds.slice(1))], ['childList:balance'], 'tween frames replace only the balance text; the region is not rebuilt');
  assert.equal(await text(page, '#r-credits [data-role="balance"]'), '995');
  await waitPhase(page, 'GAMBLE_OFFER', 15000);
  await settle(page);
  const first = await page.evaluate(() => window.__cu.first);
  assert.ok(first['r-centre'] != null && first['r-controls'] != null, JSON.stringify(first));
  assert.ok(first['r-centre'] < first['r-controls'], `centre in frame ${first['r-centre']}, rail in frame ${first['r-controls']}`);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'btn-collect', 'focus moves once the rail is in');
  await page.__done();
});

test('no console errors, no failed or external requests, fonts loaded locally (Poppins + JetBrains Mono)', async () => {
  const page = await fresh();
  const fonts = await page.evaluate(() => ['600 20px Poppins', '700 20px Poppins', "600 20px 'JetBrains Mono'"].map((f) => document.fonts.check(f)));
  assert.deepEqual(fonts, [true, true, true]);
  const faces = await page.evaluate(() => [...document.fonts].map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`).sort());
  assert.deepEqual(faces, ['JetBrains Mono 600', 'Poppins 600', 'Poppins 700'], 'only the v3 faces (no Plus Jakarta Sans)');
  const external = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => !n.startsWith(location.origin) && !n.startsWith('data:')));
  assert.deepEqual(external, [], 'no external requests');
  await page.__done();
  assert.deepEqual(issues, [], 'console errors / failed or external requests across all UI tests');
});
