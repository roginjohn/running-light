// v2 view: pure functions from (engine state, UI state, derived context, layout) to HTML strings per region.
// No outcome logic here: every number shown comes from the engine state (stored round) or simple display arithmetic.
import { MULT, TIERS, COUNT_BY_TIER, WEIGHT_BY_TIER, TOTAL_WEIGHT, CHIPS, pRound, pStop, GAMBLE_CAP, MAX_GAMBLES, HISTORY_SHOWN } from '../engine/config.js';
import { totalOf } from '../engine/bets.js';
import { icon, star, logoMark, chipSvg } from './icons.js';
import { cell } from './layout.js';
import { winTagRect } from './layout.js';

export const fmt = (n) => Number(n).toLocaleString('en-US');
const px = (v) => `${Math.round(v * 100) / 100}px`;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fs = (L, v, min) => Math.max(min, v * L.s);
const kc = (k) => `<span class="kc">${k}</span>`;
const dis = (d) => (d ? ' aria-disabled="true"' : '');
const UP = (c) => c.toUpperCase();

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

/** Winning squares of the current round (only once revealed). */
export function winners(s, ui) {
  const r = s.round;
  if (!r) return { w1: null, w2: null };
  const revealed = ['GAMBLE_OFFER', 'GAMBLE', 'PAYOUT'].includes(s.phase) || ui.gambleLoss;
  const w1 = (revealed || s.phase === 'DOUBLE_RUN') && r.bets[r.s1] ? r.s1 : null;
  const w2 = revealed && r.s2 && r.bets[r.s2] ? r.s2 : null;
  return { w1, w2 };
}

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

export function header(s, ui, L) {
  const hh = L.header;
  const f = fs(L, 22, 16);
  const bf = fs(L, 26, 18);
  const bal = ui.displayBalance == null ? s.balance : ui.displayBalance;
  const delta = ui.delta ? `<span class="delta" style="font-size:${px(bf * 0.55)}">+${fmt(ui.delta)}</span>` : '';
  return `${bunting(L.W, hh)}
  <div class="logo" style="margin-left:${px(L.rail ? L.rail.x + 4 : 16)};font-size:${px(f)}">${logoMark()}<span class="word">Running <b>Light</b></span></div>
  <div class="balance" aria-label="Play credits ${fmt(s.balance)}" style="height:${px(hh * 0.66)};font-size:${px(bf)}"><span class="k">Play credits</span><span class="pc" style="width:${px(bf * 0.9)};height:${px(bf * 0.9)};font-size:${px(bf * 0.42)}">CR</span><span class="v" data-role="balance">${fmt(bal)}</span>${delta}</div>
  <div class="hdr-right" style="margin-right:${px(L.rail ? L.rail.x : 16)}">${L.W >= 1100 ? `<span class="tagline" style="font-size:${px(fs(L, 12, 10))};padding:${px(6 * L.s)} ${px(12 * L.s)}">Play credits only · No real money value</span>` : ''}</div>`;
}

// ------------------------------------------------------------------ controls (rail / dock)
function chipRow(s, c, size, gap, keys) {
  const off = c.mode !== 'bet' || !c.canBet;
  return `<div class="chips" role="radiogroup" aria-label="Chip value" style="gap:${px(gap)};--chip:${px(size)}">${CHIPS.map((v, i) => {
    const sel = s.chip === v;
    return `<button class="chip hit${sel && !off ? ' sel' : ''}" data-id="chip-${v}" role="radio" aria-checked="${sel}" aria-label="Chip ${v}${keys ? `, key ${i + 1}` : ''}"${dis(off)}>${chipSvg(v)}${keys ? `<span class="ck">${i + 1}</span>` : ''}</button>`;
  }).join('')}</div>`;
}

function totalBetField(s, c, L, h, compact) {
  const total = c.total;
  const pct = Math.min(100, (total / 200) * 100);
  return `<div class="field${compact ? ' compact' : ''}" style="height:${px(h)}">
    <div class="sect-lbl"><span>Total bet</span><span class="r">${total} / 200</span></div>
    <div class="val" data-role="total">${fmt(total)}</div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    ${compact ? '' : '<div class="note">1–10 per square · max 200 per round</div>'}</div>`;
}

export function lastWin(s, ui, c) {
  const r = s.round;
  const m = c.mode;
  if (s.phase === 'DOUBLE_RUN' && r) {
    const w1 = (r.bets[r.s1] || 0) * MULT[r.s1];
    return { label: 'This round', value: w1, note: 'so far · second light running', tone: w1 ? '' : '', pending: false };
  }
  if (ui.gambleLoss) return { label: 'Last win', value: 0, note: 'gamble lost', tone: 'coral', lost: true };
  if (m === 'offer') return { label: 'Last win', value: r.currentWin, note: 'not yet collected', tag: 'Uncollected', tone: 'mint', pending: true };
  if (m === 'ingamble') return { label: 'Last win', value: r.currentWin, note: 'in gamble · not collected', tag: 'In gamble', tone: 'mint', pending: true };
  if (m === 'payout') return { label: 'Last win', value: r.currentWin, note: 'collected', tone: 'mint' };
  const lw = s.lastWin;
  if (m === 'bet' && lw.kind === 'loss') return { label: 'Last win', value: 0, note: 'no win this round' };
  if (m === 'bet' && lw.kind === 'paid') {
    const lost = r && r.gambles.length && r.currentWin === 0;
    return { label: 'Last win', value: lw.value, note: lost ? 'gamble lost' : 'last round' };
  }
  return { label: 'Last win', value: 0, note: 'credits' };
}

