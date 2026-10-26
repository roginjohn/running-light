// SVG drawing primitives. Faithful port of the approved design generator (design/session-one/_render/common.py)
// so the live game draws with the same geometry, tokens and gradients as the mockups.
import tokens from '../data/design-tokens.json';
import { MULT, GRID, squareXY, squarePos, pRound } from '../engine/config.js';

export const C = tokens.color;
export const TIER = tokens.tier;
export const W = 1920, H = 1080;
export const UI = 'Nunito, sans-serif';
export const SIGN = "'Carter One', sans-serif";
export const DISP = 'Lobster, cursive';
const TNUM = 'font-variant-numeric:tabular-nums;';
export const CELL = GRID.cell;

export const fmt = (n) => Number(n).toLocaleString('en-US');

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function t(x, y, s, size = 20, fill = null, family = UI, weight = 800, anchor = 'middle', ls = 0, extra = '', style = '') {
  fill = fill || C['text-on-dark'];
  const st = family === UI ? `${TNUM}${style}` : style;
  const lsa = ls ? ` letter-spacing="${ls}"` : '';
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${lsa} style="${st}" ${extra}>${esc(s)}</text>`;
}

export function rect(x, y, w, h, rx = 0, fill = 'none', stroke = 'none', sw = 0, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
}

export const g = (content, extra = '') => `<g ${extra}>${content}</g>`;

export function defs() {
  return `<defs>
<linearGradient id="gNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E0820"/><stop offset="0.55" stop-color="${C.night}"/><stop offset="1" stop-color="#2B1440"/></linearGradient>
<radialGradient id="gHaze" cx="0.5" cy="1" r="0.8"><stop offset="0" stop-color="#FF9F43" stop-opacity="0.35"/><stop offset="1" stop-color="#FF9F43" stop-opacity="0"/></radialGradient>
<linearGradient id="gPly" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C['plywood-light']}"/><stop offset="1" stop-color="#B07A44"/></linearGradient>
<linearGradient id="gPlyDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C['plywood-dark']}"/><stop offset="1" stop-color="${C['plywood-deep']}"/></linearGradient>
<linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C1A52"/><stop offset="1" stop-color="#1E1240"/></linearGradient>
<linearGradient id="gSquare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2E1A"/><stop offset="1" stop-color="${C['square-panel']}"/></linearGradient>
<linearGradient id="gSquareLit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8935A"/><stop offset="1" stop-color="#7A4A20"/></linearGradient>
<linearGradient id="gSquare2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F5C5A"/><stop offset="1" stop-color="#173E44"/></linearGradient>
<linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C['gold-leaf-1']}"/><stop offset="0.5" stop-color="${C['gold-leaf-2']}"/><stop offset="0.75" stop-color="#FFE08A"/><stop offset="1" stop-color="${C['gold-leaf-3']}"/></linearGradient>
<linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EA3A50"/><stop offset="1" stop-color="${C['paint-red-dark']}"/></linearGradient>
<linearGradient id="gMari" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC75A"/><stop offset="1" stop-color="#E0921A"/></linearGradient>
<linearGradient id="gTurq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FD8CB"/><stop offset="1" stop-color="#25B0A4"/></linearGradient>
<linearGradient id="gBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3478"/><stop offset="1" stop-color="#2E1E52"/></linearGradient>
<linearGradient id="gBtnHover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E4596"/><stop offset="1" stop-color="#3B2868"/></linearGradient>
<linearGradient id="gDisabled" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4258"/><stop offset="1" stop-color="#38324A"/></linearGradient>
<radialGradient id="gBulbOn" cx="0.42" cy="0.38" r="0.65"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="${C['bulb-core']}"/><stop offset="0.75" stop-color="${C['bulb-glow']}"/><stop offset="1" stop-color="#E89A2A"/></radialGradient>
<radialGradient id="gBulbOn2" cx="0.42" cy="0.38" r="0.65"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.4" stop-color="#D8FFFB"/><stop offset="0.8" stop-color="${C['second-light']}"/><stop offset="1" stop-color="#1FA89C"/></radialGradient>
<radialGradient id="gBulbOff" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="${C['bulb-off-hi']}"/><stop offset="0.6" stop-color="${C['bulb-off']}"/><stop offset="1" stop-color="#3E2812"/></radialGradient>
<radialGradient id="gBulbRed" cx="0.42" cy="0.38" r="0.65"><stop offset="0" stop-color="#FFE3E6"/><stop offset="0.5" stop-color="#FF5A6E"/><stop offset="1" stop-color="#9E1428"/></radialGradient>
<radialGradient id="gBulbWhite" cx="0.42" cy="0.38" r="0.65"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#FFF8E6"/><stop offset="1" stop-color="#CDBFA0"/></radialGradient>
<radialGradient id="gGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C['bulb-glow']}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${C['bulb-glow']}" stop-opacity="0.45"/><stop offset="1" stop-color="${C['bulb-glow']}" stop-opacity="0"/></radialGradient>
<radialGradient id="gGlow2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C['second-light']}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${C['second-light']}" stop-opacity="0.45"/><stop offset="1" stop-color="${C['second-light']}" stop-opacity="0"/></radialGradient>
<radialGradient id="gGlowRed" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FF5A6E" stop-opacity="0.9"/><stop offset="1" stop-color="#FF5A6E" stop-opacity="0"/></radialGradient>
<radialGradient id="gHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C['bulb-glow']}" stop-opacity="1"/><stop offset="0.5" stop-color="${C['bulb-glow']}" stop-opacity="0.8"/><stop offset="0.75" stop-color="#FF9F43" stop-opacity="0.35"/><stop offset="1" stop-color="#FF9F43" stop-opacity="0"/></radialGradient>
<radialGradient id="gHalo2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C['second-light']}" stop-opacity="1"/><stop offset="0.5" stop-color="${C['second-light']}" stop-opacity="0.8"/><stop offset="0.75" stop-color="#2EC4B6" stop-opacity="0.35"/><stop offset="1" stop-color="#2EC4B6" stop-opacity="0"/></radialGradient>
<filter id="fBlur6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="fBlur3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/></filter>
<filter id="fSoft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/></filter>
<filter id="fWood" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.09" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.20  0 0 0 0 0.08  0 0 0 1.1 -0.35" result="grain"/>
  <feComposite in="grain" in2="SourceGraphic" operator="in" result="g2"/>
  <feBlend in="SourceGraphic" in2="g2" mode="multiply"/>
