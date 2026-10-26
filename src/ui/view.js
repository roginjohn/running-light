// v2 view: pure functions from (engine state, UI state, derived context, layout) to HTML strings per region.
// No outcome logic here: every number shown comes from the engine state (stored round) or simple display arithmetic.
import { MULT, TIERS, COUNT_BY_TIER, WEIGHT_BY_TIER, TOTAL_WEIGHT, CHIPS, pRound, pStop, GAMBLE_CAP, MAX_GAMBLES, HISTORY_SHOWN, DOUBLE_RUN_ONE_IN, MAX_PER_ROUND, MAX_PER_SQUARE, MIN_BET } from '../engine/config.js';
import { totalOf } from '../engine/bets.js';
import { icon, star, chipFace, v3icon, v3mark } from './icons.js';
import { halveBets, doubleBets } from './betscale.js';
import { cell } from './layout.js';
import { winners, lightClass, bigMult, bigValue, bigResult } from './track.js';

export const fmt = (n) => Number(n).toLocaleString('en-US');
const px = (v) => `${Math.round(v * 100) / 100}px`;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fs = (L, v, min) => Math.max(min, v * L.s);
const kc = (k) => `<span class="kc">${k}</span>`;
const dis = (d) => (d ? ' aria-disabled="true"' : '');
const cap = (c) => c[0].toUpperCase() + c.slice(1);

export const ODDS = Object.fromEntries(TIERS.map((t) => [t, `1 in ${fmt(Math.round(1 / pRound(t)))}`]));

/** Display multiplier label: capitals in display contexts ("24X", "★1920X"). */
export function tierLabel(m, noX = false) {
  return `${m === 1920 ? star() : ''}${m}${noX ? '' : 'X'}`;
}
export function tierBand(m, f, h, w = null) {
  return `<span class="tb t${m}" style="font-size:${px(f)};height:${px(h)};${w ? `width:${px(w)}` : `padding:0 ${px(h * 0.4)}`}">${tierLabel(m)}</span>`;
}

// ------------------------------------------------------------------ derived UI mode
/** bet | locked | offer | ingamble | payout | paused */
export function modeOf(s, ui) {
  if (ui.gambleLoss) return 'ingamble';
  switch (s.phase) {
    case 'BETTING': return 'bet';
    case 'SPINNING': case 'RESOLVING': case 'DOUBLE_RUN': return 'locked';
    case 'GAMBLE_OFFER': return 'offer';
    case 'GAMBLE': return 'ingamble';
    case 'PAYOUT': return 'payout';
    default: return 'paused';
  }
}

export { winners, lightClass, bigMult, bigValue, bigResult };

// ------------------------------------------------------------------ header
function bunting(W, hh) {
  const n = Math.ceil(W / 46);
  const cols = ['#FF5D73', '#2ED3BE', '#FFB72B', '#A98BFF', '#E8E1F7'];
  let tri = '';
  for (let i = 0; i < n; i++) { const x = i * (W / n); tri += `<polygon points="${x},0 ${x + (W / n) * 0.9},0 ${x + (W / n) * 0.45},10" fill="${cols[i % 5]}" opacity=".22"/>`; }
  let dots = '';
  for (let i = 0; i < n * 2; i++) { const x = (i + 0.5) * (W / (n * 2)); const on = i % 3 === 0; dots += `<circle cx="${x.toFixed(1)}" cy="${hh - 0.5}" r="${on ? 1.8 : 1.4}" fill="${on ? '#FFD46B' : '#4D4374'}"${on ? ' opacity=".8"' : ''}/>`; }
  return `<svg class="bunting" width="${W}" height="${hh}" aria-hidden="true">${tri}${dots}</svg>`;
}
export { bunting };

// ------------------------------------------------------------------ page frame (v3 batch 2)
/** Frame body, rail fill with its 1 px divider, and the bottom-bar fill. Static per layout (no per-state changes). */
export function pageFrame(L) {
  const f = L.frame, b = L.bar;
  const rail = L.rail ? `<div class="frame-rail" style="left:${px(L.rail.x)};top:${px(L.rail.y)};width:${px(L.rail.w + 1)};height:${px(L.rail.h)}"></div>` : ''; // 230 rail + 1 px divider
  return `<div class="frame" style="left:${px(f.x)};top:${px(f.y)};width:${px(f.w)};height:${px(f.h)}"></div>${rail}<div class="frame-bar" style="left:${px(b.x)};top:${px(b.y)};width:${px(b.w)};height:${px(b.h)}"></div>`;
}

// Rail (desktop) and dock (tablet portrait) geometry shared by the credits line and the controls (v3 batch 3).
const HEAD_H = 16; // "Bet amount … Credits 1,000" row (label-sm line height)
const BET_LBL_W = 84; // room kept for "Bet amount" left of the credits overlay
const DOCK_PAD = 12;
function dockCols(L) {
  const d = L.dock;
  const colW = (d.w - 24) / 2;
  return { x1: d.x, x2: d.x + colW + 24, y: d.y + DOCK_PAD + 1, colW };
}

/** Where the credits value sits: right end of the "Bet amount" row (rail top, or the dock's left column). */
export function creditsRect(L) {
  if (L.rail) return { x: L.rail.x + L.rail.pad + BET_LBL_W, y: L.rail.y + L.rail.pad, w: L.rail.w - 2 * L.rail.pad - BET_LBL_W };
  const c = dockCols(L);
  return { x: c.x1 + BET_LBL_W, y: c.y, w: c.colW - BET_LBL_W };
}

/** "Credits 1,000" (with the green +N delta while paying). Its own region so the balance count-up only repaints this line. */
export function credits(s, ui, L) {
  const r = creditsRect(L);
  const bal = ui.displayBalance == null ? s.balance : ui.displayBalance;
  const delta = ui.delta ? `<span class="delta">+${fmt(ui.delta)}</span>` : '';
  return `<div class="credits" role="status" aria-label="Play credits ${fmt(s.balance)}" style="left:${px(r.x)};top:${px(r.y)};width:${px(r.w)};height:${px(HEAD_H)}"><span class="k">Credits</span><span class="v">${delta}<b data-role="balance">${fmt(bal)}</b></span></div>`;
}

// ------------------------------------------------------------------ controls (rail / dock), v3 batch 3
// Flat v3 controls (tokens.md §1–3): bet field with the round total and 1/2 · x2, chip row, primary button
// (Start, or Collect + Gamble ×2 after a win), Undo / Clear / Rebet, last bets, rail note, disclaimer. No shadows.
function chipRow(s, c, keys) {
  const off = c.mode !== 'bet' || !c.canBet;
  return `<div class="chips" role="radiogroup" aria-label="Chip value">${CHIPS.map((v, i) => {
    const sel = s.chip === v;
    return `<button class="chip c${v} hit${sel ? ' sel' : ''}" data-id="chip-${v}" role="radio" aria-checked="${sel}" aria-label="Chip ${v}${keys ? `, key ${i + 1}` : ''}"${dis(off)}>${chipFace(v)}</button>`;
  }).join('')}</div>`;
}

/** Bet field: the TOTAL bet on the board, and 1/2 · x2 that scale every square (clamped by ui/betscale.js). */
export function betField(s, c) {
  const off = c.mode !== 'bet' || !c.canBet || !c.total;
  const half = off || !halveBets(s.bets).changed;
  const dbl = off || !doubleBets(s.bets, s.balance).changed;
  const hint = c.total ? `${c.count} square${c.count === 1 ? '' : 's'} · ${fmt(c.total)} / ${MAX_PER_ROUND} per round` : `${MIN_BET}–${MAX_PER_SQUARE} per square · max ${MAX_PER_ROUND} per round`;
  return `<div class="grp"><div class="rhead"><span>Bet amount</span></div>
    <div class="betin${off ? ' off' : ''}"><span class="coin" aria-hidden="true"></span><output class="v" data-role="total" aria-label="Total bet ${c.total} credits">${fmt(c.total)}</output><button class="sc hit" data-id="btn-half" aria-label="Halve every bet (minimum 1 per square)"${dis(half)}>1/2</button><button class="sc hit" data-id="btn-double" aria-label="Double every bet (maximum ${MAX_PER_SQUARE} per square, ${MAX_PER_ROUND} per round)"${dis(dbl)}>x2</button></div>
    <div class="hint" data-role="bet-hint">${hint}</div></div>`;
}

