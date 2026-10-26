#!/usr/bin/env node
// One-off sync of the approved v2 design assets into the game (never edits design/). Tokens and the v3 fonts now
// come from docs/design-v3 and scripts/copy-v3-fonts.js. The v2 chips (and with them Plus Jakarta Sans 800) were
// replaced by the v3 flat chips in batch 3, so they are no longer copied.
// Usage: node scripts/copy-v2-assets.js
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const GAME = path.resolve(new URL('..', import.meta.url).pathname);
const DESIGN = path.resolve(GAME, '../design/redesign-v2');

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`${path.relative(GAME, from)} -> ${path.relative(GAME, to)}`);
}

for (const dir of ['icons', 'ui', 'bulbs', 'gamble']) {
  for (const f of readdirSync(path.join(DESIGN, 'assets', dir))) {
    if (f.endsWith('.svg')) copy(path.join(DESIGN, 'assets', dir, f), path.join(GAME, 'src/assets/v2', dir, f));
  }
}