</filter>
<pattern id="pHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#000" fill-opacity="0.25"/><rect width="3" height="8" fill="#000" fill-opacity="0.35"/></pattern>
<symbol id="star" viewBox="-10 -10 20 20"><path d="M0,-9 L2.6,-3 L9,-2.8 L4,1.4 L5.6,8 L0,4.4 L-5.6,8 L-4,1.4 L-9,-2.8 L-2.6,-3 Z"/></symbol>
</defs>`;
}

// ------------------------------------------------------------ background
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function background() {
  const rnd = mulberry(11);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const out = [rect(0, 0, W, H, 0, 'url(#gNight)'), rect(0, 500, W, 580, 0, 'url(#gHaze)')];
  const wheel = (cx, cy, r, op) => {
    const s = [`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#FFB45A" stroke-width="6" opacity="${op}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="none" stroke="#FFB45A" stroke-width="5" opacity="${op}"/>`];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const x2 = (cx + r * Math.cos(a)).toFixed(1), y2 = (cy + r * Math.sin(a)).toFixed(1);
      s.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#E8955A" stroke-width="3" opacity="${op * 0.8}"/>`);
      const col = ['#FFD27A', '#FF5A6E', '#7FF3E8', '#F6AE2D'][i % 4];
      s.push(`<circle cx="${x2}" cy="${y2}" r="9" fill="${col}" opacity="${op + 0.2}"/>`);
    }
    s.push(`<path d="M${cx - r * 0.55},${cy + r * 1.25} L${cx},${cy} L${cx + r * 0.55},${cy + r * 1.25}" stroke="#8A6A9A" stroke-width="10" fill="none" opacity="${op}"/>`);
    return g(s.join(''), 'filter="url(#fBlur6)"');
  };
  out.push(wheel(1640, 520, 380, 0.55), wheel(150, 760, 200, 0.35));
  out.push(g('<path d="M560,1000 L760,880 L960,1000 Z" fill="#7A1B2E" opacity="0.6"/><path d="M1180,1000 L1330,900 L1480,1000 Z" fill="#1E6F6A" opacity="0.55"/>', 'filter="url(#fBlur6)"'));
  const string = (x1, y1, x2, y2, sag, n, op) => {
    const qy = (y1 + y2) / 2 + sag * 2, qx = (x1 + x2) / 2;
    const s = [`<path d="M${x1},${y1} Q${qx},${qy} ${x2},${y2}" stroke="#2A1A3A" stroke-width="2" fill="none"/>`];
    for (let i = 0; i <= n; i++) {
      const tt = i / n;
      const x = ((1 - tt) ** 2 * x1 + 2 * (1 - tt) * tt * qx + tt ** 2 * x2).toFixed(1);
      const y = ((1 - tt) ** 2 * y1 + 2 * (1 - tt) * tt * qy + tt ** 2 * y2).toFixed(1);
      s.push(`<circle cx="${x}" cy="${y}" r="10" fill="url(#gGlow)" opacity="${op}"/><circle cx="${x}" cy="${y}" r="3.2" fill="#FFF1C8" opacity="${op}"/>`);
    }
    return s.join('');
  };
  out.push(string(-20, 70, 980, 60, 18, 26, 0.9), string(940, 60, 1940, 74, 22, 26, 0.9));
  const crowd = [];
  let x = -20;
  while (x < W + 40) {
    const hgt = ri(70, 120);
    crowd.push(`<ellipse cx="${x}" cy="${1080 - hgt + 18}" rx="${ri(17, 22)}" ry="${ri(20, 24)}" fill="#0B0618"/>`);
    crowd.push(`<rect x="${x - 34}" y="${1080 - hgt + 36}" width="68" height="${hgt}" rx="30" fill="#0B0618"/>`);
    x += ri(44, 66);
  }
  out.push(g(crowd.join(''), 'filter="url(#fBlur3)" opacity="0.95"'));
  return out.join('');
}

export function bunting({ y = 2, x1 = 0, x2 = W, n = 40, sag = 12, flash = 0 } = {}) {
  const cols = [C['paint-red'], C.marigold, C.turquoise, C.cream];
  const s = [`<path d="M${x1},${y} Q${(x1 + x2) / 2},${y + sag * 2} ${x2},${y}" stroke="#E9D9B8" stroke-width="2" fill="none"/>`];
  for (let i = 0; i < n; i++) {
    const tt = (i + 0.5) / n;
    const x = x1 + (x2 - x1) * tt;
    const yy = y + sag * 4 * tt * (1 - tt);
    const w = ((x2 - x1) / n) * 0.8;
    s.push(`<path d="M${(x - w / 2).toFixed(1)},${yy.toFixed(1)} L${(x + w / 2).toFixed(1)},${yy.toFixed(1)} L${x.toFixed(1)},${(yy + w * 0.9).toFixed(1)} Z" fill="${cols[(i + flash) % 4]}" opacity="0.92"/>`);
  }
  return g(s.join(''), 'filter="url(#fSoft)"');
}