export function lastWin(s, ui, c) {
  const r = s.round;
  const m = c.mode;
  if (s.phase === 'DOUBLE_RUN' && r) {
    const w1 = (r.bets[r.s1] || 0) * MULT[r.s1];
    return { label: 'This round', value: w1, note: 'so far · second light running' };
  }
  if (ui.gambleLoss) return { label: 'Last win', value: 0, note: 'gamble lost', lost: true };
  if (m === 'offer') {
    const { w1, w2 } = winners(s, ui);
    return { label: 'Uncollected win', value: r.currentWin, note: w1 && w2 ? '2 squares' : '' };
  }
  if (m === 'ingamble') return { label: 'In gamble', value: r.currentWin, note: 'not collected' };
  if (m === 'payout') return { label: 'Last win', value: r.currentWin, note: 'collected' };
  const lw = s.lastWin;
  if (m === 'bet' && lw.kind === 'loss') return { label: 'Last win', value: 0, note: 'no win this round' };
  if (m === 'bet' && lw.kind === 'paid') {
    const lost = r && r.gambles.length && r.currentWin === 0;
    return { label: 'Last win', value: lw.value, note: lost ? 'gamble lost' : 'last round' };
  }
  return null; // nothing to report yet: the note is not shown
}

/** Rail note (component sheet): "Uncollected win 2,400", "In gamble 4,800 · not collected". Hidden until there
 *  is a result to report. */
function railNote(s, ui, c) {
  const lw = lastWin(s, ui, c);
  if (!lw) return '';
  const v = lw.value; // the count-up writes this number's text only (app.js paintWin), never the rail markup
  return `<div class="rnote${lw.lost ? ' lost' : ''}"><span class="k">${lw.label}</span> <b data-role="lastwin">${fmt(v)}</b>${lw.note ? `<span class="n"> · ${lw.note}</span>` : ''}</div>`;
}

// ------------------------------------------------------------------ top row (v3 batch 4)
/** Row above the track: "Last results:" (newest first) on the left, "Last bets:" (round totals from ui.betTotals,
 *  newest first) on the right. Pills that do not fit wrap onto a hidden second line, so no pill is ever cut. */
export function topRow(s, ui, L) {
  const t = L.top;
  const hist = s.history.slice(-HISTORY_SHOWN).reverse();
  const res = hist.map((h, i) => {
    const m = MULT[h.s1];
    const label = h.s2 ? `${m}x · ${MULT[h.s2]}x` : `${m}x`;
    return `<span class="tp k${h.s2 ? 'dr' : m}${i === 0 ? ' new' : ''}${h.win > 0 ? ' won' : ''}">${label}</span>`;
  }).join('');
  const resLabel = hist.map((h) => (h.s2 ? `#${h.s1} ${MULT[h.s1]}x and #${h.s2} ${MULT[h.s2]}x` : `#${h.s1} ${MULT[h.s1]}x`)).join(', ');
  const bets = ui.betTotals || [];
  const lbs = bets.map((e, i) => `<span class="lb${i === 0 ? ' new' : ''}">${fmt(e.t)}</span>`).join('');
  return `<div class="toprow" style="left:${px(t.x)};top:${px(t.y)};width:${px(t.w)};height:${px(t.h)}">
    <div class="tg" data-role="history" aria-label="Last results, newest first: ${resLabel || 'none yet'}"><span class="k">Last results:</span><span class="tps">${res || '<span class="none">None yet</span>'}</span></div>
    <div class="tg lastbets" data-role="last-bets" aria-label="Last bets, newest first: ${bets.length ? bets.map((e) => e.t).join(', ') : 'none yet'}"><span class="k">Last bets:</span><span class="tps">${lbs || '<span class="none">None yet</span>'}</span></div></div>`;
}

function actionRow(s, c) {
  const off = c.mode !== 'bet' || !c.canBet;
  const undoDis = off || !s.undo.length, clearDis = off || !c.total;
  const rebetDis = off || !!c.rebetWhy || c.rebetSame;
  const lastT = s.lastBets ? totalOf(s.lastBets) : 0;
  const one = (id, label, key, d, hi, title) => `<button class="btn sec hit${hi ? ' hi' : ''}" data-id="${id}" aria-label="${label} (key ${key})"${title ? ` title="${esc(title)}"` : ''}${dis(d)}><span>${label}</span></button>`;
  return `<div class="acts">${one('btn-undo', 'Undo', 'Z', undoDis)}${one('btn-clear', 'Clear', 'C', clearDis)}${one('btn-rebet', c.ghosts && !c.rebetWhy ? `Rebet ${lastT}` : 'Rebet', 'R', rebetDis, c.ghosts && !rebetDis, c.rebetWhy && s.lastBets ? c.rebetWhy : '')}</div>`;
}

const gambleWhyText = (gw) => (gw === 'cap' ? `Doubling would go over the ${fmt(GAMBLE_CAP)} cap` : gw === 'max' ? 'No gambles left for this win' : '');

/** Primary button(s): Start (blue); after a win the Collect (green, dark text) + Gamble ×2 (blue) stack; in the
 *  gamble, Gamble on <colour> (blue) + Collect, which is locked (outline) while the disc flips. */
function mainButtons(s, ui, c, dock) {
  const m = c.mode;
  const r = s.round;
  const st = (inner, d = true) => `<button class="btn pri stack hit" data-id="btn-start"${dis(d)}>${inner}</button>`;
  const collect = (locked) => `<button class="btn ${locked ? 'out' : 'collect'} stack hit" data-id="btn-collect" aria-label="Collect ${fmt(r.currentWin)} to credits (Enter)"${dis(locked)}><span>Collect ${fmt(r.currentWin)}</span><span class="sub">${locked ? 'After the flip' : 'Add to credits'}${dock ? '' : ' · Enter'}</span></button>`;
  if (m === 'offer') {
    const gw = c.gambleWhy;
    const gwText = gambleWhyText(gw);
    const left = MAX_GAMBLES - r.gambles.length;
    return `<div class="mains">${collect(false)}
      <button class="btn gam stack hit" data-id="btn-gamble" aria-label="Gamble times 2, fair 50/50 (G)"${gwText ? ` title="${esc(gwText)}"` : ''}${dis(!!gw)}><span>Gamble ×2</span><span class="sub">${gw ? esc(gwText) : `Fair 50/50 · ${left} of ${MAX_GAMBLES} left${dock ? '' : ' · G'}`}</span></button></div>`;
  }
  if (m === 'locked') return st(`<span>${s.phase === 'DOUBLE_RUN' ? 'Double Run…' : 'Running…'}</span><span class="sub">controls locked</span>`);
  if (m === 'ingamble' && ui.gambleLoss) {
    return `<div class="mains"><button class="btn pri stack hit" data-id="btn-back" aria-label="Back to the board (Enter)"><span>Back to the board</span><span class="sub">continues in ${ui.gambleLoss.left} s${dock ? '' : ' · Enter'}</span></button></div>`;
  }
  if (m === 'ingamble') {
    const w = r.currentWin, pick = s.gamble.pick, gw = c.gambleWhy;
    const odds = `${fmt(w)} → ${fmt(w * 2)} or 0`;
    const flip = (inner, d, label = '') => `<button class="btn gam stack hit" data-id="btn-flip"${label ? ` aria-label="${esc(label)}"` : ''}${dis(d)}>${inner}</button>`;
    let f;
    if (s.gamble.revealing) f = flip(`<span>Flipping…</span><span class="sub">${cap(pick)} · ${odds}</span>`, true);
    else if (gw) f = flip(`<span>Gamble ×2</span><span class="sub">${esc(gambleWhyText(gw))}</span>`, true);
    else if (!pick) f = flip(`<span>Pick red or white</span><span class="sub">${dock ? 'tap a disc' : 'R / W, then G'}</span>`, true);
    else f = flip(`<span>Gamble on ${pick}</span><span class="sub">${odds}${dock ? '' : ' · G'}</span>`, false, `Gamble on ${pick}: ${w} becomes ${w * 2} or 0 (G)`);
    return `<div class="mains">${f}${collect(s.gamble.revealing)}</div>`;
  }
  if (m === 'payout') return st('<span>Paying…</span><span class="sub">tap to skip the count-up</span>');
  if (m === 'paused') return st('<span>Paused</span><span class="sub">see the message</span>');
  if (!c.total) return st('<span>Place a bet</span><span class="sub">then press START</span>');
  return st(`<span>Start</span><span class="sub">${fmt(c.total)} credits on ${c.count} square${c.count === 1 ? '' : 's'}${dock ? '' : ' · Space'}</span>`, !c.canBet || ui.startLocked);
}

