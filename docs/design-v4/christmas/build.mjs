// Running Light v4 mobile mocks, Christmas skin: writes mocks/*.html from the base mocks in ../mobile/mocks (read-only).
// Each page keeps the base DOM; the only changes are the stylesheet links (base mock.css, then ../xmas.css), the
// title, and a few aria-hidden, absolutely positioned SVG decorations (no layout impact). The injected markup is also
// written to decor-snippets.html so its weight can be measured. Run: node docs/design-v4/christmas/build.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, '../mobile/mocks');
const OUT = join(HERE, 'mocks');
const PAGES = ['betting', 'running', 'win-gamble-offer', 'gamble-flip', 'loss', 'settings', 'paytable', 'help', 'refill', 'start', 'loading', 'error', 'tip-sheet', 'rotate'];

// holly sprig sitting on the top bar's bottom edge
export const HOLLY = '<svg class="xd xd-holly" viewBox="0 0 22 12" aria-hidden="true" focusable="false"><path fill="#3a9a62" stroke="#173d2a" stroke-width=".6" d="M1 7c3-5 7-6 10-3-3 3-7 4-10 3zm20 0c-3-5-7-6-10-3 3 3 7 4 10 3z"/><circle cx="9" cy="8" r="2.6" fill="#dc1f3f"/><circle cx="13" cy="8" r="2.6" fill="#dc1f3f"/><circle cx="11" cy="5" r="2.6" fill="#e01a3c"/></svg>';
// light-bulb string: a repeating 56 px pattern (wire + 4 bulbs) split over two rects so half the bulbs can twinkle
const bulbs = (xs) => xs.map(([x, c]) => `<rect x="${x - 1}" y="2" width="2" height="2" fill="#2f5e45"/><ellipse cx="${x}" cy="5.4" rx="2" ry="2.6" fill="${c}"/>`).join('');
export const LIGHTS = '<svg class="xd xd-lights" aria-hidden="true" focusable="false"><defs>'
  + '<pattern id="xla" width="56" height="8" patternUnits="userSpaceOnUse"><path d="M0 1.5Q7 3.5 14 1.5T28 1.5T42 1.5T56 1.5" fill="none" stroke="#2f5e45"/>'
  + bulbs([[7, '#e0283f'], [35, '#3fbf6f']]) + '</pattern>'
  + `<pattern id="xlb" width="56" height="8" patternUnits="userSpaceOnUse">${bulbs([[21, '#f2c14e'], [49, '#f4f1ea']])}</pattern>`
  + '</defs><rect width="100%" height="8" fill="url(#xla)"/><rect class="b2" width="100%" height="8" fill="url(#xlb)"/></svg>';

function skin(html, page) {
  let out = html
    .replace('<link rel="stylesheet" href="mock.css">', '<link rel="stylesheet" href="../../mobile/mocks/mock.css">\n<link rel="stylesheet" href="../xmas.css">')
    .replace(/<title>(.*?)<\/title>/, '<title>$1 (Christmas)</title>');
  out = out.replace(/(<header class="top">[\s\S]*?)(<\/header>)/, `$1${HOLLY}$2`);
  out = out.replace(/(<section class="dock[^"]*"[^>]*>)/, `$1${LIGHTS}`);
  out = out.replace(/(<div class="screen [^"]*">)/, `$1${LIGHTS}`);
  if (!out.includes('../xmas.css')) throw new Error(`${page}: stylesheet link not found`);
  return out;
}

export function build() {
  // the base pages are only read; if they are missing, ask for the base build rather than writing into ../mobile
  if (PAGES.some((p) => !existsSync(join(BASE, `${p}.html`)))) throw new Error('base mocks missing: run node docs/design-v4/mobile/build.mjs first');
  mkdirSync(OUT, { recursive: true });
  for (const p of readdirSync(BASE).filter((f) => f.endsWith('.html'))) writeFileSync(join(OUT, p), skin(readFileSync(join(BASE, p), 'utf8'), p));
  writeFileSync(join(HERE, 'decor-snippets.html'), `<!-- markup build.mjs injects: holly in .top, lights in .dock / .screen -->\n${HOLLY}\n${LIGHTS}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { build(); console.log(`wrote ${OUT}`); }
