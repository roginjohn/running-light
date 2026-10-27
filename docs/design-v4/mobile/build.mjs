// Running Light v4 mobile mocks: writes the static mock pages in mocks/*.html (all share mocks/mock.css).
// Numbers (multipliers, square counts, hit chances, limits) are read from the engine config, so the mocks cannot
// drift from the locked rules. Each page is responsive: the same file renders the phone, landscape and tablet
// layouts through mock.css media queries. Run: node docs/design-v4/mobile/build.mjs (render.mjs runs it too).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MULT, TIERS, COUNT_BY_TIER, SQUARES_BY_TIER, pRound, CHIPS, MAX_GAMBLES, GAMBLE_CAP, DOUBLE_RUN_ONE_IN, MAX_PER_ROUND, MAX_PER_SQUARE, MIN_BET, REFILL_AMOUNT, WEIGHT_BY_TIER, TOTAL_WEIGHT } from '../../../src/engine/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'mocks');
const fmt = (n) => n.toLocaleString('en-US');
const ODDS = Object.fromEntries(TIERS.map((t) => [t, `1 in ${fmt(Math.round(1 / pRound(t)))}`]));

// ring shapes (columns x rows, 2C + 2R - 4 = 50). mock.css picks one per breakpoint through --ga.
const SHAPES = [[11, 16], [12, 15], [13, 14], [16, 11]];
function ringPos(i, C, R) {
  if (i <= C) return [1, i];
  if (i <= C + R - 2) return [i - C + 1, C];
  if (i <= 2 * C + R - 2) return [R, C - (i - (C + R - 2)) + 1];
  return [R - (i - (2 * C + R - 2)), 1];
}
const gridVars = (i) => SHAPES.map(([C, R]) => { const [r, c] = ringPos(i, C, R); return `--g${C}:${r}/${c}`; }).join(';');

// ---------------------------------------------------------------- shared bits
const ic = (name, label) => `<i class="ic ic-${name}"${label ? ` aria-label="${label}"` : ' aria-hidden="true"'}></i>`;
const mark = '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9.5" y="2" width="5" height="5" rx="1" opacity=".55"/><rect x="17" y="2" width="5" height="5" rx="1" opacity=".55"/><rect x="2" y="9.5" width="5" height="5" rx="1" opacity=".55"/><rect x="17" y="9.5" width="5" height="5" rx="1" opacity=".55"/><rect x="2" y="17" width="5" height="5" rx="1" opacity=".55"/><rect x="9.5" y="17" width="5" height="5" rx="1" opacity=".55"/><rect x="17" y="17" width="5" height="5" rx="1" opacity=".55"/></g></svg>';
const dis = (d) => (d ? ' aria-disabled="true"' : '');
const pill = (t, cls = '') => `<span class="tp k${t}${cls}">${t}x</span>`;

const BETS = { 3: 2, 5: 5, 8: 1, 13: 5, 21: 2, 27: 5, 33: 5, 42: 5, 46: 10 }; // 40 on 9 squares
const total = Object.values(BETS).reduce((a, b) => a + b, 0);
const nsq = Object.keys(BETS).length;

function top({ credits, results, delta }) {
  return `<header class="top">
    <div class="cred"><span class="k">Play credits</span><span class="v"><b>${credits}</b>${delta ? `<span class="delta">${delta}</span>` : ''}</span></div>
    <div class="hist" aria-label="Last results"><span class="k">Last</span><span class="tps">${results.map((t, i) => pill(t, i === 0 ? ' new' : '')).join('')}</span></div>
    <div class="tbtns">
      <button class="ib" role="switch" aria-checked="true" aria-label="Sound on">${ic('sound')}</button>
      <button class="ib" aria-label="Game info: settings, paytable and help">${ic('gear')}</button>
    </div>
  </header>`;
}