const disclaimer = () => `<p class="rdisc"><b>Play credits only.</b> No real money value. Free refill to 1,000 whenever you run out.</p>`;
const chipGroup = (s, c, keys) => `<div class="grp"><div class="rhead"><span>Chip value</span></div>${chipRow(s, c, keys)}</div>`;

export function controls(s, ui, c, L) {
  // win offer and gamble (win-gamble-offer.png, gamble-flip.png): the note goes above the Collect / Gamble stack
  // and Undo / Clear / Rebet are not shown (they cannot be used until the win is settled)
  const result = c.mode === 'offer' || c.mode === 'ingamble';
  const acts = result ? '' : actionRow(s, c);
  if (L.rail) {
    const r = L.rail;
    const note = railNote(s, ui, c);
    return `<div class="rail" role="region" aria-label="Bet controls" style="left:${px(r.x)};top:${px(r.y)};width:${px(r.w)};height:${px(r.h)}">
      ${betField(s, c)}${chipGroup(s, c, true)}${result ? note : ''}${mainButtons(s, ui, c, false)}${acts}${result ? '' : note}
      <div style="flex:1"></div>${disclaimer()}</div>`;
  }
  // tablet portrait: the rail as a 2-column block (left: bet field, note; right: chips, button, actions)
  const d = L.dock;
  return `<div class="dock" role="region" aria-label="Bet controls" style="left:${px(d.x)};top:${px(d.y)};width:${px(d.w)};height:${px(d.h)};padding:${DOCK_PAD}px 0">
      <div class="dcol">${betField(s, c)}${railNote(s, ui, c)}</div>
      <div class="dcol">${chipGroup(s, c, false)}${mainButtons(s, ui, c, true)}${acts}</div>
      ${disclaimer()}</div>`;
}

// ------------------------------------------------------------------ tiles
// v3 batch 4: flat squares (tokens.md §1). The static part is built once per tile; per state only the tile's
// class list and its .dyn child (bet badge, result veil) change, and during a light run only the class list.
export function tileStatic(n) {
  return `<span class="num">${n}</span><span class="m">${MULT[n]}x</span><span class="dyn"></span>`;
}

/** Per-tile dynamic look: { cls, dyn, disabled, label } (diffed by the controller). */
export function tileLook(n, s, ui, c) {
  const r = s.round;
  const m = MULT[n];
  const cls = [`q${m}`];
  const light = lightClass(n, ui);
  if (light) cls.push(light);
  // v3 batch 5 result look (component sheet): a winning stop is flat accent-green with dark text, a losing stop
  // keeps the tile-lit fill, and in a Double Run both stops show "1st" / "2nd" in place of the square number.
  // No glow, ring, pulse, chase, veil or WIN tag; the only motion is the batch-4 landing pop (transform).
  const { w1, w2 } = winners(s, ui);
  let mark = '', result = '';
  if (r) {
    const revealed = ['GAMBLE_OFFER', 'GAMBLE', 'PAYOUT'].includes(s.phase) || ui.gambleLoss || ui.showLastStop;
    const first = n === r.s1 && (revealed || s.phase === 'DOUBLE_RUN');
    const second = r.s2 && n === r.s2 && revealed;
    if (first || second) {
      result = n === w1 || n === w2 ? 'win' : 'lit';
      if (!light) cls.push(result);
      if (r.doubleRun) {
        cls.push('mk');
        mark = `<span class="mkt">${first ? '1st' : '2nd'}</span>`;
      }
    }
  }
  const live = s.bets[n] || 0;
  const ghostV = !live && c.ghosts && s.lastBets ? s.lastBets[n] || 0 : 0;
  // No veil or lock icon while the light runs (running.png): squares keep their look, so a light step changes
  // classes only. They are still aria-disabled.
  let dyn = mark;
  if (live) dyn += `<span class="bet">${live}</span>`;
  else if (ghostV) dyn += `<span class="bet ghost">${ghostV}</span>`;
  const said = result === 'win' ? ', winning stop' : result ? ', the light stopped here' : '';
  return { cls: cls.join(' '), dyn, disabled: !c.canBet, label: `Square ${n}, pays ${m}x, your bet ${live}${said}` };
}

// ------------------------------------------------------------------ centre panel
const cardOf = (r, n, idx) => {
  const b = r.bets[n] || 0;
  return `<div class="card${b ? ' won' : ''}"><b>${idx ? `${idx} · ` : ''}#${n}</b><span class="cm">${MULT[n]}x</span><span class="cv"><i>${b ? 'Bet × pays' : 'Your bet'}</i><b>${b ? `${b} × ${MULT[n]} = ${fmt(b * MULT[n])}` : 'No bet there'}</b></span></div>`;
};
const pips = (used) => `<span class="pips" aria-hidden="true">${[0, 1, 2].map((i) => `<i${i < used ? ' class="used"' : ''}></i>`).join('')}</span>`;
const leftText = (used) => (used >= MAX_GAMBLES ? 'none left' : `${MAX_GAMBLES - used} of ${MAX_GAMBLES} left`);

