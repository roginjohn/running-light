// WCAG 2.x contrast for the Christmas skin. Colours are read from src/styles/tokens.css with the :root overrides in
// xmas.css on top, so the table cannot drift from the stylesheet. Text pairs need 4.5:1 (normal) or 3:1 (large: the
// centre number); UI pairs (rims, state fills next to a plain square) need 3:1. Disabled controls are listed for
// information only (WCAG 1.4.3 exempts them). Run: node docs/design-v4/christmas/contrast.mjs [--md]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const vars = {};
for (const f of [join(HERE, '../../../src/styles/tokens.css'), join(HERE, 'xmas.css')]) {
  const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) for (const [, k, v] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[k] = v.trim();
}
const col = (v) => { let s = v; for (let i = 0; i < 9 && s.startsWith('var('); i++) s = vars[s.slice(4, -1)]; if (!/^#[0-9a-f]{6}$/i.test(s)) throw new Error(`not a hex colour: ${v} -> ${s}`); return s.toLowerCase(); };
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const v = (n) => `var(--${n})`;
// [where, foreground, background, kind]  kind: text | large | ui | disabled
const PAIRS = [
  ['Body / labels on frame', v('c-text-primary'), v('c-bg-frame'), 'text'],
  ['Titles on frame', v('c-text-strong'), v('c-bg-frame'), 'text'],
  ['Muted text on page', v('c-text-muted'), v('c-bg-page'), 'text'],
  ['Muted text on frame', v('c-text-muted'), v('c-bg-frame'), 'text'],
  ['Muted text on dock rail', v('c-text-muted'), v('c-bg-rail'), 'text'],
  ['Muted text on card', v('c-text-muted'), v('c-bg-card'), 'text'],
  ['Muted text on input / ½ ×2', v('c-text-muted'), v('c-bg-input'), 'text'],
  ['Square number on square', v('c-text-muted'), v('c-tile'), 'text'],
  ['Primary text on input', v('c-text-primary'), v('c-bg-input'), 'text'],
  ['Pill text on card pill', v('c-text-primary'), v('c-bg-card-pill'), 'text'],
  ['24x on square', v('c-tier-24'), v('c-tile'), 'text'],
  ['96x on square', v('c-tier-96'), v('c-tile'), 'text'],
  ['480x / 960x on square', v('c-tier-480'), v('c-tile'), 'text'],
  ['1920x star / pill on jackpot berry', v('x-gold'), '#4a0a17', 'text'],
  ['Lit square multiplier', v('c-text-on-light'), v('c-tile-lit'), 'text'],
  ['Win square / Collect (win green)', v('c-text-on-green'), v('c-accent-green'), 'text'],
  ['Win amount on win card', v('c-accent-green-text'), '#1b2a1a', 'text'],
  ['Win delta on top bar', v('c-accent-green-text'), v('c-bg-frame'), 'text'],
  ['Loss / error text on frame', v('c-accent-red-text'), v('c-bg-frame'), 'text'],
  ['Loss chip text on card', v('c-accent-red-text'), v('c-bg-card'), 'text'],
  ['Bet badge / Betting open (bet blue)', v('c-text-strong'), v('c-accent-blue'), 'text'],
  ['Start / Play / Reload (gold)', v('x-gold-ink'), v('x-gold'), 'text'],
  ['Gamble button (berry)', '#ffffff', v('x-berry'), 'text'],
  ['Chip 1 (snow)', v('c-chip-1-ink'), v('c-chip-1'), 'text'],
  ['Chip 5 (berry)', v('c-chip-5-ink'), v('c-chip-5'), 'text'],
  ['Chip 10 (pine)', v('c-chip-10-ink'), v('c-chip-10'), 'text'],
  ['Chip 25 (gold)', v('c-chip-25-ink'), v('c-chip-25'), 'text'],
  ['Chip 50 (dark pine)', v('c-chip-50-ink'), v('c-chip-50'), 'text'],
  ['Gamble panel text (navy, unchanged)', '#a9bbd6', v('c-bg-panel-navy'), 'text'],
  ['Centre number, idle (40-64 px)', v('c-big-number'), v('c-bg-frame'), 'large'],
  ['Centre number, win (gold, 40-64 px)', v('c-big-number-win'), v('c-bg-frame'), 'large'],
  ['Bet rim (blue) vs square', v('c-accent-blue'), v('c-tile'), 'ui'],
  ['Win square (green) vs square', v('c-accent-green'), v('c-tile'), 'ui'],
  ['Lit square (snow) vs square', v('c-tile-lit'), v('c-tile'), 'ui'],
  ['Jackpot gold rim vs frame', v('x-gold-edge'), v('c-bg-frame'), 'ui'],
  ['Win card gold rim vs frame', v('x-gold-edge'), v('c-bg-frame'), 'ui'],
  ['Gold Start vs dock rail', v('x-gold'), v('c-bg-rail'), 'ui'],
  ['Berry Gamble vs dock rail', v('x-berry'), v('c-bg-rail'), 'ui'],
  ['Win green vs bet blue (state vs state)', v('c-accent-green'), v('c-accent-blue'), 'info'],
  ['Disabled button text', v('c-btn-disabled-text'), v('c-btn-disabled'), 'disabled'],
  ['Dim (disabled) text on input', v('c-text-dim'), v('c-bg-input'), 'disabled'],
];
const NEED = { text: 4.5, large: 3, ui: 3 };

export function contrast() {
  return PAIRS.map(([where, f, b, kind]) => {
    const fg = col(f), bg = col(b), raw = ratio(fg, bg); // pass/fail on the unrounded ratio
    return { where, fg, bg, kind, ratio: +raw.toFixed(2), need: NEED[kind] ?? null, pass: NEED[kind] ? raw >= NEED[kind] : null };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = contrast();
  if (process.argv.includes('--md')) {
    console.log('| Where | Foreground | Background | Ratio | Needs | Result |\n|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.where} | \`${r.fg}\` | \`${r.bg}\` | ${r.ratio.toFixed(2)}:1 | ${r.need ? `${r.need}:1 (${r.kind})` : r.kind} | ${r.pass === null ? 'n/a' : r.pass ? 'pass' : '**FAIL**'} |`);
  } else for (const r of rows) console.log(`${r.pass === false ? 'FAIL' : r.pass ? ' ok ' : ' -- '} ${r.ratio.toFixed(2).padStart(5)}  ${r.fg} on ${r.bg}  ${r.where}`);
  if (rows.some((r) => r.pass === false)) process.exit(1);
}
