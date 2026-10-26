#!/usr/bin/env node
// One-off sync of the approved v2 design assets, fonts and tokens into the game (never edits design/).
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
copy(path.join(DESIGN, 'design-tokens-v2.json'), path.join(GAME, 'src/data/design-tokens-v2.json'));
copy(path.join(FS, 'bungee/files/bungee-latin-400-normal.woff2'), path.join(GAME, 'src/assets/fonts/bungee-latin-400-normal.woff2'));
for (const w of [500, 600, 700, 800]) {
  const f = `plus-jakarta-sans-latin-${w}-normal.woff2`;
  copy(path.join(FS, 'plus-jakarta-sans/files', f), path.join(GAME, 'src/assets/fonts', f));
}
copy(path.join(FS, 'bungee/LICENSE'), path.join(GAME, 'public/fonts/LICENSE-Bungee-OFL.txt'));
copy(path.join(FS, 'plus-jakarta-sans/LICENSE'), path.join(GAME, 'public/fonts/LICENSE-PlusJakartaSans-OFL.txt'));