export function centreModel(s, ui, c) {
  const r = s.round;
  const m = c.mode;
  const M = {};
  M.dr = !!(r && r.doubleRun && (s.phase === 'DOUBLE_RUN' || ['GAMBLE_OFFER', 'GAMBLE', 'PAYOUT'].includes(s.phase) || ui.showLastStop || ui.gambleLoss));
  if (s.phase === 'ERROR') return { ...M, status: ['coral', 'Paused'], headline: 'Paused', sub: '' };
  if (s.phase === 'RECOVERY') return { ...M, status: ['amber', 'Restoring'], headline: 'Round restored', sub: '' };
  if (s.phase === 'SPINNING' || s.phase === 'RESOLVING') {
    return { ...M, status: ['amber', 'Running'], headline: 'Running…', sub: 'Bets are locked until the light stops.', note: `Credits ${fmt(r.balanceBefore)} − ${fmt(r.totalBet)} bet = <b>${fmt(r.balance)}</b>` };
  }
  if (s.phase === 'DOUBLE_RUN') {
    return { ...M, status: ['cyan', 'Double Run'], headline: 'Double Run!', sub: `A second light is running. #${r.s1} stays lit, and the second light can’t stop on it.`, cards: [cardOf(r, r.s1, 1)] };
  }
  const { w1, w2 } = winners(s, ui);
  const cards = r ? (r.doubleRun ? [cardOf(r, r.s1, 1), cardOf(r, r.s2, 2)] : [cardOf(r, r.s1)]) : [];
  if (m === 'ingamble') {
    const won = w1 && w2 ? `Double Run · won ${fmt(r.baseWin)}` : `#${w1 || w2} · ${MULT[w1 || w2]}x · won ${fmt(r.baseWin)}`;
    return { ...M, gamble: true, status: ui.gambleLoss ? ['coral', 'Gamble lost'] : ['on', 'Gamble'], won };
  }
  M.on = new Set([w1, w2].filter(Boolean).map((n) => MULT[n]));
  if (m === 'offer') {
    const status = MULT[w1] === 1920 || MULT[w2] === 1920 ? ['mint', 'Jackpot'] : r.doubleRun ? ['mint', 'Double Run win'] : ['mint', 'Win'];
    let sub;
    if (r.doubleRun && w1 && w2) sub = `Two squares won this round. A second light ran and could not stop on #${r.s1}.`;
    else if (r.doubleRun && w1) sub = `The second light stopped on #${r.s2} (no bet there).`;
    else if (r.doubleRun) sub = `The first light stopped on #${r.s1} (no bet there).`;
    else sub = c.gambleWhy ? `Collect it. Gamble is off above ${fmt(GAMBLE_CAP)} credits.` : 'Collect it, or gamble it on a fair 50/50.';
    return { ...M, status, headline: `You win ${fmt(r.baseWin)}`, sub, cards, band: true };
  }
  if (m === 'payout') {
    return { ...M, status: ['mint', 'Paid'], headline: `+${fmt(r.currentWin)} collected`, sub: `Added to your credits: ${fmt(s.balance - r.currentWin)} → ${fmt(s.balance)}`, cards };
  }
  // BETTING
  if (ui.showLastStop && r) {
    const sub = r.doubleRun ? `The lights stopped on #${r.s1} and #${r.s2}. Your bets are still on the board.` : `The light stopped on #${r.s1} (${MULT[r.s1]}x). Your bets are still on the board. Press <b>Start</b> to play them again.`;
    return { ...M, status: ['coral', 'No win'], headline: 'No win this time', sub, cards };
  }
  if (c.ghosts) return { ...M, status: ['idle', 'Betting open'], headline: 'Place your bets', sub: `Last round’s bets are shown as outlines. Press Rebet to place all ${totalOf(s.lastBets)} again.` };
  return { ...M, status: ['idle', 'Betting open'], headline: 'Place your bets', sub: 'Pick a chip, tap squares, then press <b>Start</b>.' };
}

/** Navy "Double or nothing" band under a win (win-gamble-offer.png): the fair 50/50, both outcomes, gambles left. */
function gambleBand(s, c) {
  const r = s.round;
  const used = r.gambles.length;
  const what = c.gambleWhy ? gambleWhyText(c.gambleWhy) : `Fair 50/50 · Win → ${fmt(r.currentWin * 2)} · Lose → 0`;
  return `<div class="gband"><b>Double or nothing</b><span>${esc(what)}</span>${pips(used)}<span>${leftText(used)}</span></div>`;
}

function recapText(r, loss) {
  const parts = [];
  let w = r.baseWin;
  r.gambles.forEach((g, i) => {
    if (r.pendingReveal && i === r.gambles.length - 1) return;
    if (loss && i === r.gambles.length - 1) parts.push(`Flip ${i + 1}: you picked ${cap(g.pick)} · ${cap(g.result)} lit`);
    else if (g.pick === g.result) { parts.push(`Flip ${i + 1}: you picked ${cap(g.pick)} · ${cap(g.result)} lit · ${fmt(w)} → ${fmt(w * 2)}`); w *= 2; }
  });
  return parts.join(' · ');
}

/** Gamble (gamble-flip.png): a navy panel in the centre with the two flat discs, the flip disc between them, the
 *  outcome cards and the flips so far. The flip is one element with two faces turned by a 700 ms rotateY (CSS),
 *  ending on the result the engine stored when GAMBLE was pressed. Gamble / Collect stay in the rail. */
function gamblePanel(s, ui, c, L) {
  const r = s.round;
  const loss = ui.gambleLoss;
  const used = r.gambles.length;
  const rev = s.gamble.revealing;
  const pick = loss ? loss.pick : s.gamble.pick;
  const w = loss ? loss.win : r.currentWin;
  const flipNo = loss ? loss.flip : rev ? used : used + 1;
  const shown = rev ? used - 1 : used; // the flip in progress is not used up until it resolves
  const off = !!loss || rev || !!c.gambleWhy;
  const disc = (col) => {
    const sel = pick === col;
    const key = col === 'red' ? 'R / ←' : 'W / →';
    const foot = sel ? '<span class="yp">Your pick</span>' : L.dockMode ? '' : `<span class="gk">key ${key}</span>`;
    return `<button class="pick hit ${col}${sel ? ' sel' : ''}" data-id="pick-${col}" role="radio" aria-checked="${sel}" aria-label="${cap(col)} (key ${col === 'red' ? 'R or left arrow' : 'W or right arrow'})"${dis(off)}><span class="disc"></span><b>${cap(col)}</b>${foot}</button>`;
  };
  // flip disc: turning while the stored result is revealed, then resting on the last result
  const lastRes = used ? r.gambles[used - 1].result : null;
  const turning = rev && ui.flip && !ui.flip.final;
  const mid = lastRes && (rev || loss || ui.flip || ui.matchMsg)
    ? `<span class="flip ${lastRes === 'red' ? 'r' : 'w'}${turning ? ' go' : ''}" aria-hidden="true"><i class="coin"><i class="f"></i><i class="f b"></i></i></span>`
    : '<span class="gor">or</span>';
  let msg;
  if (loss) msg = `<b class="lost">No match.</b> ${cap(loss.result)} lit. Your pick was ${cap(loss.pick)}, so the ${fmt(w)} gamble is lost.`;
  else if (rev) msg = `<b>Flipping…</b> If ${pick} lights, your win doubles.`;
  else if (ui.matchMsg) msg = `<b class="won">Match!</b> ${cap(ui.matchMsg.colour)} lit. Your win is now ${fmt(r.currentWin)}.${c.gambleWhy ? ' Collect it.' : ' Gamble again or collect.'}`;
  else if (c.gambleWhy) msg = `${esc(gambleWhyText(c.gambleWhy))}. Collect your win.`;
  else if (!pick) msg = `Pick red or white for flip ${flipNo}. If your colour lights, your win doubles.`;
  else msg = `You picked ${pick}. If ${pick} lights, your win doubles.`;
  const gc = (k, v, cls = '') => `<div class="gc"><span>${k}</span><b${cls ? ` class="${cls}"` : ''}>${v}</b></div>`;
  const other = pick === 'red' ? 'white' : 'red';
  const cards = loss
    ? gc('Gamble lost', fmt(w), 'lost') + gc('Credits', fmt(s.balance))
    : gc('Current win', `<span data-role="current-win">${fmt(w)}</span>`) + gc(pick ? `${cap(pick)} lights` : 'Match', fmt(w * 2), 'won') + gc(pick ? `${cap(other)} lights` : 'No match', '0');
  const recap = recapText(r, loss);
  return `<div class="gpanel" role="group" aria-label="Double or nothing">
    <div class="ghead"><b>Double or nothing · flip ${flipNo}</b><span class="gl">${pips(shown)}${leftText(shown)}</span></div>
    <div class="gdiscs" role="radiogroup" aria-label="Pick a colour">${disc('red')}${mid}${disc('white')}</div>
    <div class="gmsg" data-role="gamble-instr" aria-live="polite">${msg}</div>
    <div class="gcards"${loss ? ' data-role="gamble-loss"' : ''}>${cards}</div>${recap ? `<div class="grec">${recap}</div>` : ''}</div>
    <div class="gnote">${loss ? `Your credits stay at <b>${fmt(s.balance)}</b>. Nothing else was taken.` : `Gamble is turned off when doubling would go over ${fmt(GAMBLE_CAP)} credits.`}</div>`;
}

/** Centre (v3 batches 4–5): status pills, the big multiplier, a flat title and sub line, the pays row (the won
 *  tiers in green), result cards, and the navy gamble band; or the gamble panel. The number's text is written by
 *  the controller (app.js paintBig), so a light step never rebuilds this region. */