function lastWinField(s, ui, c, h, compact) {
  const lw = lastWin(s, ui, c);
  const v = ui.displayWin == null ? lw.value : ui.displayWin;
  return `<div class="field${compact ? ' compact' : ''}${lw.pending ? ' pending' : ''}${lw.lost ? ' lost' : ''}" style="height:${px(h)}">
    <div class="sect-lbl"><span>${lw.label}</span>${lw.tag ? `<span class="mint" style="letter-spacing:.06em">${lw.tag}</span>` : ''}</div>
    <div class="val ${lw.tone || ''}" data-role="lastwin">${fmt(v)}</div>
    ${compact ? '' : `<div class="note">${lw.note}</div>`}</div>`;
}

function actionRow(s, c, w, h, f, iconOnly) {
  const off = c.mode !== 'bet' || !c.canBet;
  const undoDis = off || !s.undo.length, clearDis = off || !c.total;
  const ghostsShown = c.ghosts;
  const rebetDis = off || !!c.rebetWhy || c.rebetSame;
  const one = (id, ic, label, key, d, hi, title) => `<button class="btn sec hit${hi ? ' hi' : ''}" data-id="${id}" aria-label="${label} (key ${key})"${title ? ` title="${esc(title)}"` : ''}${dis(d)} style="width:${px((w - 16) / 3)};height:${px(h)};font-size:${px(f)}">${icon(ic)}${iconOnly ? '' : `<span>${label}</span>${kc(key)}`}</button>`;
  const lastT = s.lastBets ? totalOf(s.lastBets) : 0;
  return `<div class="row" style="gap:8px">${one('btn-undo', 'undo', 'Undo', 'Z', undoDis)}${one('btn-clear', 'clear', 'Clear', 'C', clearDis)}${one('btn-rebet', 'rebet', ghostsShown && !c.rebetWhy ? `Rebet ${lastT}` : 'Rebet', 'R', rebetDis, ghostsShown && !rebetDis, c.rebetWhy && s.lastBets ? c.rebetWhy : '')}</div>`;
}

function mainButtons(s, ui, c, w, h, f, dock) {
  const m = c.mode;
  const r = s.round;
  const st = (inner, d = true, cls = 'cta stack', ff = f) => `<button class="btn ${cls} hit" data-id="btn-start"${dis(d)} style="width:${px(w)};height:${px(h)};font-size:${px(ff)}">${inner}</button>`;
  if (m === 'offer') {
    const gw = c.gambleWhy;
    const gwText = gw === 'cap' ? 'Doubling would go over the 30,000 cap' : gw === 'max' ? 'No gambles left for this win' : '';
    return `<div class="row" style="gap:10px">
      <button class="btn cta stack hit" data-id="btn-collect" aria-label="Collect ${fmt(r.currentWin)} to credits (Enter)" style="width:${px((w - 10) * 0.55)};height:${px(h)};font-size:${px(f * 0.88)}"><span>Collect</span><span class="sub" style="font-size:.5em">${fmt(r.currentWin)} → credits${dock ? '' : ' · Enter'}</span></button>
      <button class="btn gam stack hit" data-id="btn-gamble" aria-label="Gamble times 2, fair 50/50 (G)"${gwText ? ` title="${esc(gwText)}"` : ''}${dis(!!gw)} style="width:${px((w - 10) * 0.45)};height:${px(h)};font-size:${px(f * 0.6)}"><span>Gamble ×2</span><span class="sub" style="display:flex;gap:.45em;align-items:center;font-size:.62em">${gw ? esc(gwText) : `<span class="rw"><i style="background:var(--c-pick-red)"></i><i style="background:var(--c-pick-white)"></i></span>fair 50/50${dock ? '' : ' · G'}`}</span></button></div>`;
  }
  if (m === 'locked') return st(`<span class="row1">${icon('lock')}${s.phase === 'DOUBLE_RUN' ? 'Double Run…' : 'Running…'}</span><span class="sub">controls locked</span>`);
  if (m === 'ingamble') return st(`<span class="row1">${icon('lock')}In gamble</span><span class="sub">finish or collect in the gamble window</span>`, true, 'cta stack', f * 0.9);
  if (m === 'payout') return st('<span>Paying…</span><span class="sub">tap to skip the count-up</span>');
  if (m === 'paused') return st('<span>Paused</span><span class="sub">see the message</span>');
  if (!c.total) return st('<span>Place a bet</span><span class="sub">then press START</span>');
  return st(`<span>Start</span><span class="sub">${fmt(c.total)} credits on ${c.count} square${c.count === 1 ? '' : 's'}${dock ? '' : ' · Space'}</span>`, !c.canBet || ui.startLocked);
}