// ------------------------------------------------------------ top bar
export function iconGlyph(kind, cx, cy, state = 'default') {
  const fill = { default: 'url(#gBtn)', hover: 'url(#gBtnHover)', disabled: 'url(#gDisabled)', focus: 'url(#gBtn)' }[state];
  const ink = state === 'disabled' ? C['disabled-text'] : C.cream;
  const s = [`<circle cx="${cx}" cy="${cy}" r="28" fill="${fill}" stroke="${C['night-panel-edge']}" stroke-width="2"/>`];
  if (kind === 'info') {
    s.push(`<circle cx="${cx}" cy="${cy - 10}" r="3.5" fill="${ink}"/><rect x="${cx - 3.5}" y="${cy - 3}" width="7" height="17" rx="3" fill="${ink}"/>`);
    s.push(t(cx + 14, cy - 6, '?', 13, ink, UI, 900));
  } else if (kind === 'settings') {
    let teeth = '';
    for (let i = 0; i < 8; i++) teeth += `<rect x="${cx - 4}" y="${cy - 18}" width="8" height="9" rx="2" fill="${ink}" transform="rotate(${i * 45} ${cx} ${cy})"/>`;
    s.push(teeth + `<circle cx="${cx}" cy="${cy}" r="11" fill="${ink}"/><circle cx="${cx}" cy="${cy}" r="5" fill="${C['night-panel']}"/>`);
  } else {
    s.push(`<path d="M${cx - 14},${cy - 6} h7 l9,-8 v28 l-9,-8 h-7 z" fill="${ink}"/>`);
    if (kind === 'sound') s.push(`<path d="M${cx + 6},${cy - 7} q6,7 0,14 M${cx + 10},${cy - 12} q11,12 0,24" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    else s.push(`<path d="M${cx + 5},${cy - 7} l12,14 M${cx + 17},${cy - 7} l-12,14" stroke="${C.danger}" stroke-width="3.5" stroke-linecap="round"/>`);
  }
  return s.join('');
}

export function focusRingCircle(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${C['focus-ring-outer']}" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${C['focus-ring']}" stroke-width="3"/>`;
}

export function focusRingRect(x, y, w, h, rx) {
  const o = 5;
  return rect(x - o, y - o, w + 2 * o, h + 2 * o, rx + o, 'none', C['focus-ring-outer'], 7) + rect(x - o, y - o, w + 2 * o, h + 2 * o, rx + o, 'none', C['focus-ring'], 3);
}

export function logo(x, y, lit = 7) {
  const s = [`<g transform="translate(${x},${y})">`, t(0, 0, 'Running Light', 44, C.marigold, DISP, 400, 'start', 0, 'stroke="#2A160A" stroke-width="6" paint-order="stroke"')];
  for (let i = 0; i < 7; i++) {
    const on = i < lit;
    s.push(`<circle cx="${8 + i * 36}" cy="14" r="8" fill="url(#gGlow)" opacity="${on ? 1 : 0}"/><circle cx="${8 + i * 36}" cy="14" r="3.5" fill="${on ? C['bulb-core'] : C['bulb-off']}"/>`);
  }
  s.push('</g>');
  return s.join('');
}

export function balancePlaque(balance) {
  const bx = W / 2 - 230, bw = 460;
  return rect(bx, 10, bw, 60, 30, '#0B0618', C.marigold, 3) + t(bx + 34, 48, 'CREDITS', 18, C.marigold, UI, 900, 'start', 3) + t(bx + bw - 34, 55, fmt(balance), 40, C.cream, UI, 900, 'end');
}

// ------------------------------------------------------------ squares
export function plaque(cx, y, tier, w = 62, h = 19, size = 15) {
  const tk = TIER[String(tier)];
  const fill = tier === 1920 ? 'url(#gGold)' : tk.fill;
  const s = [rect(cx - w / 2, y, w, h, 5, fill, tk.edge, 1.5)];
  if (tier === 1920) {
    s.push(`<use href="#star" x="${cx - w / 2 + 1}" y="${y + 2}" width="15" height="15" fill="${C['paint-red']}"/>`);
    s.push(t(cx + 7, y + h - 4.5, tk.label, size - 1, tk.text, SIGN, 400));
  } else s.push(t(cx, y + h - 4.5, tk.label, size, tk.text, SIGN, 400));
  return s.join('');
}

/** state: off, on, trail1, trail2, second, red, white. level scales a partial light (reduced-motion fade). */
export function bulb(cx, cy, r = 12, state = 'off', level = 1) {
  const s = [`<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#1A0F06"/>`];
  if (['on', 'second', 'red', 'white'].includes(state)) {
    const glow = { on: 'gGlow', second: 'gGlow2', red: 'gGlowRed', white: 'gGlow' }[state];
    const grad = { on: 'gBulbOn', second: 'gBulbOn2', red: 'gBulbRed', white: 'gBulbWhite' }[state];
    s.unshift(`<circle cx="${cx}" cy="${cy}" r="${r * 3.4}" fill="url(#${glow})" opacity="${level}"/>`);
    if (level < 1) s.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gBulbOff)"/>`);
    s.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${grad})" opacity="${level}"/>`);
  } else if (state === 'trail1' || state === 'trail2') {
    const op = state === 'trail1' ? 0.55 : 0.3;
    s.unshift(`<circle cx="${cx}" cy="${cy}" r="${r * 2.6}" fill="url(#gGlow)" opacity="${op}"/>`);
    s.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gBulbOff)"/>`);
    s.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gBulbOn)" opacity="${op + 0.1}"/>`);
  } else s.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gBulbOff)"/>`);
  s.push(`<ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.4}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#FFFFFF" opacity="0.55"/>`);
  return s.join('');
}

export function betBadge(cx, cy, amount, ghost = false) {
  const op = ghost ? ' opacity="0.55"' : '';
  const dash = ghost ? ' stroke-dasharray="3 2"' : '';
  return `<g${op} class="badge"><circle cx="${cx}" cy="${cy}" r="13" fill="${ghost ? '#3A2766' : C['paint-red']}" stroke="${C.cream}" stroke-width="2.5"${dash}/><circle cx="${cx}" cy="${cy}" r="8.5" fill="none" stroke="${C.cream}" stroke-width="1" stroke-dasharray="2 2" opacity="0.7"/>${t(cx, cy + 5, amount, 14, '#FFFFFF', UI, 900)}</g>`;
}

export function padlock(cx, cy, col = C['locked-icon']) {
  return `<g transform="translate(${cx} ${cy})"><path d="M-3,-1 v-2.5 a3,3 0 0 1 6,0 v2.5" fill="none" stroke="${col}" stroke-width="1.6"/><rect x="-4.5" y="-1" width="9" height="7" rx="1.5" fill="${col}"/></g>`;
}

/**
 * One 70x70 square. state: idle, hover, lit, trail1, trail2, winner, winner2, second, dimmed, disabled, locked.
 * opts: { bet, ghost, level, pulse }
 * B13 fix 1: the WIN / WIN 2 tag is inset inside the square's top-left (clear of the bet badge at top-right),
 * so it can never clip the frame or overlap a neighbouring square, tag or badge on any edge.
 */