export function centre(s, ui, c, L) {
  const M = centreModel(s, ui, c);
  const I = L.inner;
  const box = (cls, inner) => `<div class="centre${cls}" style="left:${px(I.x)};top:${px(I.y)};width:${px(I.w)};height:${px(I.h)}">${inner}</div>`;
  const st = `<span class="cp ${M.status[0]}" data-role="status">${M.status[1]}</span>`;
  if (M.gamble) return box(' gam', `<div class="cps">${st}<span class="cp mint">${M.won}</span></div>${gamblePanel(s, ui, c, L)}`);
  const dr = `<span class="cp${M.dr ? ' on' : ''}">${M.dr ? 'Double Run on' : `Double Run · 1 in ${DOUBLE_RUN_ONE_IN}`}</span>`;
  const B = bigResult(s, ui);
  const on = M.on || new Set();
  const pays = I.w < 420 ? '' : `<div class="pays">${TIERS.map((m) => `<span class="pay${on.has(m) ? ' on' : ''}"><b>${m}x</b><i>${COUNT_BY_TIER[m]} square${COUNT_BY_TIER[m] > 1 ? 's' : ''}</i></span>`).join('')}</div>`;
  return box('', `<div class="cps">${st}${dr}</div>
    <div class="bigrow"><div class="big${B.win ? ' win' : ''}" aria-hidden="true"><span data-role="big"></span><small>x</small></div>${B.extra ? `<div class="big2" aria-hidden="true">+ ${B.extra}<small>x</small></div>` : ''}</div>
    <div class="ctxt" aria-live="polite"><div class="ctitle" data-role="headline">${M.headline}</div>${M.sub ? `<div class="csub">${M.sub}${M.note ? ` ${M.note}` : ''}</div>` : ''}</div>
    ${pays}${M.cards && M.cards.length ? `<div class="cards">${M.cards.join('')}</div>` : ''}${M.band ? gambleBand(s, c) : ''}`);
}

// ------------------------------------------------------------------ bottom bar (v3 batch 2)
/** 40 px bar across the frame: sound, settings, stats (paytable + help) left; title centre; fairness right. */
export function bottomBar(s, ui, c, L) {
  const b = L.bar;
  const locked = !['BETTING', 'INIT'].includes(s.phase);
  const off = !c.canInfo;
  const lockWhy = !locked ? '' : ['locked', 'paused'].includes(c.mode) ? 'unlocks when the round ends' : 'opens again after you collect';
  const ib = (id, ic, label, d) => `<button class="ibtn hit${d ? '' : ' on'}" data-id="${id}" aria-label="${label}${lockWhy ? `: ${lockWhy}` : ''}"${lockWhy ? ` title="${label}: ${lockWhy}"` : ''}${dis(d)}>${ic}${lockWhy ? `<span class="lk">${icon('lock')}</span>` : ''}</button>`;
  const mute = s.settings.mute;
  const sound = `<button class="ibtn hit on" data-id="icon-sound" role="switch" aria-checked="${!mute}" aria-label="${mute ? 'Sound muted, press to turn on (M)' : 'Sound on, press to mute (M)'}">${icon(mute ? 'mute' : 'sound')}</button>`;
  const tail = b.w >= 640 ? ' · Play credits only · No real money value' : ' · Play credits only';
  return `<div class="bbar" role="toolbar" aria-label="Sound, settings and game info" style="left:${px(b.x)};top:${px(b.y)};width:${px(b.w)};height:${px(b.h)}">
    <div class="bb-l">${sound}${ib('icon-settings', icon('gear'), 'Settings', off)}${ib('icon-stats', v3icon('stats'), 'Paytable and help', off)}</div>
    <div class="bb-c">${v3mark()}<span><b>Running Light</b>${tail}</span></div>
    <div class="bb-r">${ib('icon-fair', v3icon('scales'), 'How results are decided', off)}</div></div>`;
}

// ------------------------------------------------------------------ tooltip / long-press sheet
export function tooltip(n, s, L, sheet) {
  const { x, y, side } = L.pos[n];
  const m = MULT[n];
  const w = 250 * L.s + 20 + (sheet ? 30 : 0);
  const f = fs(L, 14, 12);
  let l = side === 'left' ? x + L.tile.w + 14 : x - w - 14;
  let arrow = side === 'left' ? 'arrow-left' : 'arrow-right';
  if (l < 4) { l = x + L.tile.w + 14; arrow = 'arrow-left'; }
  if (l + w > L.W - 4) { l = L.W - w - 4; arrow = 'arrow-up'; }
  const t = Math.max(L.header + 4, Math.min(y - 10, L.H - 190));
  const bet = s.bets[n] || 0;
  const foot = sheet
    ? `<div class="tbtns"><button class="btn sec hit" data-id="tip-remove" aria-label="Remove ${s.chip} from square ${n}"${dis(!bet)}>−${s.chip}</button><button class="btn cta hit" data-id="tip-add" aria-label="Add ${s.chip} to square ${n}"${dis(bet >= 10)}>+${s.chip}</button></div>`
    : `<div class="lo" style="margin-top:6px;font-weight:600;font-size:${px(f * 0.86)}">Click +${s.chip} · Right-click −${s.chip}</div>`;
  return `<div class="tip ${arrow}${sheet ? ' sheet' : ''}" role="${sheet ? 'dialog' : 'tooltip'}" aria-label="Square ${n}" style="left:${px(l)};top:${px(t)};width:${px(w)};padding:${px(12 * L.s)} ${px(14 * L.s)};font-size:${px(f)}">
    <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:${px(f * 1.1)}">Square ${n} ${tierBand(m, f * 0.85, f * 1.4)}</div>
    <div class="muted" style="margin-top:6px;font-weight:600;line-height:1.45">Pays <b style="color:var(--c-text-hi)">${m}× your bet</b> (incl. stake)<br>Hit chance per round ≈ ${ODDS[m]}<br>Your bet: ${bet} / 10</div>${foot}</div>`;
}

// ------------------------------------------------------------------ toast
export function toastHtml(t, L) {
  if (!t) return '';
  const f = fs(L, 15, 12);
  let l, tp, w;
  if (L.dockMode) { w = Math.min(L.inner.w - 12, 420); l = (L.W - w) / 2; tp = L.inner.y + L.inner.h - 64; }
  else { w = L.rail.w - 2 * (L.bp === 'desktop-xl' ? 24 : 14); l = L.rail.x + (L.rail.w - w) / 2; tp = L.rail.y + L.rail.h - (L.bp === 'desktop-xl' ? 170 : 130); }
  const kind = t.kind === 'ok' ? 'ok' : t.kind === 'info' ? 'info' : '';
  const ic = kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert';
  return `<div class="toast ${kind}${t.out ? ' out' : ''}" role="status" style="left:${px(l)};top:${px(tp)};width:${px(w)};padding:12px 14px;font-size:${px(f)}">${icon(ic)}<span data-role="toast">${esc(t.text)}</span></div>`;
}

// ------------------------------------------------------------------ modals
function frame(L, mw, mh, opts = {}) {
  let box, scrim;
  if (L.dockMode) {
    const top = Math.max(L.header + 8, L.H - (opts.sheetH || mh));
    box = { x: 0, y: top, w: L.W, h: L.H - top, sheet: true };
    scrim = '<div class="scrim"></div>';
  } else if (opts.full) {
    mw = Math.min(mw, L.W - 32);
    mh = Math.min(mh, L.H - L.header - 24);
    box = { x: (L.W - mw) / 2, y: L.header + (L.H - L.header - mh) / 2, w: mw, h: mh };
    scrim = '<div class="scrim"></div>';
  } else {
    const st = L.stage;
    mw = Math.min(mw, st.w - 24);
    mh = Math.min(mh, st.h - 24);
    box = { x: st.x + (st.w - mw) / 2, y: st.y + (st.h - mh) / 2, w: mw, h: mh };
    scrim = `<div class="scrim" style="left:${px(st.x)};top:${px(st.y)};width:${px(st.w)};height:${px(st.h)};border-radius:var(--r-xl)"></div>`;
  }
  return { box, scrim };
}
const open = (b, pad, label, extraCls = '', extra = '') => `<div class="modal${b.sheet ? ' sheet' : ''}${extraCls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" style="left:${px(b.x)};top:${px(b.y)};width:${px(b.w)};height:${px(b.h)};${extra}">${b.sheet ? '<div class="grab"></div>' : ''}<div class="mbody" style="padding:${px(pad)}">`;
const bigBtn = (id, cls, inner, h, f, w = '100%', d = false, label = '') => `<button class="btn ${cls} stack hit" data-id="${id}"${label ? ` aria-label="${esc(label)}"` : ''}${dis(d)} style="width:${w};height:${px(h)};font-size:${px(f)}">${inner}</button>`;