function betSlip(s, ui, c, L) {
  const live = Object.keys(s.bets).length;
  const src = live ? s.bets : c.ghosts ? s.lastBets : {};
  const ghost = !live && c.ghosts;
  const { w1, w2 } = winners(s, ui);
  const ns = Object.keys(src).map(Number).sort((a, b) => a - b);
  const f = fs(L, 13, 11);
  const items = ns.map((n) => {
    const hit = n === w1 || n === w2;
    return `<span class="pill" style="font-size:${px(f)};padding:3px 8px 3px 3px;gap:6px;${ghost ? 'border-style:dashed;opacity:.75;' : ''}${hit ? 'border-color:var(--c-mint);background:rgba(59,227,163,.12)' : ''}">${tierBand(MULT[n], f * 0.78, f * 1.4)}<span>#${n}<span class="lo"> × </span>${src[n]}</span></span>`;
  }).join('');
  return `<div class="slip"><div class="sect-lbl" style="margin-bottom:${px(10 * L.s)}"><span>${ghost ? 'Last round’s bets' : 'Your bets'}</span><span class="r">${ns.length} square${ns.length === 1 ? '' : 's'}</span></div><div style="display:flex;flex-wrap:wrap;gap:${px(6 * L.s)}">${items || `<span class="lo" style="font-size:${px(f)};font-weight:600;white-space:normal">No bets yet: tap a square to add the selected chip.</span>`}</div></div>`;
}

const disclaimer = (short) => `<div class="notice disclaimer">${icon('shield')}<span><b>Play credits only.</b> No real money value. Free refill to 1,000${short ? '' : ' whenever you run out'}.</span></div>`;

export function controls(s, ui, c, L) {
  if (L.rail) {
    const r = L.rail;
    const w = r.w - 2 * r.pad;
    const tl = !!r.compact;
    const chip = Math.min(r.chip, (w - 16) / 5);
    return `<div class="panel rail" role="region" aria-label="Bet controls" style="left:${px(r.x)};top:${px(r.y)};width:${px(r.w)};height:${px(r.h)}">
      <div class="sect-lbl"><span>Chip</span><span class="r muted">${c.mode === 'bet' ? `selected: ${s.chip}` : 'locked'}</span></div>
      <div style="margin-bottom:${px(tl ? 4 : 14 * L.s)}">${chipRow(s, c, chip, 4, true)}</div>
      ${totalBetField(s, c, L, tl ? 78 : r.fieldH, tl)}
      ${actionRow(s, c, w, r.actH, fs(L, 15, 12), tl)}
      ${mainButtons(s, ui, c, w, r.mainH, r.mainF, false)}
      ${lastWinField(s, ui, c, tl ? 78 : r.fieldH, tl)}
      ${tl ? '' : betSlip(s, ui, c, L)}
      <div style="flex:1"></div>
      ${disclaimer(false)}</div>`;
  }
  const d = L.dock;
  const cw = d.w * 0.58, rw = d.w - cw - 12;
  const chip = Math.min(d.chip, (cw - 32 - 24) / 5);
  return `<div class="panel" role="region" aria-label="Bet controls" style="left:${px(d.x)};top:${px(d.y)};width:${px(cw)};height:${px(d.h)};padding:16px;display:flex;flex-direction:column;gap:14px;--s:${L.s}">
      <div class="sect-lbl" style="font-size:11px"><span>Chip</span><span class="r muted">${c.mode === 'bet' ? `selected: ${s.chip}` : 'locked'}</span></div>
      ${chipRow(s, c, chip, 6, false)}
      ${totalBetField(s, c, L, d.fieldH, true)}
      ${actionRow(s, c, cw - 32, d.actH, d.actF, cw < 380)}
      <div style="flex:1"></div>${mainButtons(s, ui, c, cw - 32, d.mainH, d.mainF, true)}</div>
    <div class="panel" style="left:${px(d.x + cw + 12)};top:${px(d.y)};width:${px(rw)};height:${px(d.h)};padding:16px;display:flex;flex-direction:column;gap:14px;overflow:hidden">
      ${lastWinField(s, ui, c, 100, false)}
      ${betSlip(s, ui, c, L)}
      <div style="flex:1"></div>${disclaimer(true)}</div>`;
}

// ------------------------------------------------------------------ tiles
export function tileStatic(n, L) {
  const m = MULT[n];
  return `<span class="num">${n}</span><span class="bulb"></span><span class="band t${m}">${tierLabel(m)}</span><span class="dyn"></span>`;
}

