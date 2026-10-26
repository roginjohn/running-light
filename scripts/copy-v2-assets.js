#!/usr/bin/env node
// One-off sync of the approved v2 design assets into the game (never edits design/). Tokens and the v3 fonts now
// come from docs/design-v3 and scripts/copy-v3-fonts.js; Plus Jakarta Sans 800 stays for the v2 chip SVG numerals.
// Usage: node scripts/copy-v2-assets.js
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const GAME = path.resolve(new URL('..', import.meta.url).pathname);
const DESIGN = path.resolve(GAME, '../design/redesign-v2');
const FS = path.join(GAME, 'node_modules/@fontsource');

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`${path.relative(GAME, from)} -> ${path.relative(GAME, to)}`);
}

for (const dir of ['chips', 'icons', 'ui', 'bulbs', 'gamble']) {
  for (const f of readdirSync(path.join(DESIGN, 'assets', dir))) {
    if (f.endsWith('.svg')) copy(path.join(DESIGN, 'assets', dir, f), path.join(GAME, 'src/assets/v2', dir, f));
  }
}
for (const w of [800]) {
  const f = `plus-jakarta-sans-latin-${w}-normal.woff2`;
  copy(path.join(FS, 'plus-jakarta-sans/files', f), path.join(GAME, 'src/assets/fonts', f));
}
copy(path.join(FS, 'plus-jakarta-sans/LICENSE'), path.join(GAME, 'public/fonts/LICENSE-PlusJakartaSans-OFL.txt'));
