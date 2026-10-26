#!/usr/bin/env node
// Copies the v3 fonts (latin-only WOFF2) and their OFL licences from the @fontsource devDependencies into the game.
// Poppins 600/700 (UI) + JetBrains Mono 600 (big numbers), per docs/design-v3/tokens.md §2. Usage: node scripts/copy-v3-fonts.js
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const GAME = path.resolve(new URL('..', import.meta.url).pathname);
const FS = path.join(GAME, 'node_modules/@fontsource');

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`${path.relative(GAME, from)} -> ${path.relative(GAME, to)}`);
}

for (const [pkg, weights, licence] of [['poppins', [600, 700], 'Poppins'], ['jetbrains-mono', [600], 'JetBrainsMono']]) {
  for (const w of weights) {
    const f = `${pkg}-latin-${w}-normal.woff2`;
    copy(path.join(FS, pkg, 'files', f), path.join(GAME, 'src/assets/fonts', f));
  }
  copy(path.join(FS, pkg, 'LICENSE'), path.join(GAME, `public/fonts/LICENSE-${licence}-OFL.txt`));
}