function tile(i, { lit, trail, win, loss, interactive, bets = BETS }) {
  const m = MULT[i];
  const cls = ['tile', `q${m}`];
  if (lit === i) cls.push('lit');
  if (trail && trail[0] === i) cls.push('trail1');
  if (trail && trail[1] === i) cls.push('trail2');
  if (win === i) cls.push('win');
  if (loss === i) cls.push('lit');
  if (bets[i]) cls.push('hb');
  const b = bets[i] ? `<span class="bet">${bets[i]}</span>` : '';
  const label = m === 1920 ? '<i class="star" aria-hidden="true"></i><span class="mt">1920</span><span class="x">x</span>' : `<span class="mt">${m}</span><span class="x">x</span>`;
  const inner = `<span class="num">${i}</span><span class="m">${label}</span>${b}`;
  const st = `style="${gridVars(i)}"`;
  return interactive
    ? `<button class="${cls.join(' ')}" ${st} aria-label="Square ${i}, pays ${m}x${bets[i] ? `, your bet ${bets[i]}` : ''}">${inner}</button>`
    : `<div class="${cls.join(' ')}" ${st}>${inner}</div>`;
}

function ring(opts, centre) {
  let h = '';
  for (let i = 1; i <= 50; i++) h += tile(i, opts);
  return `<div class="ring${opts.interactive ? ' live' : ''}">${h}<div class="centre">${centre}</div></div>`;
}

// betting grid (phones, portrait and landscape): 50 square buttons in number order, >= 44 px each
function betGrid(captionExtra = '') {
  let h = '';
  for (let i = 1; i <= 50; i++) {
    const m = MULT[i];
    const b = BETS[i] ? `<span class="bet">${BETS[i]}</span>` : '';
    h += `<button class="sq q${m}" aria-label="Square ${i}, pays ${m}x${BETS[i] ? `, your bet ${BETS[i]}` : ''}"><span class="num">${i}</span><span class="m">${m}x</span>${b}</button>`;
  }
  h += '<div class="legend"><span>Tap a square to add the chip.</span><span>Long-press for its info.</span></div>';
  return `<div class="bwrap">
    <div class="bcap"><div class="cps"><span class="cp on">Betting open</span><span class="cp">Double Run · 1 in ${DOUBLE_RUN_ONE_IN}</span></div>${captionExtra}</div>
    <div class="bgrid">${h}</div></div>`;
}

const chipRow = (sel, off) => `<div class="chips" role="radiogroup" aria-label="Chip value">${CHIPS.map((c) => `<button class="chip c${c}${c === sel ? ' sel' : ''}" role="radio" aria-checked="${c === sel}" aria-label="Chip ${c}"${dis(off)}><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="face" cx="22" cy="22" r="21"/><circle class="edge" cx="22" cy="22" r="18.5" fill="none" stroke-width="3.5" stroke-dasharray="5 9.53"/></svg><span class="cv">${c}</span></button>`).join('')}</div>`;

/** Bottom dock. kind: betting | running | win | flip | loss | refill */
function dock(kind) {
  const off = kind !== 'betting' && kind !== 'loss';
  const bamt = `<div class="bamt"><span class="coin" aria-hidden="true"></span><span class="v"><span class="k">Total bet</span> <b>${kind === 'refill' ? 0 : total}</b></span>
    <button class="btn sec sc" aria-label="Halve all bets"${dis(off)}>½</button><button class="btn sec sc" aria-label="Double all bets"${dis(off)}>×2</button></div>`;
  const info = {
    betting: `<span>Total bet <b>${total}</b> / ${MAX_PER_ROUND} · ${nsq} squares</span><span class="lbs">Last bets <b>20</b> 20 15</span>`,
    loss: `<span>Total bet <b>${total}</b> / ${MAX_PER_ROUND} · bets kept</span><span class="lbs">Last bets <b>40</b> 20 20</span>`,
    running: `<span>Total bet <b>${total}</b> · ${nsq} squares</span><span class="lbs">Controls locked</span>`,
    win: '<span>Uncollected win <b>1,920</b></span><span class="lbs">Bet 40 taken</span>',
    flip: '<span>In gamble <b>3,840</b> · not collected</span><span class="lbs">Flip 2 of 3</span>',
    refill: `<span>${MIN_BET}–${MAX_PER_SQUARE} per square · ${MAX_PER_ROUND} per round</span><span class="lbs">Credits 0</span>`,
  }[kind];
  const edits = `<div class="edits"><button class="btn sec ed"${dis(off)}>Undo</button><button class="btn sec ed"${dis(off)}>Clear</button><button class="btn sec ed"${dis(off || kind === 'betting')}>Rebet</button></div>`;
  const main = {
    betting: `<button class="btn cta stack"><span>Start</span><span class="sub">${total} on ${nsq} squares</span></button>`,
    loss: `<button class="btn cta stack"><span>Start again</span><span class="sub">${total} on ${nsq} squares</span></button>`,
    running: '<button class="btn cta stack" aria-disabled="true"><span>Running…</span><span class="sub">controls locked</span></button>',
    win: `<button class="btn collect stack"><span>Collect 1,920</span><span class="sub">Add to credits</span></button><button class="btn gam stack"><span>Gamble ×2</span><span class="sub">Fair 50/50 · ${MAX_GAMBLES} of ${MAX_GAMBLES} left</span></button>`,
    flip: '<button class="btn out stack" aria-disabled="true"><span>Collect 3,840</span><span class="sub">after the flip</span></button><button class="btn gam stack" aria-disabled="true"><span>Flipping…</span><span class="sub">Red · 3,840 → 7,680 or 0</span></button>',
    refill: '<button class="btn cta stack" aria-disabled="true"><span>Place a bet</span><span class="sub">then press Start</span></button>',
  }[kind];
  const two = kind === 'win' || kind === 'flip';
  return `<section class="dock${two ? ' two' : ''}" aria-label="Bet controls">${bamt}${chipRow(5, off)}<div class="dinfo">${info}</div>${two ? '' : edits}<div class="main">${main}</div></section>`;
}