export function square(n, state = 'idle', { bet = 0, ghost = 0, level = 1 } = {}) {
  const [x, y] = squareXY(n);
  const tier = MULT[n];
  const cx = x + CELL / 2;
  const s = [];
  let fill = 'url(#gSquare)', stroke = '#7A5232', sw = 2, bstate = 'off';
  if (state === 'lit' || state === 'winner') { fill = 'url(#gSquareLit)'; stroke = C['bulb-glow']; sw = 4; bstate = 'on'; }
  if (state === 'second' || state === 'winner2') { fill = 'url(#gSquare2)'; stroke = C['second-light']; sw = 4; bstate = 'second'; }
  if (state === 'trail1' || state === 'trail2') { bstate = state; stroke = state === 'trail1' ? '#E0A860' : '#A87A48'; }
  if (state === 'hover') { fill = '#5A3720'; stroke = C.cream; }
  if (state === 'winner' || state === 'winner2') {
    const col = state === 'winner' ? C.marigold : C['second-light'];
    s.push(rect(x - 6, y - 6, CELL + 12, CELL + 12, 12, col, 'none', 0, 'opacity="0.35" filter="url(#fBlur6)"'));
  }
  s.push(rect(x, y, CELL, CELL, 8, fill, stroke, sw));
  const screws = state === 'locked' ? [[x + CELL - 6, y + CELL - 6]] : [[x + 6, y + 6], [x + CELL - 6, y + CELL - 6]];
  for (const [sx, sy] of screws) s.push(`<circle cx="${sx}" cy="${sy}" r="2" fill="#A8865C"/><line x1="${sx - 1.4}" y1="${sy}" x2="${sx + 1.4}" y2="${sy}" stroke="#4A2E1A" stroke-width="0.8"/>`);
  s.push(bulb(cx, y + 17, 11, bstate, level));
  s.push(t(cx, y + 47, n, 20, C.cream, UI, 900, 'middle', 0, 'stroke="#1A0F06" stroke-width="3" paint-order="stroke"'));
  s.push(plaque(cx, y + 50, tier));
  if (state === 'winner' || state === 'winner2') {
    const col = state === 'winner' ? C.marigold : C['second-light'];
    s.push(rect(x - 3, y - 3, CELL + 6, CELL + 6, 10, 'none', col, 5));
    const lab = state === 'winner' ? '★ WIN' : 'WIN 2';
    s.push(rect(x + 2, y + 2, 44, 16, 8, col, '#2A160A', 1.5));
    s.push(t(x + 24, y + 14, lab, 11, '#2A160A', UI, 900));
  }
  if (state === 'dimmed') s.push(rect(x, y, CELL, CELL, 8, '#0A0514', 'none', 0, 'opacity="0.55"'));
  if (state === 'locked') {
    s.push(rect(x, y, CELL, CELL, 8, C['locked-overlay'], 'none', 0, 'opacity="0.3"'));
    s.push(padlock(x + 9, y + 9));
  }
  if (state === 'disabled') {
    s.push(rect(x, y, CELL, CELL, 8, 'url(#pHatch)'));
    s.push(rect(x, y, CELL, CELL, 8, '#2A2438', 'none', 0, 'opacity="0.45"'));
  }
  if (bet) s.push(betBadge(x + CELL - 6, y + 8, bet));
  else if (ghost) s.push(betBadge(x + CELL - 6, y + 8, ghost, true));
  return s.join('');
}

export const HALO = {
  lit: ['gHalo', 84, 0.9], winner: ['gHalo', 92, 1.0], trail1: ['gHalo', 66, 0.55], trail2: ['gHalo', 56, 0.32],
  second: ['gHalo2', 84, 0.9], winner2: ['gHalo2', 92, 1.0],
};

export function halo(n, state, scale = 1) {
  const [grad, r, op] = HALO[state];
  const [x, y] = squareXY(n);
  return `<circle cx="${x + CELL / 2}" cy="${y + CELL / 2}" r="${r * scale}" fill="url(#${grad})" opacity="${op}"/>`;
}

export function boardFrame() {
  const fx = 24, fy = 92, fw = 1260, fh = 880;
  const s = [g(rect(fx, fy, fw, fh, 22, 'url(#gPly)'), 'filter="url(#fShadow)"'),
    rect(fx, fy, fw, fh, 22, C['plywood-light'], 'none', 0, 'filter="url(#fWood)"'),
    rect(fx + 7, fy + 7, fw - 14, fh - 14, 17, 'none', C['paint-red'], 6),
    rect(fx + 14, fy + 14, fw - 28, fh - 28, 12, 'none', C.cream, 2, 'opacity="0.7"')];
  for (const [sx, sy] of [[fx + 14, fy + 14], [fx + fw - 14, fy + 14], [fx + 14, fy + fh - 14], [fx + fw - 14, fy + fh - 14]]) {
    s.push(`<circle cx="${sx}" cy="${sy}" r="5" fill="#D9C29A" stroke="#5C3A1A" stroke-width="1.5"/><line x1="${sx - 3.5}" y1="${sy - 1}" x2="${sx + 3.5}" y2="${sy + 1}" stroke="#5C3A1A" stroke-width="1.5"/>`);
  }
  s.push(rect(GRID.x + 35, GRID.y + 17, 15 * GRID.pitch, 10 * GRID.pitch, 4, 'none', '#5C3A1A', 3, 'stroke-dasharray="2 6" opacity="0.6"'));
  return s.join('');
}

/** Frame marquee chase bulbs (big win). phase shifts the 2-on/2-off pattern. */
export function frameMarquee(phase = 0) {
  const fx = 24, fy = 92, fw = 1260, fh = 880;
  const pts = [];
  for (let i = 0; i < 40; i++) {
    pts.push([fx + 20 + (i * (fw - 40)) / 39, fy + 4]);
    pts.push([fx + 20 + (i * (fw - 40)) / 39, fy + fh - 4]);
  }
  for (let i = 0; i < 28; i++) {
    pts.push([fx + 4, fy + 20 + (i * (fh - 40)) / 27]);
    pts.push([fx + fw - 4, fy + 20 + (i * (fh - 40)) / 27]);
  }
  return pts.map(([px, py], k) => {
    const on = (k + phase) % 4 < 2;
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${on ? 12 : 0}" fill="url(#gGlow)"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="${on ? C['bulb-core'] : C['bulb-off']}"/>`;
  }).join('');
}

// ------------------------------------------------------------ centre panel
export function marqueeSign(cx, y, { w = 600, h = 124, phase = 0, size = 76, textY = 86 } = {}) {
  const x = cx - w / 2;
  const s = [rect(x, y, w, h, 18, C['paint-red'], C.marigold, 4, 'filter="url(#fSoft)"'), rect(x + 10, y + 10, w - 20, h - 20, 12, '#7E1222')];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const bx = (x + 20 + (i * (w - 40)) / (n - 1)).toFixed(1);
    for (const by of [y + 6, y + h - 6]) {
      const on = (i + phase) % 2 === 0;
      s.push(`<circle cx="${bx}" cy="${by}" r="${on ? 10 : 0}" fill="url(#gGlow)"/><circle cx="${bx}" cy="${by}" r="4" fill="${on ? C['bulb-core'] : '#FFD9A0'}"/>`);
    }
  }
  s.push(t(cx, y + textY, 'Running Light', size, C.marigold, DISP, 400, 'middle', 0, 'stroke="#2A160A" stroke-width="8" paint-order="stroke"'));
  return s.join('');
}