export function refillModal(s, ui, L) {
  const xl = L.bp === 'desktop-xl';
  const { box, scrim } = frame(L, xl ? 600 : 500, xl ? 560 : 470, { sheetH: 504 });
  const k = xl ? 1 : 0.85;
  let h = scrim + open(box, 30 * k, 'Out of play credits', '', 'text-align:center');
  h += `<div style="display:flex;flex-direction:column;align-items:center;gap:${px(14 * k)};height:100%">${ringBulbs(L.dockMode ? 64 : 96 * k, 12, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])}`;
  h += `<div class="mtitle" style="font-size:${px(30 * k)}">Out of play credits</div>`;
  h += `<div class="muted" style="font-size:${px(16 * k + 1)};font-weight:600;line-height:1.5;max-width:420px">Take a free refill and keep playing. Refills are <b style="color:var(--c-text-hi)">unlimited</b>, with no waiting and no cost.</div>`;
  h += `<div class="field" style="padding:12px 22px;display:flex;align-items:center;gap:12px"><span class="sect-lbl">Free refill</span><span class="val amber" style="font-size:${px(34 * k)};margin:0">1,000</span></div>`;
  h += `<div style="flex:1"></div>${bigBtn('m-refill', 'cta', '<span>Refill 1,000</span><span class="sub">free · Enter</span>', L.dockMode ? 60 : 76 * k, 26 * k, '100%', false, 'Refill 1,000 play credits, free (Enter)')}`;
  return `${h}<div class="lo" style="font-size:12px;font-weight:700">Play credits only. No real money value.</div></div></div></div>`;
}

export function errorCode(err) {
  if (!err) return 'E-UNKNOWN';
  if (err.key) return `E-CORRUPT-${err.key.split('.').pop().toUpperCase()}`;
  if (/storage|quota|setItem/i.test(err.message)) return 'E-STORAGE-WRITE';
  return 'E-RUNTIME';
}

export function errorModal(s, L) {
  const xl = L.bp === 'desktop-xl';
  const { box, scrim } = frame(L, xl ? 620 : 520, xl ? 500 : 430, { full: true, sheetH: 464 });
  const k = xl ? 1 : 0.85;
  const r = s.round;
  let h = scrim + open(box, 30 * k, 'Something went wrong', ' err');
  h += `<div style="display:flex;flex-direction:column;gap:${px(14 * k)};height:100%"><div class="mhead"><span class="mic" style="width:${px(44 * k)};height:${px(44 * k)};background:rgba(255,93,115,.14);color:var(--c-coral)">${icon('alert')}</span><span class="mtitle" style="font-size:${px(28 * k)}">Something went wrong</span></div>`;
  h += `<div style="font-size:${px(16 * k + 1)};font-weight:600;line-height:1.5">The game paused to keep your round safe. <span class="muted">Your bet and its result are already saved on this device, so reloading won’t change the outcome or charge you again.</span></div>`;
  const pending = r && !r.settled;
  h += `<div class="notice" style="padding:10px 14px;font-size:13px">${icon('info')}<span>${pending ? `Round in progress: bet ${fmt(r.totalBet)} · ${Object.keys(r.bets).length} squares · credits ${fmt(s.balance)} · code <b>${errorCode(s.error)}</b>` : `Nothing was in progress. Reload to continue. · code <b>${errorCode(s.error)}</b>`}</span></div>`;
  h += `<div style="flex:1"></div>${bigBtn('m-reload', 'cta', `<span class="row1">${icon('reload')}Reload</span><span class="sub">restores your round · Enter</span>`, L.dockMode ? 60 : 76 * k, 26 * k, '100%', false, 'Reload: restores your round (Enter)')}</div>`;
  return `${h}</div></div>`;
}

export function recoveryModal(s, L) {
  const xl = L.bp === 'desktop-xl';
  const { box, scrim } = frame(L, xl ? 640 : 540, xl ? 560 : 480, { full: true, sheetH: 504 });
  const k = xl ? 1 : 0.85;
  const r = s.round;
  const stage = { SPINNING: ['Light running', 'Show the stored stop, then settle'], RESOLVING: ['Light stopped', 'Show the stored stop, then settle'], DOUBLE_RUN: ['Double Run running', 'Show both stored stops, then settle'], GAMBLE_OFFER: ['Win offered', 'Show the win, then Collect or Gamble'], GAMBLE: ['Gamble in progress', 'Finish the stored gamble'], PAYOUT: ['Paying out', 'Finish the payout'] }[r.phase] || ['—', '—'];
  let h = scrim + open(box, 30 * k, 'Round restored');
  h += `<div style="display:flex;flex-direction:column;gap:${px(14 * k)};height:100%"><div class="mhead"><span class="mic" style="width:${px(44 * k)};height:${px(44 * k)};background:rgba(255,183,43,.14);color:var(--c-amber)">${icon('reload')}</span><span class="mtitle" style="font-size:${px(28 * k)}">Round restored</span></div>`;
  h += `<div class="muted" style="font-size:${px(16 * k + 1)};font-weight:600;line-height:1.5">Your last round was interrupted. Its result was decided before the light started, and Continue shows that same result. Nothing is redrawn.</div>`;
  const row = (a, b) => `<div class="srow" style="padding:${px(10 * k)} 0;font-size:${px(15 * k + 1)};font-weight:700"><span class="muted">${a}</span><span>${b}</span></div>`;
  h += `<div>${row('Bet already taken', `${fmt(r.totalBet)} credits · ${Object.keys(r.bets).length} squares`)}${row('Stage', stage[0])}${row('Credits now', fmt(s.balance))}${row('Next', stage[1])}</div>`;
  h += `<div style="flex:1"></div>${bigBtn('m-continue', 'cta', '<span>Continue</span><span class="sub">show my result · Enter</span>', L.dockMode ? 60 : 76 * k, 26 * k, '100%', false, 'Continue: show my result (Enter)')}</div>`;
  return `${h}</div></div>`;
}

export function infoModal(s, ui, L) {
  const tab = s.info;
  const xl = L.bp === 'desktop-xl';
  const { box, scrim } = frame(L, xl ? 1100 : L.bp === 'desktop' ? 880 : 760, xl ? 820 : L.bp === 'desktop' ? 600 : 640, { full: true, sheetH: L.H });
  const k = xl ? 1 : 0.8;
  const pad = 28 * k;
  const title = { settings: 'Settings', paytable: 'Paytable', help: 'How to play' }[tab];
  let h = scrim + open(box, pad, title);
  h += `<div class="mhead" style="margin-bottom:${px(14 * k)}"><span class="mtitle" style="font-size:${px(28 * k)}">${title}</span><span class="x"><button class="ibtn hit on" data-id="close" aria-label="Close (Esc)" style="width:${px(40 * k)};height:${px(40 * k)}">${icon('x')}</button></span></div>`;
  h += `<div class="tabs" role="tablist" style="margin-bottom:${px(18 * k)};font-size:${px(15 * k + 1)}">${[['settings', 'gear', 'Settings'], ['paytable', 'table', 'Paytable'], ['help', 'help', 'Help']].map(([id, ic, l]) => `<button class="t hit${tab === id ? ' on' : ''}" data-id="tab-${id}" role="tab" aria-selected="${tab === id}" style="height:${px(44 * k)}">${icon(ic)}${l}</button>`).join('')}</div>`;
  const bodyW = box.w - 2 * pad;
  h += `<div style="flex:1;overflow:auto" role="tabpanel">${tab === 'settings' ? settingsBody(s, ui, k) : tab === 'paytable' ? paytableBody(k, bodyW, L) : helpBody(k, L)}</div>`;
  h += `<div class="lo" style="font-size:12px;font-weight:600;text-align:center;margin-top:10px">Esc closes this window · Play credits only. No real money value.</div>`;
  return `${h}</div></div>`;
}