const PAYS = (on) => `<div class="pays">${TIERS.map((t) => `<span class="pay${t === on ? ' on' : ''}"><b>${t}x</b><i>${COUNT_BY_TIER[t]} sq</i></span>`).join('')}</div>`;

// ---------------------------------------------------------------- centre contents per state
const C = {
  betting: `<div class="cps"><span class="cp on">Betting open</span><span class="cp">Double Run · 1 in ${DOUBLE_RUN_ONE_IN}</span></div>
    <div class="big">00.00<small>x</small></div>
    <div class="ctxt"><h1 class="ctitle">Place your bets</h1><p class="csub">Pick a chip, tap squares, then press <b>Start</b>.</p></div>${PAYS()}`,
  running: `<div class="cps"><span class="cp on">Light running</span><span class="cp">Double Run · 1 in ${DOUBLE_RUN_ONE_IN}</span></div>
    <div class="big">96.00<small>x</small></div>
    <div class="ctxt"><h1 class="ctitle">Good luck</h1><p class="csub">The result was drawn when you pressed Start.</p></div>`,
  win: `<div class="cps"><span class="cp mint">Jackpot</span></div>
    <div class="big win">1920.00<small>x</small></div>
    <div class="ctxt"><h1 class="ctitle">You win 1,920</h1><p class="csub">Collect it, or gamble it on a fair 50/50.</p></div>
    <div class="card won"><b class="cn">#8</b><span class="cm">1920x</span><span class="cv"><i>Bet × pays</i><b>1 × 1920 = 1,920</b></span></div>`,
  loss: `<div class="cps"><span class="cp coral">No win</span></div>
    <div class="big">00.00<small>x</small></div>
    <div class="ctxt"><h1 class="ctitle">No win this time</h1><p class="csub">Stopped on #26 (24x). Your bets are kept.</p></div>
    <div class="card"><b class="cn">#26</b><span class="cm">24x</span><span class="cv"><i>Your bet</i><b>No bet there</b></span></div>
    <button class="btn sec cbtn">Change bets</button>`,
  flip: `<div class="cps"><span class="cp on">Gamble</span><span class="cp mint">#8 · won 1,920</span></div>
    <div class="gpanel">
      <div class="ghead"><b>Double or nothing · flip 2</b><span class="gl"><span class="pips"><i class="used"></i><i></i><i></i></span>2 of ${MAX_GAMBLES} left</span></div>
      <div class="gdiscs">
        <button class="pick sel" aria-disabled="true" aria-label="Red, your pick"><span class="disc"></span><span>Red</span><span class="yp">Your pick</span></button>
        <span class="coin" aria-hidden="true"></span>
        <button class="pick white" aria-disabled="true" aria-label="White"><span class="disc"></span><span>White</span><span class="yp ghost">&nbsp;</span></button>
      </div>
      <p class="gmsg"><b>Flipping…</b> If red lights, your win doubles.</p>
      <div class="gcards"><div class="gc"><span>Current</span><b>3,840</b></div><div class="gc"><span>Red</span><b class="won">7,680</b></div><div class="gc"><span>White</span><b>0</b></div></div>
    </div>`,
};