/** Per-tile dynamic look: { cls, dyn, disabled, label } (diffed by the controller). */
export function tileLook(n, s, ui, c) {
  const r = s.round;
  const m = MULT[n];
  const cls = [];
  const l1 = ui.light1, l2 = ui.light2;
  let light = null;
  if (l2 && l2.idx === n) light = 'lit2';
  else if (l2 && l2.trail && l2.trail[0] === n) light = 'trailc1';
  else if (l2 && l2.trail && l2.trail[1] === n) light = 'trailc2';
  else if (l1 && l1.idx === n) light = 'lit';
  else if (l1 && l1.trail && l1.trail[0] === n) light = 'trail1';
  else if (l1 && l1.trail && l1.trail[1] === n) light = 'trail2';
  if (light) {
    cls.push(light);
    const lvl = (light === 'lit' ? l1 : light === 'lit2' ? l2 : null);
    if (lvl && lvl.level != null && lvl.level < 1) cls.push(lvl.level < 0.5 ? 'lvl1' : 'lvl2');
  }
  const { w1, w2 } = winners(s, ui);
  let result = null;
  if (r && !light) {
    const revealed = ['GAMBLE_OFFER', 'GAMBLE', 'PAYOUT'].includes(s.phase) || ui.gambleLoss || ui.showLastStop;
    if (n === r.s1 && (revealed || s.phase === 'DOUBLE_RUN')) result = n === w1 ? 'win' : 'lit';
    else if (r.s2 && n === r.s2 && revealed) result = n === w2 ? 'win2' : 'lit2';
    if (result) cls.push(result);
    if (result && ui.showLastStop) cls.push('fade');
  }
  const isLit = !!(light || result);
  const live = s.bets[n] || 0;
  const ghostV = !live && c.ghosts && s.lastBets ? s.lastBets[n] || 0 : 0;
  let dyn = '';
  const lockedPhase = ['SPINNING', 'RESOLVING', 'DOUBLE_RUN', 'ERROR', 'RECOVERY'].includes(s.phase);
  if (lockedPhase && !isLit) dyn += `<span class="veil" style="opacity:.25"></span><span class="lock">${icon('lock')}</span>`;
  const dimPhase = ['GAMBLE_OFFER', 'GAMBLE', 'PAYOUT'].includes(s.phase) || ui.gambleLoss;
  if (dimPhase && (w1 || w2) && n !== w1 && n !== w2) dyn += '<span class="veil" style="opacity:.5"></span>';
  if (live) dyn += `<span class="bet">${live}</span>`;
  else if (ghostV) dyn += `<span class="bet ghost">${ghostV}</span>`;
  if (ui.pulse && ui.pulse.includes(n)) cls.push('pulse');
  if (ui.chase && ui.chase.includes(n)) cls.push('chase');
  return { cls: cls.join(' '), dyn, disabled: !c.canBet, label: `Square ${n}, pays ${m}x, your bet ${live}` };
}

export function winTags(s, ui, L) {
  const { w1, w2 } = winners(s, ui);
  let h = '';
  const tag = (n, second) => {
    const t = winTagRect(L, n, second);
    return `<div class="wtag ${second ? 'c' : 'm'} ${t.dir}" style="left:${px(t.x)};top:${px(t.y)};width:${px(t.w)}">${second ? 'WIN 2' : `${star()}WIN`}</div>`;
  };
  if (w1 && !(ui.light2 && ui.light2.idx === w1)) h += tag(w1, false);
  if (w2) h += tag(w2, true);
  return h;
}

// ------------------------------------------------------------------ centre panel
export function centreModel(s, ui, c) {
  const r = s.round;
  const m = c.mode;
  const M = {};
  M.dr = !!(r && r.doubleRun && (s.phase === 'DOUBLE_RUN' || ['GAMBLE_OFFER', 'GAMBLE', 'PAYOUT'].includes(s.phase) || ui.showLastStop || ui.gambleLoss));
  if (s.phase === 'ERROR') return { ...M, status: ['coral', 'Paused'], headline: 'Paused', sub: '' };
  if (s.phase === 'RECOVERY') return { ...M, status: ['amber', 'Restoring'], headline: 'Round restored', sub: '' };
  if (s.phase === 'SPINNING' || s.phase === 'RESOLVING') {
    return { ...M, status: ['amber', 'Running'], headline: 'Running…', sub: 'Bets are locked until the light stops.', note: `Credits ${fmt(r.balanceBefore)} − ${fmt(r.totalBet)} bet = ${fmt(r.balance)}` };
  }
  if (s.phase === 'DOUBLE_RUN') {
    const b = r.bets[r.s1] || 0;
    return {
      ...M, status: ['cyan', 'Double Run'], headline: 'Double Run!', tone: 'cyan', banner: true,
      sub: `A second light is running. #${r.s1} stays lit, and the second light can’t stop on it.`,
      results: [b ? { n: r.s1, bet: b, win: b * MULT[r.s1], label: 'First stop' } : { n: r.s1, text: `First stop: #${r.s1} · no bet there` }],
    };
  }
  if (m === 'offer' || m === 'ingamble' || (m === 'payout' && ui.gambleLoss)) {
    const { w1, w2 } = winners(s, ui);
    const status = ui.gambleLoss ? ['coral', 'Gamble lost'] : m === 'ingamble' ? ['mint', 'Gamble'] : MULT[w1] === 1920 || MULT[w2] === 1920 ? ['mint', 'Jackpot'] : r.doubleRun ? ['mint', 'Double Run win'] : ['mint', 'Win'];
    const res = (n, second) => ({ n, bet: r.bets[n], win: r.bets[n] * MULT[n], second });
    let sub, results;
    const jackpotN = [w1, w2].find((n) => n && MULT[n] === 1920);
    if (jackpotN && !r.doubleRun) {
      sub = `#${jackpotN} · ★1920X · your ${r.bets[jackpotN]} credit${r.bets[jackpotN] === 1 ? '' : 's'}`;
    } else if (r.doubleRun && w1 && w2) {
      sub = 'Two squares won this round.';
      results = [res(w1), res(w2, true)];
    } else if (r.doubleRun && w1) {
      sub = `The second light stopped on #${r.s2} (no bet there).`;
      results = [res(w1)];
    } else if (r.doubleRun && w2) {
      sub = `The first light stopped on #${r.s1} (no bet there).`;
      results = [res(w2, true)];
    } else {
      sub = 'Collect it, or gamble it on a fair 50/50.';
      results = [res(w1)];
    }
    return { ...M, status, headline: `You win ${fmt(r.baseWin)}`, tone: 'mint', sub, results, hide: !!ui.celebration };
  }
  if (m === 'payout') {
    return { ...M, status: ['mint', 'Paid'], headline: `+${fmt(r.currentWin)} collected`, tone: 'mint', sub: `Added to your credits: ${fmt(s.balance - r.currentWin)} → ${fmt(s.balance)}` };
  }
  // BETTING
  if (ui.showLastStop && r) {
    if (r.doubleRun) return { ...M, status: ['idle', 'Betting open'], headline: 'No win this time', sub: `The lights stopped on #${r.s1} and #${r.s2}. Your bets are still on the board.`, results: [{ n: r.s1, text: `Stopped on #${r.s1} · no bet there` }, { n: r.s2, text: `Second stop #${r.s2} · no bet there`, second: true }] };
    return { ...M, status: ['idle', 'Betting open'], headline: 'No win this time', sub: `The light stopped on #${r.s1} (${MULT[r.s1]}x). Your bets are still on the board. Press START to play them again.`, results: [{ n: r.s1, text: `Stopped on #${r.s1} · no bet there` }] };
  }
  if (c.ghosts) return { ...M, status: ['idle', 'Betting open'], headline: 'Place your bets', sub: `Last round’s bets are shown as outlines. Press Rebet to place all ${totalOf(s.lastBets)} again.` };
  return { ...M, status: ['idle', 'Betting open'], headline: 'Place your bets', sub: 'Pick a chip, tap squares, then press START.' };
}