export function doubleRunLamp(x, y, on = false) {
  const s = [rect(x, y, 236, 170, 16, '#2A190C', '#7A5232', 2)];
  const cx = x + 118, cy = y + 62;
  if (on) s.push(`<circle cx="${cx}" cy="${cy}" r="70" fill="url(#gGlow2)"/>`);
  s.push(`<circle cx="${cx}" cy="${cy}" r="32" fill="#1A0F06"/>`);
  s.push(`<circle cx="${cx}" cy="${cy}" r="27" fill="url(#${on ? 'gBulbOn2' : 'gBulbOff'})"/>`);
  s.push(t(cx, cy + 9, '2', 26, on ? '#0E2233' : '#C9AE8A', UI, 900));
  s.push(t(cx, y + 128, 'DOUBLE RUN', 20, on ? C['second-light'] : C.cream, UI, 900, 'middle', 1.5));
  s.push(t(cx, y + 153, on ? 'ON THIS ROUND' : '1 in 25 rounds', 15, on ? C.cream : '#D9C29A', UI, 800));
  return s.join('');
}

export function miniLegend(x, y, w = 520) {
  const s = [rect(x, y, w, 170, 16, '#2A190C', '#7A5232', 2), t(x + w / 2, y + 30, 'PAYS (TOTAL RETURN PER CREDIT)', 14, '#D9C29A', UI, 900, 'middle', 1.5)];
  const tiers = [[24, 21], [96, 19], [480, 7], [960, 2], [1920, 1]];
  const cw = (w - 40) / 5;
  tiers.forEach(([tier, cnt], i) => {
    const cx = x + 20 + cw * i + cw / 2;
    s.push(plaque(cx, y + 52, tier, 84, 34, 22));
    s.push(t(cx, y + 118, `${cnt} square${cnt > 1 ? 's' : ''}`, 16, C.cream, UI, 800));
    s.push(t(cx, y + 143, `1 in ${fmt(Math.round(1 / pRound(tier)))}`, 14, '#D9C29A', UI, 800));
  });
  return s.join('');
}

export function lastResult(x, y, n = null, n2 = null) {
  const s = [rect(x, y, 236, 170, 16, '#2A190C', '#7A5232', 2), t(x + 118, y + 30, 'LAST RESULT', 14, '#D9C29A', UI, 900, 'middle', 1.5)];
  if (n == null) s.push(t(x + 118, y + 100, '—', 40, C.cream, UI, 900));
  else {
    const items = n2 ? [n, n2] : [n];
    items.forEach((m, i) => {
      const cx = x + 118 + (i - (items.length - 1) / 2) * 100;
      s.push(rect(cx - 42, y + 46, 84, 102, 10, 'url(#gSquare)', i === 1 ? C['second-light'] : '#7A5232', 2));
      s.push(t(cx, y + 90, `#${m}`, 30, C.cream, UI, 900));
      s.push(plaque(cx, y + 106, MULT[m], 70, 26, 18));
    });
  }
  return s.join('');
}

export function centerPanelBase() {
  const x = 134, y = 202, w = 1040, h = 660;
  return rect(x, y, w, h, 18, 'url(#gPlyDark)', 'none', 0, 'filter="url(#fWood)"') + rect(x, y, w, h, 18, 'none', '#3E2812', 3) +
    rect(x + 10, y + 10, w - 20, h - 20, 12, 'none', C.marigold, 2, 'opacity="0.55" stroke-dasharray="14 8"');
}

export function centerText({ text, sub, col, big = false, note, opacity = 1 }) {
  const x = 134, y = 202, w = 1040;
  const s = [];
  const size = big ? 84 : 60;
  if (text) s.push(t(x + w / 2, y + (big ? 300 : 282), text, size, col || C.cream, SIGN, 400, 'middle', 0, `stroke="#2A160A" stroke-width="8" paint-order="stroke" opacity="${opacity}"`));
  if (sub) s.push(t(x + w / 2, y + (big ? 352 : 332), sub, 24, C.cream, UI, 800, 'middle', 0, 'stroke="#2A160A" stroke-width="4" paint-order="stroke"'));
  if (note) {
    s.push(rect(x + w / 2 - 330, y + (big ? 380 : 362), 660, 44, 22, '#1A0F06', 'none', 0, 'opacity="0.75"'));
    s.push(t(x + w / 2, y + (big ? 409 : 391), note, 19, C.cream, UI, 800));
  }
  return s.join('');
}

export function bannerDoubleRun(cx, y, phase = 0) {
  const w = 760, h = 150, x = cx - w / 2;
  const s = [rect(x - 30, y + 30, 60, 90, 6, C['turquoise-dark']), rect(x + w - 30, y + 30, 60, 90, 6, C['turquoise-dark']),
    `<path d="M${x - 30},${y + 30} l-34,45 l34,45 Z" fill="${C['turquoise-dark']}"/>`,
    `<path d="M${x + w + 30},${y + 30} l34,45 l-34,45 Z" fill="${C['turquoise-dark']}"/>`,
    rect(x, y, w, h, 20, C.turquoise, C.cream, 5, 'filter="url(#fShadow)"')];
  for (let i = 0; i < 18; i++) {
    const bx = (x + 24 + (i * (w - 48)) / 17).toFixed(1);
    for (const by of [y + 12, y + h - 12]) {
      const on = (i + phase) % 2 === 0;
      s.push(`<circle cx="${bx}" cy="${by}" r="${on ? 12 : 0}" fill="url(#gGlow2)"/><circle cx="${bx}" cy="${by}" r="4.5" fill="${on ? '#FFFFFF' : '#BFF5EF'}"/>`);
    }
  }
  s.push(t(cx, y + 106, 'DOUBLE RUN!', 92, C.cream, DISP, 400, 'middle', 0, 'stroke="#0E2233" stroke-width="9" paint-order="stroke"'));
  return s.join('');
}