// ---------------------------------------------------------------- pages
function page(name, { body, cls = '', title }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Running Light v4 mobile mock · ${title}</title>
<link rel="stylesheet" href="mock.css">
</head>
<body class="${cls}">
${body}
</body>
</html>
`;
  writeFileSync(join(OUT, `${name}.html`), html);
}

const RES = ['24x', '96x', '24x', '480x', '24x', '96x', '24x', '24x', '96x', '24x'].map((s) => parseInt(s, 10));
const game = (state, { credits = '1,200', results = RES, delta, ringOpts = {}, centre, dockKind, stageExtra = '', inert = false }) => `
<div class="app st-${state}"${inert ? ' inert' : ''}>
  ${top({ credits, results, delta })}
  <main class="stage">${stageExtra}${ring(ringOpts, centre)}</main>
  ${dock(dockKind)}
</div>`;

const bettingGame = (inert = false) => game('betting', { credits: '1,240', ringOpts: { interactive: true }, centre: C.betting, dockKind: 'betting', inert,
  stageExtra: betGrid('<div class="bhead"><h1 class="ctitle">Place your bets</h1><p class="csub">Pick a chip, then tap squares.</p></div>') });

// sheets (settings / paytable / help, info sheet) and modal dialogs
const sheet = (label, inner, cls = '') => `<div class="scrim"></div><div class="sheet${cls}" role="dialog" aria-modal="true" aria-label="${label}">${inner}</div>`;
const shead = (title) => `<div class="shead">${mark}<h2>${title}</h2><button class="ib x" aria-label="Close">${ic('x')}</button></div>`;
const tabs = (on) => `<div class="tabs" role="tablist">${['Settings', 'Paytable', 'Help'].map((t) => `<button role="tab" aria-selected="${t === on}" class="${t === on ? 'on' : ''}">${t}</button>`).join('')}</div>`;
const sfoot = '<div class="sfoot"><span>Play credits only</span><span>Outcome is decided and saved before the light runs</span></div>';

const sw = (on, label, off) => `<button class="sw" role="switch" aria-checked="${on}" aria-label="${label}"${dis(off)}><span class="tgl${on ? ' on' : ''}"><i></i></span></button>`;
const settingsBody = `<div class="sbody">
  <div class="srow"><span><b>Sound</b><br>Effects for the light, wins and gamble</span>${sw(true, 'Sound')}</div>
  <div class="srow"><span><b>Music</b><br>Background loop</span><label class="sl"><input type="range" min="0" max="100" value="60" aria-label="Music volume"><span class="v">60</span></label></div>
  <div class="srow"><span><b>Sound effects</b><br>Clicks, light, wins</span><label class="sl"><input type="range" min="0" max="100" value="80" aria-label="Sound effects volume"><span class="v">80</span></label></div>
  <div class="srow"><span><b>Reduced motion</b><br>Short light run, no flip animation</span>${sw(false, 'Reduced motion')}</div>
  <div class="srow off"><span><b>Turbo</b><br>Placeholder – pending approval</span>${sw(false, 'Turbo', true)}</div>
  <div class="touch-only"><h3 class="isub">Touch</h3><p class="body">Long-press any square for its pays, hit chance and your bet. Tap <b>Change bets</b> after a result to edit them.</p></div>
  <div class="kbd-only"><h3 class="isub">Keys</h3><table class="ikeys"><tr><td><span class="kc">Space</span></td><td>Start</td></tr><tr><td><span class="kc">1–5</span></td><td>Chip</td></tr><tr><td><span class="kc">G</span> <span class="kc">Enter</span></td><td>Gamble · Collect</td></tr><tr><td><span class="kc">Esc</span></td><td>Close this window</td></tr></table></div>
</div>`;

const paytableBody = `<div class="sbody">
  <ul class="plist">${[...TIERS].reverse().map((t) => `<li><span class="ppill k${t}">${t}x</span><span class="pc"><b>${COUNT_BY_TIER[t]} ${COUNT_BY_TIER[t] === 1 ? 'square' : 'squares'}</b><span>${ODDS[t]} per round, each</span></span><span class="pn">#${SQUARES_BY_TIER[t].join(', ')}</span></li>`).join('')}</ul>
  <div class="pnotes">
    <p class="body"><b>Pays include your stake.</b> A bet of 5 on a 96x square returns 480.</p>
    <p class="body"><b>Double Run · 1 in ${DOUBLE_RUN_ONE_IN} rounds:</b> a second light runs and can’t stop on the first square. Both stops pay.</p>
    <p class="body"><b>Gamble:</b> fair 50/50 on red or white, up to ${MAX_GAMBLES} times per win. Off when doubling would go over ${fmt(GAMBLE_CAP)}.</p>
    <p class="body"><b>Limits:</b> ${MIN_BET}–${MAX_PER_SQUARE} per square, ${MAX_PER_ROUND} per round. Chips ${CHIPS.join(', ')}.</p>
    <p class="body"><b>RTP ≈95.45%:</b> the theoretical long-run average return, not a promise for any session.</p>
  </div>
</div>`;

const helpBody = `<div class="sbody">
  <ol class="isteps">
    <li><span class="n">1</span><p class="body"><b>Pick a chip</b><br>${CHIPS.slice(0, -1).join(', ')} or ${CHIPS[CHIPS.length - 1]} credits.</p></li>
    <li><span class="n">2</span><p class="body"><b>Place bets</b><br>Tap squares, up to ${MAX_PER_SQUARE} per square and ${MAX_PER_ROUND} per round. Long-press a square for its info.</p></li>
    <li><span class="n">3</span><p class="body"><b>Press Start</b><br>The light runs for 4–6 seconds and stops on one square.</p></li>
    <li><span class="n">4</span><p class="body"><b>Collect or gamble</b><br>Win on any square with a bet, then Collect it or gamble it.</p></li>
  </ol>
  <h3 class="isub">How the gamble works</h3>
  <ul class="igamble">
    <li><p class="body">After a win, tap <b>Gamble ×2</b>, pick <b>red</b> or <b>white</b>, then tap Gamble on your colour.</p></li>
    <li><p class="body">Red or white is drawn at that moment, a fair 50/50, and saved before the disc flips.</p></li>
    <li><p class="body"><b>Match:</b> your win doubles. <b>No match:</b> the win is lost. Nothing else is taken. Up to ${MAX_GAMBLES} per win.</p></li>
  </ul>
  <h3 class="isub">How results are decided</h3>
  <ul class="igamble">
    <li><p class="body"><b>Drawn first.</b> When you press Start, the result is drawn and saved on this device before the light starts.</p></li>
    <li><p class="body"><b>Weighted by 1 ÷ multiplier.</b> Weights ${TIERS.map((t) => WEIGHT_BY_TIER[t]).join(' / ')} of ${fmt(TOTAL_WEIGHT)} for ${TIERS.map((t) => `${t}x`).join(' / ')}.</p></li>
    <li><p class="body"><b>Randomness.</b> Your browser’s built-in crypto random number generator. Nothing is sent anywhere.</p></li>
  </ul>
  <p class="inavy body"><b>Play credits only.</b> No real money value. Credits can’t be bought, sold or cashed out. Free refill to ${fmt(REFILL_AMOUNT)} whenever you run out.</p>
</div>`;

const dlg = (cls, label, inner) => `<div class="scrim"></div><div class="dwrap"><div class="dlg${cls}" role="dialog" aria-modal="true" aria-label="${label}">${inner}</div></div>`;
const dfoot = '<p class="dfoot fn">Play credits only. No real money value.</p>';

export function build() {
  mkdirSync(OUT, { recursive: true });

  page('betting', { title: 'Betting', body: bettingGame() });
  page('running', { title: 'Running', body: game('running', { ringOpts: { lit: 17, trail: [16, 15] }, centre: C.running, dockKind: 'running' }) });
  page('win-gamble-offer', { title: 'Win, gamble offer', body: game('win', { results: [1920, ...RES.slice(0, 9)], delta: '', ringOpts: { win: 8 }, centre: C.win, dockKind: 'win' }) });
  page('gamble-flip', { title: 'Gamble flip', body: game('flip', { results: [1920, ...RES.slice(0, 9)], ringOpts: { win: 8 }, centre: C.flip, dockKind: 'flip' }) });
  page('loss', { title: 'Loss', body: game('loss', { results: [24, ...RES.slice(0, 9)], ringOpts: { loss: 26 }, centre: C.loss, dockKind: 'loss' }) });

  page('settings', { title: 'Settings', cls: 'has-sheet', body: bettingGame(true) + sheet('Game info', shead('Running Light · Game info') + tabs('Settings') + settingsBody + sfoot) });
  page('paytable', { title: 'Paytable', cls: 'has-sheet', body: bettingGame(true) + sheet('Game info', shead('Running Light · Game info') + tabs('Paytable') + paytableBody + sfoot) });
  page('help', { title: 'Help', cls: 'has-sheet', body: bettingGame(true) + sheet('Game info', shead('Running Light · Game info') + tabs('Help') + helpBody + sfoot) });

  // long-press info sheet: the touch replacement for the hover tooltip
  page('tip-sheet', { title: 'Square info sheet', cls: 'has-sheet', body: bettingGame(true) + sheet('Square 8 info', `${shead('Square #8 · 1920x')}
    <div class="sbody tipb">
      <div class="drow"><span>Pays</span><b>1920× your bet (incl. stake)</b></div>
      <div class="drow"><span>Hit chance per round</span><b>≈ ${ODDS[1920]}</b></div>
      <div class="drow"><span>Your bet</span><b>1 / ${MAX_PER_SQUARE}</b></div>
      <div class="tbtns"><button class="btn sec">Remove 1</button><button class="btn pri">Add 5</button></div>
    </div>`, ' tip') });

  page('refill', { title: 'Refill', cls: 'has-sheet', body: game('refill', { credits: '0', ringOpts: {}, centre: C.betting, dockKind: 'refill', inert: true, stageExtra: betGrid() }).replace('class="app st-refill"', 'class="app st-refill st-betting"')
    + dlg('', 'Out of play credits', `<span class="dic">${ic('reload')}</span><h2 class="dtitle">Out of play credits</h2>
      <p class="body">Take a free refill and keep playing. Refills are unlimited, with no waiting and no cost.</p>
      <div class="drow"><span>Free refill</span><b>${fmt(REFILL_AMOUNT)} credits</b></div>
      <button class="btn pri stack dbtn"><span>Refill ${fmt(REFILL_AMOUNT)}</span><span class="sub">Free</span></button>${dfoot}`) });

  page('error', { title: 'Error', cls: 'has-sheet', body: game('running', { credits: '1,200', ringOpts: { lit: 17 }, centre: C.running, dockKind: 'running', inert: true })
    + dlg(' err', 'Something went wrong', `<span class="dic">${ic('alert')}</span><h2 class="dtitle">Something went wrong</h2>
      <p class="body">The game paused to keep your round safe. Your bet and its result are already saved on this device, so reloading <b>won’t change the outcome or charge you again</b>.</p>
      <div class="dcode">Round in progress: bet ${total} · ${nsq} squares · credits 1,200 · code E-STORAGE-WRITE</div>
      <button class="btn pri stack dbtn"><span>Reload</span><span class="sub">Restores your round</span></button>${dfoot}`) });

  page('start', { title: 'Start', body: `<div class="screen start">
    <div class="scontent"><div class="brand col">${mark}<h1>Running Light</h1></div>
      <p class="body">Bet play credits on a 50-square track. The light runs, slows and stops on one square.</p>
      <div class="drow"><span>Credits</span><b>1,000</b></div></div>
    <div class="sactions">
      <button class="btn cta stack dbtn"><span>Play</span><span class="sub">Turns sound on</span></button>
      <div class="srow2"><button class="btn sec">How to play</button><button class="btn sec" role="switch" aria-checked="true">Sound: on</button></div>
      <p class="sfootnote fn">Play credits only · No real money value · Free refill to ${fmt(REFILL_AMOUNT)}</p>
    </div></div>` });

  page('loading', { title: 'Loading', body: `<div class="screen loading">
    <div class="scontent"><div class="brand col">${mark}<h1>Running Light</h1></div>
      <div class="lbar"><i style="width:62%"></i></div><div class="lrow"><span>Loading sounds and fonts</span><span>62%</span></div></div>
    <p class="sfootnote fn">Play credits only · No real money value</p></div>` });

  page('rotate', { title: 'Rotate (landscape option B)', body: `<div class="screen rotate">
    <div class="scontent"><span class="phone-ico" aria-hidden="true"><i></i></span><h1>Turn your phone upright</h1>
      <p class="body">Running Light needs a portrait screen on phones so the board, results and controls never overlap.</p>
      <p class="sfootnote fn">Your round and bets are kept while you turn.</p></div></div>` });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { build(); console.log('mocks written to', OUT); }