export function centre(s, ui, c, L) {
  const M = centreModel(s, ui, c);
  const cw = L.inner.w;
  const small = cw < 560;
  const k = Math.min(1, L.f);
  const pf = fs(L, 13, 11);
  const st = `<span class="pill st ${M.status[0]}" data-role="status" style="font-size:${px(pf)};padding:${px(5 * L.s)} ${px(12 * L.s)}"><span class="dot"></span>${M.status[1]}</span>`;
  const dr = `<span class="pill dr${M.dr ? ' on' : ''}" style="font-size:${px(pf)};padding:${px(5 * L.s)} ${px(12 * L.s)}"><span class="dot"></span>${M.dr ? 'Double Run on' : 'Double Run · 1 in 25'}</span>`;
  const hf = Math.max(18, (L.bp === 'tablet-portrait' || L.bp === 'tablet-landscape' ? 30 : fs(L, 56, 30)) * k);
  const rf = fs(L, 15, 12);
  const rl = (x) => {
    const m = MULT[x.n];
    if (x.text) return `<span class="pill res" style="font-size:${px(rf)}">${tierBand(m, rf * 0.8, rf * 1.45)}<span>${x.text}</span></span>`;
    return `<span class="pill res ${x.second ? 'w2' : 'w1'}" style="font-size:${px(rf)}">${tierBand(m, rf * 0.8, rf * 1.45)}<span>${x.label ? `${x.label}: ` : ''}#${x.n} · ${x.bet} × ${m} = <b class="${x.second ? 'cyan' : 'mint'}">${fmt(x.win)}</b></span></span>`;
  };
  let resultLine = '';
  if (M.results) resultLine = `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${M.results.map(rl).join('')}</div>`;
  if (M.note) resultLine = `<span class="pill" style="font-size:${px(fs(L, 14, 12))};padding:6px 12px">${M.note}</span>`;
  let legend;
  if (small) {
    const lf = 10;
    legend = `<div class="legend" style="gap:6px;width:100%;justify-content:center">${TIERS.map((m) => `<div class="lg" style="padding:4px 2px;gap:3px">${tierBand(m, lf, lf * 1.6)}<span class="lo" style="font-size:${px(lf)};font-weight:700;white-space:nowrap">${ODDS[m].replace('1 in ', '1/')}</span></div>`).join('')}</div>`;
  } else {
    legend = `<div style="width:100%"><div class="sect-lbl" style="font-size:${px(fs(L, 11, 10))};margin-bottom:${px(8 * L.s)}"><span>Pays (total return per credit)</span><span class="r">hit chance per round</span></div><div class="legend" style="gap:${px(10 * L.s)}">${TIERS.map((m) => `<div class="lg" style="padding:${px(10 * L.s)} 6px;gap:${px(6 * L.s)}">${tierBand(m, fs(L, 17, 12), fs(L, 28, 20))}<span style="font-size:${px(fs(L, 13, 11))};font-weight:700">${ODDS[m]}</span><span class="lo" style="font-size:${px(fs(L, 12, 10))};font-weight:600">${COUNT_BY_TIER[m]} square${COUNT_BY_TIER[m] > 1 ? 's' : ''}</span></div>`).join('')}</div></div>`;
  }
  const padc = small ? 12 : 24 * L.s;
  const gap = small ? 10 : 16 * L.s;
  const hist = historyRow(s, cw - 2 * padc, small, L);
  return `<div class="centre" style="left:${px(L.inner.x)};top:${px(L.inner.y)};width:${px(cw)};height:${px(L.inner.h)};padding:${px(padc)};gap:${px(gap)}">
    <div style="display:flex;justify-content:space-between;width:100%;gap:8px">${st}${dr}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:${px(10 * L.s)};${M.hide ? 'opacity:0' : ''}" aria-live="polite">
      <div class="headline${M.tone ? ` ${M.tone}` : ''}${M.banner && !c.reduced ? ' banner' : ''}" data-role="headline" style="font-size:${px(hf)}">${UP(M.headline)}</div>
      ${M.sub ? `<div class="muted" style="font-size:${px(fs(L, 18, 13))};font-weight:600;text-align:center;max-width:${px(cw * 0.86)};line-height:1.4">${M.sub}</div>` : ''}
      ${resultLine}</div>
    <div style="display:flex;flex-direction:column;gap:${px(14 * L.s)};width:100%">${legend}${hist}</div></div>`;
}