/** Jackpot ribbon (asset inventory "to produce": Double Run banner style in gold leaf). */
export function bannerJackpot(cx, y, phase = 0) {
  const w = 760, h = 150, x = cx - w / 2;
  const s = [rect(x - 30, y + 30, 60, 90, 6, C['gold-leaf-3']), rect(x + w - 30, y + 30, 60, 90, 6, C['gold-leaf-3']),
    `<path d="M${x - 30},${y + 30} l-34,45 l34,45 Z" fill="${C['gold-leaf-3']}"/>`,
    `<path d="M${x + w + 30},${y + 30} l34,45 l-34,45 Z" fill="${C['gold-leaf-3']}"/>`,
    rect(x, y, w, h, 20, 'url(#gGold)', C.cream, 5, 'filter="url(#fShadow)"')];
  for (let i = 0; i < 18; i++) {
    const bx = (x + 24 + (i * (w - 48)) / 17).toFixed(1);
    for (const by of [y + 12, y + h - 12]) {
      const on = (i + phase) % 2 === 0;
      s.push(`<circle cx="${bx}" cy="${by}" r="${on ? 12 : 0}" fill="url(#gGlow)"/><circle cx="${bx}" cy="${by}" r="4.5" fill="${on ? '#FFFFFF' : '#FFE9A3'}"/>`);
    }
  }
  s.push(t(cx, y + 106, '★ 1920x ★', 92, C.cream, DISP, 400, 'middle', 0, 'stroke="#2A160A" stroke-width="9" paint-order="stroke"'));
  return s.join('');
}

// ------------------------------------------------------------ right panel
export function displayCard(x, y, w, label, value, sub = null, valueCol = null, highlight = false, h = 124) {
  const stroke = highlight ? C.marigold : C['night-panel-edge'];
  const s = [rect(x, y, w, h, 18, '#0F0822', stroke, highlight ? 3 : 2), t(x + 20, y + 32, label, 16, C['text-muted-on-dark'], UI, 900, 'start', 2),
    t(x + w - 20, y + 86, value, 50, valueCol || C.cream, UI, 900, 'end')];
  if (sub) s.push(t(x + 20, y + h - 16, sub, 14, C['text-muted-on-dark'], UI, 800, 'start'));
  return s.join('');
}

export function chip(cx, cy, value, state = 'idle', r = 44) {
  const base = C[`chip-${value}`];
  const ink = value === 1 ? '#2A160A' : '#FFFFFF';
  const ring = value !== 1 ? C.cream : C['paint-red'];
  const s = [];
  if (state === 'selected') s.push(`<circle cx="${cx}" cy="${cy}" r="${r + 16}" fill="url(#gGlow)" opacity="0.9"/>`);
  const lift = state === 'selected' || state === 'hover' ? -6 : 0;
  const cy2 = cy + lift;
  s.push(`<ellipse cx="${cx}" cy="${cy + r * 0.86}" rx="${r * 0.9}" ry="${r * 0.22}" fill="#000" opacity="0.45"/>`);
  s.push(`<circle cx="${cx}" cy="${cy2 + 5}" r="${r}" fill="#000" opacity="0.35"/>`);
  s.push(`<circle cx="${cx}" cy="${cy2}" r="${r}" fill="${base}" stroke="#1A0F06" stroke-width="2"/>`);
  for (let i = 0; i < 8; i++) s.push(`<rect x="${cx - 5}" y="${cy2 - r + 1}" width="10" height="${(r * 0.26).toFixed(1)}" rx="2" fill="${ring}" transform="rotate(${i * 45 + 22.5} ${cx} ${cy2})"/>`);
  s.push(`<circle cx="${cx}" cy="${cy2}" r="${(r * 0.66).toFixed(1)}" fill="${base}" stroke="${ring}" stroke-width="2.5" stroke-dasharray="5 4"/>`);
  s.push(`<circle cx="${cx}" cy="${(cy2 - r * 0.42).toFixed(1)}" r="${(r * 0.09).toFixed(1)}" fill="${C['bulb-glow']}"/>`);
  const fs = r * (value < 10 ? 0.62 : 0.54);
  s.push(t(cx, cy2 + fs * 0.42, value, Math.round(fs), ink, UI, 900));
  if (state === 'selected') s.push(`<circle cx="${cx}" cy="${cy2}" r="${r + 6}" fill="none" stroke="${C.marigold}" stroke-width="4"/>`);
  if (state === 'disabled') s.push(`<circle cx="${cx}" cy="${cy2}" r="${r + 1}" fill="#2A2438" opacity="0.62"/>`);
  return s.join('');
}

/** Gamble pick card. state: idle | hover | selected | disabled. bulbOverride: lit colour during the flip. */
export function pickCard(cx, cy, colour, state = 'idle', { w = 280, h = 214, bulbState = null } = {}) {
  const x = cx - w / 2, y = cy - h / 2;
  const red = colour === 'red';
  const name = red ? 'RED' : 'WHITE';
  const keyhint = red ? 'R  ·  ←' : 'W  ·  →';
  const sel = state === 'selected';
  const fill = state === 'hover' ? '#2A1A4E' : '#160C2C';
  const edge = state === 'hover' ? C.cream : C['night-panel-edge'];
  const s = [];
  if (sel) s.push(rect(x - 6, y - 6, w + 12, h + 12, 22, C.marigold, 'none', 0, 'opacity="0.35" filter="url(#fBlur6)"'));
  s.push(rect(x, y, w, h, 18, fill, sel ? C['pick-selected-ring'] : edge, sel ? 4 : 2));
  const r = h * 0.2, bcy = y + h * 0.41;
  const lit = sel || state === 'hover';
  const bulbMarkup = (st) => {
    let m = bulb(cx, bcy, r, st);
    if (st === 'off') m += `<circle cx="${cx}" cy="${bcy}" r="${r}" fill="${red ? '#B0182E' : '#E9DFC8'}" opacity="0.55"/>`;
    return m;
  };
  if (!bulbState) s.push(bulbMarkup(lit ? (red ? 'red' : 'white') : 'off'));
  s.push(t(cx, y + h * 0.74, name, h * 0.13, red ? '#FF8A98' : C.cream, UI, 900, 'middle', 2));
  s.push(t(cx, y + h * 0.9, keyhint, h * 0.075, C['text-muted-on-dark'], UI, 800));
  if (state === 'disabled') s.push(rect(x, y, w, h, 18, '#2A2438', 'none', 0, 'opacity="0.62"'));
  if (bulbState) s.push(bulbMarkup(bulbState)); // flip alternation drawn above the disabled veil
  if (sel) {
    s.push(rect(cx - 66, y + 8, 132, 26, 13, C.marigold, '#2A160A', 1.5));
    s.push(t(cx, y + 26, '✓ YOUR PICK', 14, '#2A160A', UI, 900));
  }
  return s.join('');
}

