#!/usr/bin/env node
// One-off sync of the approved v2 design assets that the v3 game still inlines (never edits design/). Tokens and the
// v3 fonts now come from docs/design-v3 and scripts/copy-v3-fonts.js. The v2 chips (and with them Plus Jakarta Sans
// 800) were replaced in batch 3; batch 7 removed the bulbs, gamble discs, logo mark and every icon nothing uses, so
// only the files below are copied (copying a whole folder would restore deleted files).
// Usage: node scripts/copy-v2-assets.js
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const GAME = path.resolve(new URL('..', import.meta.url).pathname);
const DESIGN = path.resolve(GAME, '../design/redesign-v2');
const KEEP = {
  icons: ['alert', 'check', 'gear', 'info', 'lock', 'mute', 'reload', 'sound', 'x'].map((n) => `icon-${n}.svg`),
  ui: ['star-1920.svg'],
};

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`${path.relative(GAME, from)} -> ${path.relative(GAME, to)}`);
}

for (const [dir, files] of Object.entries(KEEP)) {
  for (const f of files) copy(path.join(DESIGN, 'assets', dir, f), path.join(GAME, 'src/assets/v2', dir, f));
}