/** Fairness panel (bottom-bar scales icon): how the engine decides results. Plain facts only; there is no seed
 *  verification, so nothing here may suggest one. Numbers come from engine/config.js. */
export function fairnessModal(L) {
  const xl = L.bp === 'desktop-xl';
  const { box, scrim } = frame(L, xl ? 640 : 560, xl ? 600 : 540, { full: true, sheetH: 560 });
  const k = xl ? 1 : 0.85;
  const f = 15 * k + 1;
  let h = scrim + open(box, 28 * k, 'How results are decided');
  h += `<div class="mhead" style="margin-bottom:${px(12 * k)}"><span class="mtitle" style="font-size:${px(24 * k)}">How results are decided</span><span class="x"><button class="ibtn hit on" data-id="f-close" aria-label="Close (Esc)" style="width:${px(36 * k)};height:${px(36 * k)}">${icon('x')}</button></span></div>`;
  const weights = TIERS.map((t) => WEIGHT_BY_TIER[t]).join(' / ');
  const item = (a, b) => `<li><b>${a}</b> <span class="muted">${b}</span></li>`;
  h += `<ul class="facts" data-role="fairness" style="font-size:${px(f)};gap:${px(12 * k)}">
    ${item('Drawn first.', 'When you press START, the result is drawn and saved on this device before the light starts. The animation only shows that saved result; reloading shows the same one.')}
    ${item('Weighted by 1 ÷ multiplier.', `Each square’s chance is proportional to 1 ÷ what it pays: weights ${weights} of ${fmt(TOTAL_WEIGHT)} for ${TIERS.map((t) => `${t}x`).join(' / ')}. Higher pays are rarer.`)}
    ${item(`Double Run, 1 in ${DOUBLE_RUN_ONE_IN}.`, 'Drawn in the same step. The second light never stops on the first square.')}
    ${item('Gamble, 50/50.', 'Red or white is drawn when you press GAMBLE, before the flip animation.')}
    ${item('RTP about 95.45%.', 'The theoretical long-run average return. Any session can be higher or lower.')}
    ${item('Randomness.', 'Your browser’s built-in crypto random number generator, on this device. Nothing is sent anywhere.')}</ul>`;
  h += '<div style="flex:1"></div><div class="lo" style="font-size:12px;font-weight:600;text-align:center;margin-top:10px">Esc closes this window · Play credits only. No real money value.</div>';
  return `${h}</div></div>`;
}

function settingsBody(s, ui, k) {
  const st = s.settings;
  const f = 16 * k + 1;
  const rowP = 16 * k;
  const tg = (id, on, label, d = false) => `<button class="toggle hit${on ? ' on' : ''}" data-id="${id}" role="switch" aria-checked="${on}" aria-label="${label}"${dis(d)}><i></i></button>`;
  const sl = (id, key, label) => `<span class="sl" style="width:${px(300 * k)}"><span class="slider hit" data-id="${id}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st[key]}"><i style="width:${st[key]}%"></i><b style="left:${st[key]}%"></b></span><span class="v">${st[key]}</span></span>`;
  const row = (ic, a, sub, ctl) => `<div class="srow" style="padding:${px(rowP)} 0;font-size:${px(f)}"><span class="lab">${icon(ic)}<span><b>${a}</b>${sub ? `<br><span class="lo" style="font-size:${px(f * 0.82)};font-weight:600">${sub}</span>` : ''}</span></span>${ctl}</div>`;
  let h = '';
  if (ui.settingsReset) h += `<div class="notice warn" data-role="settings-reset" style="padding:12px 14px;font-size:${px(f * 0.88)};margin-bottom:6px">${icon('info')}<span>Your saved settings couldn’t be read, so they were reset to the defaults. Your credits and rounds were not affected.</span></div>`;
  h += row(st.mute ? 'mute' : 'sound', 'Sound', 'Master on/off · key M', tg('tg-mute', !st.mute, 'Sound'));
  h += row('music', 'Music', 'Perya brass loop', sl('sl-music', 'music', 'Music volume'));
  h += row('sfx', 'Sound effects', 'Clicks, bulbs, wins', sl('sl-sfx', 'sfx', 'Sound effects volume'));
  h += row('motion', 'Reduced motion', 'No chase, trail or flashes. Follows your system setting.', tg('tg-rm', st.reducedMotion, 'Reduced motion'));
  h += row('bolt', 'Turbo', '<span class="badge-ph">PLACEHOLDER – pending approval</span>', tg('tg-turbo', false, 'Turbo (placeholder, not available)', true));
  return h;
}

function paytableBody(k, w, L) {
  const f = 15 * k + 1;
  const cp = 12 * k;
  let h = `<div style="display:flex;gap:${px(24 * k)}"><div style="flex:1.25">`;
  h += `<table class="pt" style="font-size:${px(f)}"><tr><th style="padding:${px(cp)} 4px">Pays</th><th class="r">Squares</th><th class="r">Per stop</th><th class="r">Per round</th><th class="r">1 credit wins</th></tr>`;
  for (const t of TIERS) h += `<tr><td style="padding:${px(cp)} 4px">${tierBand(t, f * 0.85, f * 1.6)}</td><td class="r">${COUNT_BY_TIER[t]}</td><td class="r">${(pStop(t) * 100).toFixed(4)}%</td><td class="r">${ODDS[t]}</td><td class="r">${fmt(t)}</td></tr>`;
  h += `</table><div class="lo" style="font-size:${px(f * 0.8)};font-weight:600;margin-top:8px;line-height:1.45">Multiplier = total return including your stake (5 on 96x returns 480). “Per round” includes Double Run. Stop weights ${TIERS.map((t) => WEIGHT_BY_TIER[t]).join('/')} of ${fmt(TOTAL_WEIGHT)}.</div></div>`;
  h += `<div style="flex:1;display:flex;flex-direction:column;gap:${px(10 * k)}">`;
  const rule = (ic, a, b) => `<div class="notice" style="padding:${px(10 * k + 2)} 12px;font-size:${px(f * 0.9)}">${icon(ic)}<span><b>${a}</b><br><span class="muted">${b}</span></span></div>`;
  h += rule('star', 'Double Run · 1 in 25 rounds', 'A second light runs after the first stops. It never stops on the same square. Each square pays once.');
  h += rule('rebet', 'Gamble · fair 50/50', 'Pick red or white, up to 3 times per win. Collect any time. Off when doubling would pass 30,000.');
  h += rule('table', 'Limits', '1–10 credits per square · 1–200 per round · chips 1/5/10/25/50.');
  h += `<div class="notice ok" style="padding:${px(10 * k + 2)} 12px;font-size:${px(f * 0.9)};align-items:center"><span class="val mint" style="font-size:${px(24 * k + 4)};flex:none;font-weight:800">≈95.45%</span><span class="muted">RTP: theoretical long-run average return. Play credits only.</span></div></div></div>`;
  {
    const p = Math.min(w / 16, 30 * k), ts = p - 3;
    let mm = '';
    for (let n = 1; n <= 50; n++) {
      const [c, r] = cell(n);
      if (r !== 0 && r !== 10) continue;
      mm += `<div class="abs t${MULT[n]}" style="left:${px(c * p)};top:${px(r === 0 ? 0 : ts + 6)};width:${px(ts)};height:${px(ts)};border-radius:4px;font-size:9px;font-weight:800;display:grid;place-items:center">${n}</div>`;
    }
    h += `<div style="margin-top:${px(16 * k)}"><div class="sect-lbl" style="font-size:11px;margin-bottom:8px"><span>Board map (fixed layout) · top row #1–16 and bottom row #41–26</span><span class="r">sides: 96x/24x alternate · 960x on #21 and #46</span></div><div style="position:relative;height:${px(2 * ts + 6)}">${mm}</div></div>`;
  }
  return h;
}