const BTN_STYLES = {
  neutral: ['url(#gBtn)', C.cream, C['night-panel-edge']],
  start: ['url(#gRed)', '#FFFFFF', C.marigold],
  collect: ['url(#gMari)', '#2A160A', '#FFE9A3'],
  gamble: ['url(#gRed)', '#FFFFFF', C.marigold],
  refill: ['url(#gTurq)', '#0E2233', '#B9FFF8'],
};

/** state: default | hover | pressed | disabled */
export function button(x, y, w, h, label, kind = 'neutral', state = 'default', sub = null, size = 24, family = UI) {
  let [fill, ink, edge] = BTN_STYLES[kind];
  if (state === 'hover' && kind === 'neutral') fill = 'url(#gBtnHover)';
  const sc = state === 'pressed' ? 0.96 : 1;
  if (state === 'disabled') [fill, ink, edge] = ['url(#gDisabled)', C['disabled-text'], '#5A5270'];
  const s = [state !== 'pressed' ? rect(x, y + 6, w, h, 14, '#000', 'none', 0, 'opacity="0.45"') : rect(x, y + 3, w, h, 14, '#000', 'none', 0, 'opacity="0.45"')];
  const inner = [rect(x, y, w, h, 14, fill, edge, 3)];
  if (state === 'hover') inner.push(rect(x + 3, y + 3, w - 6, h / 2 - 3, 11, '#FFFFFF', 'none', 0, 'opacity="0.12"'));
  const ty = y + h / 2 + size * 0.36 - (sub ? 9 : 0);
  inner.push(t(x + w / 2, ty, label, size, ink, family, family === UI ? 900 : 400, 'middle', 0,
    kind === 'collect' || kind === 'refill' || state === 'disabled' ? '' : 'stroke="#2A160A" stroke-width="3" paint-order="stroke"'));
  if (sub) inner.push(t(x + w / 2, y + h - 13, sub, 13, ink, UI, 800, 'middle', 0, 'opacity="0.85"'));
  const tr = sc !== 1 ? `transform="translate(${x + w / 2} ${y + h / 2}) scale(${sc}) translate(${-(x + w / 2)} ${-(y + h / 2)})"` : '';
  s.push(g(inner.join(''), tr));
  return s.join('');
}

function histHalf(x, y, w, n) {
  const tier = MULT[n];
  const tk = TIER[String(tier)];
  const fill = tier === 1920 ? 'url(#gGold)' : tk.fill;
  const lab = tk.label;
  return rect(x, y, w, 70, 9, fill, tk.edge, 1.5) + t(x + w / 2, y + 28, `#${n}`, 17, tk.text, UI, 900) + t(x + w / 2, y + 56, lab, lab.length < 5 ? 15 : 13, tk.text, SIGN, 400);
}

/** Last 10 rounds, oldest left. entries: number | [first, second] (Double Run = ONE double-width entry). */
export function historyStrip(x, y, results, w = 548) {
  const s = [t(x, y, 'LAST 10 RESULTS', 15, C['text-muted-on-dark'], UI, 900, 'start', 2), t(x + w, y, 'newest ▸', 13, C['text-muted-on-dark'], UI, 800, 'end')];
  const gap = 6;
  const entries = [...results, ...new Array(Math.max(0, 10 - results.length)).fill(null)];
  const isPair = (e) => Array.isArray(e);
  const slots = entries.reduce((a, e) => a + (isPair(e) ? 2 : 1), 0);
  const unit = (w - (entries.length - 1) * gap - entries.filter(isPair).length * gap) / slots;
  let cx = x;
  for (const e of entries) {
    if (e === null) {
      s.push(rect(cx, y + 14, unit, 70, 9, '#0F0822', C['night-panel-edge'], 1.5, 'stroke-dasharray="4 4"'));
      cx += unit + gap;
    } else if (isPair(e)) {
      const ww = unit * 2 + gap;
      s.push(rect(cx - 3, y + 11, ww + 6, 76, 11, C['second-light']));
      s.push(histHalf(cx, y + 14, unit, e[0]), histHalf(cx + unit + gap, y + 14, unit, e[1]));
      s.push(`<circle cx="${cx + ww - 5}" cy="${y + 17}" r="8" fill="${C['second-light']}" stroke="#0E2233" stroke-width="1.5"/>` + t(cx + ww - 5, y + 21.5, '2', 11, '#0E2233', UI, 900));
      s.push(rect(cx + ww / 2 - 29, y + 79, 58, 17, 8, C['second-light'], '#0E2233', 1));
      s.push(t(cx + ww / 2, y + 91.5, 'DOUBLE', 11, '#0E2233', UI, 900, 'middle', 0.5));
      cx += ww + gap;
    } else {
      s.push(histHalf(cx, y + 14, unit, e));
      cx += unit + gap;
    }
  }
  return s.join('');
}

export function toast(cx, y, text, kind = 'warn', w = 548) {
  const col = { warn: C.marigold, error: C.danger, info: C.turquoise }[kind];
  const ic = { warn: '!', error: '×', info: 'i' }[kind];
  const x = cx - w / 2;
  return rect(x, y, w, 80, 14, '#0F0822', col, 3, 'filter="url(#fSoft)"') + `<circle cx="${x + 40}" cy="${y + 40}" r="18" fill="${col}"/>` +
    t(x + 40, y + 47, ic, 22, '#0E0820', UI, 900) + t(x + 72, y + 48, text, 20, C.cream, UI, 800, 'start');
}

export function footerHints(text) {
  return rect(24, 990, 1872, 52, 26, '#0B0618', C['night-panel-edge'], 1.5, 'opacity="0.9"') + t(W / 2, 1023, text, 17, C['text-muted-on-dark'], UI, 800);
}