function historyRow(s, w, small, L) {
  const items = s.history.slice(-HISTORY_SHOWN);
  const used = items.reduce((a, it) => a + (it.s2 ? 2 : 1), 0);
  const slots = Math.max(10, used);
  const gap = 6;
  const ew = (w - (slots - 1) * gap) / slots;
  const eh = small ? 34 : fs(L, 52, 36);
  const f = small ? 10.5 : fs(L, 15, 11);
  const one = (n, ww) => { const m = MULT[n]; return `<div class="he t${m}" style="width:${px(ww)};height:${px(eh)};font-size:${px(f)}"><span>#${n}</span><span class="m" style="font-size:${px(f * 0.8)}">${tierLabel(m)}</span></div>`; };
  const line = items.map((it) => (it.s2
    ? `<div class="he dr" style="width:${px(ew * 2 + gap)};height:${px(eh)};font-size:${px(f)}" aria-label="Double Run: #${it.s1} and #${it.s2}"><span class="tab">DOUBLE</span>${one(it.s1, ew - 2)}${one(it.s2, ew - 2)}</div>`
    : one(it.s1, ew))).join('');
  return `<div style="width:100%"><div class="sect-lbl" style="font-size:${px(fs(L, 11, 10))};margin-bottom:${px(8 * L.s)}"><span>Last 10 rounds</span><span class="r">newest →</span></div><div class="hist" data-role="history" style="gap:${px(gap)};min-height:${px(eh)}">${line || `<span class="lo" style="font-size:${px(f)};font-weight:600;align-self:center">No rounds yet.</span>`}</div></div>`;
}