function helpBody(k, L) {
  const f = 15 * k + 1;
  const steps = [['1', 'Pick a chip', '1, 5, 10, 25 or 50 credits.'], ['2', 'Place bets', 'Tap or click squares, up to 10 per square and 200 per round.'], ['3', 'Press START', 'The light runs for 4–6 seconds and stops on one square.'], ['4', 'Collect or gamble', 'Win on any square with a bet, then Collect or gamble on red or white.']];
  let h = `<div style="display:flex;gap:${px(24 * k)}"><div style="flex:1;display:flex;flex-direction:column;gap:${px(10 * k)}">`;
  for (const st of steps) h += `<div class="notice" style="padding:${px(12 * k + 2)}px;font-size:${px(f)};align-items:center;padding:${px(12 * k + 2)}"><span class="disp" style="width:34px;height:34px;flex:none;border-radius:50%;background:var(--c-amber);color:var(--c-amber-ink);display:grid;place-items:center;font-size:16px">${st[0]}</span><span><b>${st[1]}</b><br><span class="muted" style="font-size:${px(f * 0.9)}">${st[2]}</span></span></div>`;
  h += `<div class="notice ok" style="padding:${px(14 * k + 2)};font-size:${px(f * 1.05)};font-weight:800;align-items:center">${icon('shield')}<span style="color:var(--c-text-hi)">Play credits only. No real money value.<br><span class="muted" style="font-weight:600;font-size:${px(f * 0.86)}">Credits can’t be bought, sold or cashed out. Free refill to 1,000 whenever you run out.</span></span></div></div>`;
  {
    const keys = [['1–5', 'Select chip'], ['Click · Enter', 'Add chip to square'], ['Right-click · Shift+click · Backspace', 'Remove chip'], ['Space', 'START · press the focused button'], ['Ctrl+Z / Z · C · R', 'Undo · Clear · Rebet'], ['G · Enter', 'Gamble · Collect'], ['R / W · ← / →', 'Pick red / white (gamble window)'], ['M', 'Mute'], ['Tab · arrows', 'Move focus around the track'], ['Esc', 'Close this window']];
    h += `<div style="flex:1"><div class="sect-lbl" style="font-size:11px;margin-bottom:6px"><span>Keyboard</span></div><table class="pt kbd-table" style="font-size:${px(f * 0.92)}">${keys.map(([a, b]) => `<tr><td style="padding:${px(8 * k + 1)} 4px;white-space:nowrap">${a.split(' · ').map(kc).join(' ')}</td><td class="muted" style="font-weight:600">${b}</td></tr>`).join('')}</table><div class="notice" style="padding:12px;font-size:13px;margin-top:12px">${icon('info')}<span><b>Touch tips</b><br><span class="muted">Tap a square to add the selected chip. Long-press a square to see what it pays or to remove a chip.</span></span></div></div>`;
  }
  return `${h}</div>`;
}

// ------------------------------------------------------------------ rings, start, loading
export function ringBulbs(size, n, onIdx, t1 = [], t2 = []) {
  let s = '';
  const b = size * 0.16;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = size / 2 + Math.cos(a) * (size / 2 - b / 2) - b / 2, y = size / 2 + Math.sin(a) * (size / 2 - b / 2) - b / 2;
    s += `<i class="${onIdx.includes(i) ? 'on' : t1.includes(i) ? 't1' : t2.includes(i) ? 't2' : ''}" style="left:${px(x)};top:${px(y)};width:${px(b)};height:${px(b)}"></i>`;
  }
  return `<div class="ring" aria-hidden="true" style="width:${px(size)};height:${px(size)}">${s}</div>`;
}

export function startScreen(s, ui, L) {
  const k = L.dockMode ? 0.8 : Math.min(1, L.H / 1080 + 0.08);
  const ring = 300 * k;
  const step = ui.ringStep || 0;
  const on = [0, 7, 14].map((i) => (i + step) % 20);
  const t1 = on.map((i) => (i + 19) % 20), t2 = on.map((i) => (i + 18) % 20);
  const bw = Math.min(L.W - 48, 420);
  return `<div class="bg"></div>${bunting(L.W, 56)}<div class="content" style="gap:${px(26 * k)}">
    <div style="position:relative;width:${px(ring)};height:${px(ring)};display:grid;place-items:center">${ringBulbs(ring, 20, on, t1, t2)}<div class="abs" style="inset:${px(ring * 0.2)};display:flex;flex-direction:column;align-items:center;justify-content:center"><h1 class="disp" style="font-size:${px(54 * k)};line-height:.95;text-align:center;font-weight:400">Running<br><span class="amber">Light</span></h1></div></div>
    <div class="muted" style="font-size:${px(18 * k + 3)};font-weight:600;text-align:center;max-width:${px(Math.min(L.W - 40, 560))};line-height:1.45">Bet play credits on the 50-bulb track. The light runs, slows… and stops.</div>
    <div class="pill" style="font-size:${px(16 * k + 2)};padding:8px 16px;gap:10px"><span class="pc" style="width:22px;height:22px;font-size:9px">CR</span><b>${fmt(s.balance)}</b> <span class="lo">play credits</span></div>
    <div style="display:flex;flex-direction:column;gap:12px;width:${px(bw)}">${bigBtn('start-play', 'cta', '<span>Play</span><span class="sub">turns sound on · Enter</span>', 84 * k + 8, 34 * k + 4, '100%', false, 'Play: turns sound on (Enter)')}
      <div class="row" style="gap:12px"><button class="btn sec hit" data-id="start-help" style="width:${px((bw - 12) / 2)};height:${px(52 * k + 6)};font-size:${px(15 * k + 3)}">${icon('help')}<span>How to play</span></button><button class="btn sec hit" data-id="start-sound" role="switch" aria-checked="${!s.settings.mute}" style="width:${px((bw - 12) / 2)};height:${px(52 * k + 6)};font-size:${px(15 * k + 3)}">${icon(s.settings.mute ? 'mute' : 'sound')}<span>Sound: ${s.settings.mute ? 'off' : 'on'}</span></button></div></div></div>
    <div class="foot" style="bottom:${px(24 * k)};font-size:${px(13 * k + 3)}">Play credits only · No real money value · Free refill to 1,000</div>`;
}

export function loadingScreen(W, H, p, step, label) {
  const k = W < 600 ? 0.7 : Math.min(1, H / 1080 + 0.1);
  const on = step % 16;
  const reduced = step < 0;
  return `<div class="bg"></div>${bunting(W, 56)}<div class="content" style="gap:${px(28 * k)}">
    ${ringBulbs(200 * k, 16, reduced ? [] : [on], reduced ? [] : [(on + 15) % 16], reduced ? [] : [(on + 14) % 16])}
    <div class="disp" style="font-size:${px(64 * k)};line-height:1;text-align:center">Running <span class="amber">Light</span></div>
    <div style="width:${px(Math.min(W - 48, 420))}"><div class="bar" style="height:8px"><i style="width:${Math.round(p * 100)}%"></i></div><div class="row lo" style="justify-content:space-between;margin-top:10px;font-weight:700;font-size:${px(14 * k + 2)}"><span>${label}</span><span>${Math.round(p * 100)}%</span></div></div></div>
    <div class="foot" style="bottom:${px(28 * k)};font-size:${px(13 * k + 2)}">Play credits only · No real money value</div>`;
}