/** lines: [text, colour, weight, size]. arrow: down | up | left | right (side of the tooltip that points to the target). */
export function tooltip(x, y, lines, w = 270, arrow = 'down') {
  const h = 26 + 26 * lines.length;
  const s = [rect(x, y, w, h, 12, '#0F0822', C.cream, 2, 'filter="url(#fSoft)"')];
  if (arrow === 'down') s.push(`<path d="M${x + w / 2 - 10},${y + h} L${x + w / 2},${y + h + 12} L${x + w / 2 + 10},${y + h} Z" fill="#0F0822" stroke="${C.cream}" stroke-width="2"/>` + rect(x + w / 2 - 12, y + h - 3, 24, 4, 0, '#0F0822'));
  else if (arrow === 'up') s.push(`<path d="M${x + w / 2 - 10},${y} L${x + w / 2},${y - 12} L${x + w / 2 + 10},${y} Z" fill="#0F0822" stroke="${C.cream}" stroke-width="2"/>` + rect(x + w / 2 - 12, y - 1, 24, 4, 0, '#0F0822'));
  else if (arrow === 'left') s.push(`<path d="M${x},${y + h / 2 - 10} L${x - 12},${y + h / 2} L${x},${y + h / 2 + 10} Z" fill="#0F0822" stroke="${C.cream}" stroke-width="2"/>` + rect(x - 2, y + h / 2 - 12, 4, 24, 0, '#0F0822'));
  else if (arrow === 'right') s.push(`<path d="M${x + w},${y + h / 2 - 10} L${x + w + 12},${y + h / 2} L${x + w},${y + h / 2 + 10} Z" fill="#0F0822" stroke="${C.cream}" stroke-width="2"/>` + rect(x + w - 2, y + h / 2 - 12, 4, 24, 0, '#0F0822'));
  lines.forEach(([txt, col, wt, sz], i) => s.push(t(x + 16, y + 32 + i * 26, txt, sz, col, UI, wt, 'start')));
  return { markup: s.join(''), h };
}

export function modalFrame(x, y, w, h, title, titleCol = null) {
  const s = [g(rect(x, y, w, h, 24, 'url(#gPly)'), 'filter="url(#fShadow)"'), rect(x, y, w, h, 24, C['plywood-light'], 'none', 0, 'filter="url(#fWood)"'),
    rect(x + 8, y + 8, w - 16, h - 16, 18, 'none', C['paint-red'], 6), rect(x + 20, y + 20, w - 40, h - 40, 12, '#22143E', 'none', 0, 'opacity="0.97"')];
  for (const [sx, sy] of [[x + 15, y + 15], [x + w - 15, y + 15], [x + 15, y + h - 15], [x + w - 15, y + h - 15]]) {
    s.push(`<circle cx="${sx}" cy="${sy}" r="4.5" fill="#D9C29A" stroke="#5C3A1A" stroke-width="1.5"/>`);
  }
  if (title) s.push(t(x + w / 2, y + 96, title, 60, titleCol || C.marigold, DISP, 400, 'middle', 0, 'stroke="#2A160A" stroke-width="7" paint-order="stroke"'));
  return s.join('');
}

export function toggle(x, y, on, disabled = false) {
  const s = [];
  if (disabled) {
    s.push(rect(x, y, 96, 44, 22, '#38324A', '#5A5270', 2, 'stroke-dasharray="6 4"'));
    s.push(`<circle cx="${x + 22}" cy="${y + 22}" r="16" fill="#6A6280"/>`);
    s.push(t(x + 64, y + 28, 'OFF', 15, C['disabled-text'], UI, 900));
    return s.join('');
  }
  s.push(rect(x, y, 96, 44, 22, on ? C.turquoise : '#2E1E52', on ? C.cream : C['night-panel-edge'], 2));
  s.push(`<circle cx="${on ? x + 74 : x + 22}" cy="${y + 22}" r="17" fill="${C.cream}" stroke="#2A160A" stroke-width="1.5"/>`);
  s.push(t(on ? x + 34 : x + 64, y + 28, on ? 'ON' : 'OFF', 15, on ? '#0E2233' : C['text-muted-on-dark'], UI, 900));
  return s.join('');
}

export function slider(x, y, w, val) {
  const kx = x + (w * val) / 100;
  const s = [rect(x, y - 5, w, 10, 5, '#0F0822', C['night-panel-edge'], 1.5), rect(x, y - 5, Math.max(0, kx - x), 10, 5, C.marigold)];
  for (let i = 0; i < 11; i++) s.push(`<line x1="${x + (w * i) / 10}" y1="${y + 12}" x2="${x + (w * i) / 10}" y2="${y + 18}" stroke="${C['text-muted-on-dark']}" stroke-width="1.5"/>`);
  s.push(`<circle cx="${kx}" cy="${y}" r="15" fill="${C.cream}" stroke="#2A160A" stroke-width="2"/>`);
  s.push(t(x + w + 56, y + 9, `${val}`, 26, C.cream, UI, 900, 'end'));
  return s.join('');
}

export function miniMap(x, y, cell = 19) {
  const s = [t(x, y - 14, 'BOARD LAYOUT (FIXED)', 15, C['text-muted-on-dark'], UI, 900, 'start', 2)];
  for (let n = 1; n <= 50; n++) {
    const [col, row] = squarePos(n);
    const tier = MULT[n];
    const tk = TIER[String(tier)];
    const sx = x + col * (cell + 2), sy = y + row * (cell + 2);
    s.push(rect(sx, sy, cell, cell, 4, tier === 1920 ? 'url(#gGold)' : tk.fill, '#0E0820', 1));
    s.push(t(sx + cell / 2, sy + cell / 2 + 4, n, 11, tk.text, UI, 900));
  }
  s.push(t(x + 8 * (cell + 2), y + 5.5 * (cell + 2), '#1 top-left, clockwise', 15, C.cream, UI, 800));
  const ix = x - 20, iy = y + 11 * (cell + 2) - 10;
  const labels = [[1920, '★ 1920x  #8'], [960, '960x  #21, #46'], [480, '480x  #3 13 18 29 34 40 49'], [96, '96x  19 squares'], [24, '24x  21 squares']];
  labels.forEach(([tier, lab], i) => {
    const tk = TIER[String(tier)];
    s.push(rect(ix + 20, iy + 40 + i * 30, 18, 18, 4, tier === 1920 ? 'url(#gGold)' : tk.fill, '#0E0820', 1));
    s.push(t(ix + 46, iy + 55 + i * 30, lab, 15, C.cream, UI, 800, 'start'));
  });
  return s.join('');
}

export function wrap(txt, n) {
  const words = txt.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur.length + w.length + 1 > n && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  lines.push(cur);
  return lines;
}