// ------------------------------------------------------------------ utility bar
export function util(s, ui, c, L) {
  const st = L.stage;
  const y = st.y + st.h - L.util;
  const sz = L.util - 12;
  const locked = !['BETTING', 'INIT'].includes(s.phase);
  const off = !c.canInfo;
  const ib = (id, ic, label, d, lk) => `<button class="ibtn hit${d ? '' : ' on'}" data-id="${id}" aria-label="${label}${lk ? ' (locked until the round ends)' : ''}"${dis(d)} style="width:${px(sz)};height:${px(sz)}">${icon(ic)}${lk ? `<span class="lk">${icon('lock')}</span>` : ''}</button>`;
  const lockLine = locked ? (['locked', 'paused'].includes(c.mode) ? 'Info & Settings unlock when the round ends' : 'Info & Settings open again after you collect') : '';
  const showHints = L.bp === 'desktop-xl' || L.bp === 'desktop';
  const hints = !showHints ? '' : (c.mode === 'offer' ? [['Enter', 'Collect'], ['G', 'Gamble']] : c.mode === 'bet' ? [['1–5', 'chip'], ['Click/Enter', 'add'], ['Right-click', 'remove'], ['Space', 'start'], ['M', 'mute']] : [['M', 'mute']]).map(([k, v]) => `<span>${kc(k)}${v}</span>`).join('');
  return `<div class="util" role="toolbar" aria-label="Sound and info" style="left:${px(st.x + 12)};top:${px(y)};width:${px(st.w - 24)};height:${px(L.util - 6)};font-size:${px(fs(L, 13, 11))}">
    <button class="ibtn hit on" data-id="icon-sound" aria-label="${s.settings.mute ? 'Sound muted, press to turn on (M)' : 'Sound on, press to mute (M)'}" style="width:${px(sz)};height:${px(sz)}">${icon(s.settings.mute ? 'mute' : 'sound')}</button>
    ${ib('icon-settings', 'gear', 'Settings', off, locked)}${ib('icon-info', 'table', 'Paytable', off, locked)}${ib('icon-help', 'help', 'How to play', off, locked)}
    ${lockLine ? `<span class="lockline" style="font-size:${px(fs(L, 12, 11))}">${lockLine}</span>` : ''}
    <span class="hints" style="font-size:${px(fs(L, 12, 11))}">${hints}</span></div>`;
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
    scrim = `<div class="scrim" style="top:${px(L.header)}"></div>`;
  } else if (opts.full) {
    mw = Math.min(mw, L.W - 32);
    mh = Math.min(mh, L.H - L.header - 24);
    box = { x: (L.W - mw) / 2, y: L.header + (L.H - L.header - mh) / 2, w: mw, h: mh };
    scrim = `<div class="scrim" style="top:${px(L.header)}"></div>`;
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

export function gambleModal(s, ui, c, L) {
  const r = s.round;
  const loss = ui.gambleLoss;
  const xl = L.bp === 'desktop-xl';
  const mw = xl ? 720 : L.bp === 'desktop' ? 560 : 520;
  const mh = xl ? 720 : 560;
  const { box, scrim } = frame(L, mw, mh, { sheetH: 724 });
  const k = xl ? 1 : 0.8;
  const pad = 28 * k;
  const used = r.gambles.length;
  const revealing = s.gamble.revealing;
  const flipNo = revealing ? used : used + 1;
  const pick = loss ? loss.pick : s.gamble.pick;
  const w = loss ? loss.win : (ui.displayWin == null ? r.currentWin : ui.displayWin);
  const bh = L.dockMode ? 60 : 76 * k;
  let h = scrim + open(box, pad, 'Double or nothing');
  h += `<div class="mhead"><span class="mtitle" style="font-size:${px(28 * k)}">Double or nothing</span><span class="pill" style="margin-left:auto;font-size:${px(13 * k + 1)};padding:5px 12px;gap:8px"><span class="pips">${[0, 1, 2].map((i) => `<i class="${i < used ? 'used' : ''}"></i>`).join('')}</span>${used >= MAX_GAMBLES ? 'none left' : `${MAX_GAMBLES - used} of 3 left`}</span></div>`;
  let instr;
  if (loss) instr = `Flip ${loss.flip} result`;
  else if (revealing) instr = 'Flipping…';
  else if (ui.matchMsg) instr = `<b class="mint">MATCH! ${UP(ui.matchMsg.colour)} lit. Your win is now ${fmt(r.currentWin)}.</b> Gamble again or Collect.`;
  else instr = `Pick a colour for flip ${flipNo}, then press GAMBLE. Fair 50/50: if your colour lights, your win doubles.`;
  h += `<div class="muted" data-role="gamble-instr" aria-live="polite" style="font-size:${px(15 * k + 1)};font-weight:600;margin-top:${px(8 * k)}">${instr}</div>`;
  if (!loss) {
    h += `<div class="field" style="margin-top:${px(18 * k)};padding:${px(16 * k)} ${px(20 * k)};display:flex;align-items:center;justify-content:space-between;border-color:rgba(59,227,163,.5)"><div><div class="sect-lbl" style="font-size:12px"><span>Current win</span></div><div class="val mint" data-role="current-win" style="font-size:${px(44 * k)};margin-top:6px">${fmt(w)}</div></div><div class="muted" style="text-align:right;font-weight:700;font-size:${px(15 * k + 1)}">Win → <b class="mint">${fmt(r.currentWin * 2)}</b><br>Lose → <b class="coral">0</b></div></div>`;
  } else {
    h += `<div class="field" data-role="gamble-loss" style="margin-top:${px(18 * k)};padding:${px(16 * k)} ${px(20 * k)};border-color:rgba(255,93,115,.55);background:linear-gradient(180deg,rgba(255,93,115,.10),var(--c-bg-0))"><div class="mtitle coral" style="font-size:${px(30 * k)}">No match</div><div style="font-size:${px(16 * k + 1)};font-weight:600;margin-top:8px;line-height:1.45;white-space:normal">${UP(loss.result)} lit. Your pick was ${UP(loss.pick)}, so the <b>${fmt(loss.win)}</b> gamble is lost.<br><span class="muted">Your credits stay at <b style="color:var(--c-text-hi)">${fmt(s.balance)}</b>. Nothing else was taken.</span></div></div>`;
  }
  const ph = L.dockMode ? 150 : 190 * k;
  const pw = (box.w - 2 * pad - (L.dockMode ? 40 : 56 * k)) / 2;
  const card = (col) => {
    const sel = pick === col;
    const flipLit = ui.flip && ui.flip.lit === col;
    const lit = loss ? loss.result === col : flipLit;
    const on = lit || (sel && !loss && !ui.flip);
    const cls = loss ? (lit ? ' lit' : ' dim') : `${sel && !ui.flip ? ' sel' : ''}${ui.flip && ui.flip.final && !flipLit ? ' dim' : ''}${ui.flip && ui.flip.final && flipLit ? ' lit' : ''}`;
    const b = L.dockMode ? 56 : 74 * k;
    const tags = `${sel ? `<span class="yp">${loss ? 'YOUR PICK' : '✓ YOUR PICK'}</span>` : ''}${(loss && lit) || (ui.flip && ui.flip.final && flipLit) ? '<span class="yp litt">LIT</span>' : ''}`;
    return `<button class="pick hit${cls}" data-id="pick-${col}" role="radio" aria-checked="${sel}" aria-label="${UP(col)} (key ${col === 'red' ? 'R or left arrow' : 'W or right arrow'})"${dis(!!loss || revealing || !!c.gambleWhy)} style="width:${px(pw)};height:${px(ph)};gap:${px(10 * k)}">${tags}<span class="pb ${col}${on ? ' on' : ''}" style="width:${px(b)};height:${px(b)};margin-top:${px(sel || lit ? 14 : 0)}"></span><span class="disp" style="font-size:${px(22 * k + 2)};color:${col === 'red' ? '#FF8A98' : 'var(--c-text-hi)'}">${UP(col)}</span><span class="lo" style="font-size:12px;font-weight:700">key ${col === 'red' ? 'R / ←' : 'W / →'}</span></button>`;
  };
  h += `<div role="radiogroup" aria-label="Pick a colour" style="display:flex;align-items:center;justify-content:space-between;margin-top:${px(18 * k)}">${card('red')}<span class="lo" style="font-weight:800;font-size:14px">or</span>${card('white')}</div>`;
  const recap = recapText(r, loss);
  h += `<div class="lo" style="font-size:${px(13 * k + 1)};font-weight:600;margin-top:${px(14 * k)};text-align:center;white-space:normal">${recap}</div><div style="flex:1"></div>`;
  if (!loss) {
    const why = c.gambleWhy;
    let g;
    if (why) g = bigBtn('m-gamble', 'red', `<span>Gamble</span><span class="sub">${why === 'cap' ? 'Doubling would go over the 30,000 cap' : 'No gambles left for this win'}</span>`, bh, 24 * k, '58%', true);
    else if (!pick) g = bigBtn('m-gamble', 'red', '<span>Pick a colour</span><span class="sub">R / W, then G</span>', bh, 24 * k, '58%', true);
    else g = bigBtn('m-gamble', pick === 'red' ? 'red' : 'whitec', `<span>Gamble on ${pick}</span><span class="sub">${fmt(r.currentWin)} → ${fmt(r.currentWin * 2)} or 0${L.dockMode ? '' : ' · G'}</span>`, bh, 24 * k, '58%', revealing, `Gamble on ${pick}: ${r.currentWin} becomes ${r.currentWin * 2} or 0 (G)`);
    h += `<div class="row" style="gap:12px">${g}${bigBtn('m-collect', 'cta', `<span>Collect</span><span class="sub">${fmt(r.currentWin)} → credits${L.dockMode ? '' : ' · Enter'}</span>`, bh, 24 * k, 'calc(42% - 12px)', revealing, `Collect ${r.currentWin} to credits (Enter)`)}</div>`;
    h += `<div class="lo" style="font-size:12px;font-weight:600;text-align:center;margin-top:10px">Gamble is turned off when doubling would go over ${fmt(GAMBLE_CAP)} credits.</div>`;
  } else {
    h += `<div class="row">${bigBtn('m-back', 'cta', `<span>Back to the board</span><span class="sub">continues by itself in ${loss.left} s</span>`, bh, 24 * k, '100%', false, 'Back to the board (Enter)')}</div>`;
    h += '<div class="lo" style="font-size:12px;font-weight:600;text-align:center;margin-top:10px">Gamble is optional: you can always Collect instead.</div>';
  }
  return `${h}</div></div>`;
}

function recapText(r, loss) {
  const parts = [];
  let w = r.baseWin;
  r.gambles.forEach((g, i) => {
    if (r.pendingReveal && i === r.gambles.length - 1) return;
    if (loss && i === r.gambles.length - 1) parts.push(`Flip ${i + 1}: ${UP(g.pick)} picked · ${UP(g.result)} lit`);
    else if (g.pick === g.result) { parts.push(`Flip ${i + 1}: you picked ${UP(g.pick)} · ${UP(g.result)} lit · ${fmt(w)} → ${fmt(w * 2)}`); w *= 2; }
  });
  return parts.join(' · ') || '&nbsp;';
}

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

// ------------------------------------------------------------------ celebration, rings, start, loading
export function celebration(s, ui, L) {
  const cel = ui.celebration;
  if (!cel) return '';
  const c = L.inner;
  const r = s.round;
  let conf = '';
  if (!ui.reducedNow) {
    const cols = ['#FFB72B', '#3BE3A3', '#FF5D73', '#5BE2FF', '#A98BFF', '#FFF0A8'];
    for (const p of ui.confetti) conf += `<i style="left:${px(p.x)};top:${px(p.y)};width:${px(8 * L.s)};height:${px(14 * L.s)};background:${cols[p.c]};transform:rotate(${p.r.toFixed(0)}deg);opacity:.85"></i>`;
  }
  const f = L.bp.startsWith('tablet') ? 40 : fs(L, 84, 40);
  const b = r.bets[8] || 0;
  return `<div class="confetti">${conf}</div>
    <div class="celebrate" role="status" aria-label="Jackpot" style="left:${px(c.x)};top:${px(c.y + c.h * (L.bp === 'desktop-xl' ? 0.16 : 0.09))};width:${px(c.w)};gap:${px(12 * L.s)}">
      <span class="pill" style="font-size:${px(fs(L, 16, 12))};padding:6px 14px;border-color:var(--t1920-edge);color:#FFE58A;background:rgba(242,193,78,.12)">${star()}Jackpot square #8</span>
      <span class="disp big" style="font-size:${px(f)}">1920X</span>
      <span class="val mint" style="font-size:${px(fs(L, 52, 28))};font-weight:800">+${fmt(b * 1920)}</span>
      <span class="muted" style="font-size:${px(fs(L, 15, 12))};font-weight:700">${b} credit${b === 1 ? '' : 's'} on #8 · tap, Space or Esc to skip</span></div>`;
}

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
