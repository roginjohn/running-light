# v3 Batch 1: design tokens and fonts

Branch `v3/batch-1-tokens`. Not committed. Only tokens and fonts changed. There are no layout, component or behaviour changes, and nothing under `src/engine/` was touched.

## Changed files
| File | Change |
|---|---|
| `src/data/design-tokens-v3.json` | **New** token source. It copies `color`, `font`, `type`, `space`, `radius`, `border`, `shadow`, `size`, `layout`, `motion`, `z`, `paytable` and `rules` verbatim from `docs/design-v3/tokens.json`. It adds: `board-arrangement` (built from the v3 paytable and checked against v2/config.js), `legacy` (v2 variable names mapped to v3 values) and `contrast` (46 WCAG pairs). |
| `src/data/design-tokens-v2.json` | **Deleted** (replaced by v3). |
| `scripts/gen-tokens.js` | Reads the v3 JSON and resolves `{color.x}`/`{radius.x}`/`{legacy.x}` references. It emits the v3 variables (`--c-*`, `--o-tile-trail-1..3`, `--f-sans`, `--f-mono`, `--fs-/--fw-/--lh-*`, `--sp-*`, `--r-*`, `--b-*`) and then the v2 names as aliases (`--c-amber: var(--c-accent-blue-text)`, etc.). |
| `src/styles/tokens.css` | Regenerated. |
| `src/styles.css` | Header comment and `@font-face` block only: Poppins 600/700 and JetBrains Mono 600 (`font-display: swap`). The Bungee and Plus Jakarta Sans 500/600/700 rules are removed. |
| `src/main.js` | Imports `design-tokens-v3.json` for the startup arrangement assertion. The boot font preload list is now Poppins 600/700, JetBrains Mono 600 and Plus Jakarta Sans 800. |
| `src/assets/fonts/` | + `poppins-latin-{600,700}-normal.woff2`, `jetbrains-mono-latin-600-normal.woff2` (37.7 KB total, < 80 KB budget). Removed: bungee, carter-one, lobster, nunito 700/800/900 and plus-jakarta-sans 500/600/700. |
| `public/fonts/` | + `LICENSE-Poppins-OFL.txt`, `LICENSE-JetBrainsMono-OFL.txt`. Removed: the Bungee, CarterOne, Lobster and Nunito licences. |
| `package.json` / `package-lock.json` | devDeps + `@fontsource/poppins`, `@fontsource/jetbrains-mono`. Removed: `@fontsource/bungee`, `carter-one`, `lobster`, `nunito`. |
| `scripts/copy-v3-fonts.js` | **New**. Reproducibly copies the v3 woff2 files and licences from `node_modules/@fontsource`. |
| `scripts/copy-v2-assets.js` | No longer copies the v2 tokens, Bungee or Plus Jakarta Sans 500–700 (it would have restored deleted files). |
| `test/unit/tokens-v2.test.js` → `tokens-v3.test.js` | Asserts the v3 contrast pairs and that the v3 sections equal `docs/design-v3/tokens.json`. Also checks the arrangement, that tokens.css is in sync and that every `var(--c-/--t/--r-/--sh-/--z-/--f-…)` used in `src/styles.css`/`src/ui/` is defined. A last test checks the v3 fonts. |
| `test/ui/ui.test.js` | The font test asserts Poppins 600/700, JetBrains Mono 600 and Plus Jakarta Sans 800 instead of Bungee and Plus Jakarta Sans 500/700/800. |

## v2 → v3 mapping decisions (in `legacy`)
- Backgrounds: bg-0→bg-page, bg-1→bg-frame, bg-2→bg-card, bg-3→tile, bg-4/line-hi→border-input, line→divider.
- Text: text-hi and text-mid→text-primary, text-lo→text-muted, text-disabled→text-dim.
- Accents: each v2 accent name is used both as **text** and as a **fill**. So that small text still passes AA, they map to the `accent-*-text` variants: amber/cyan→accent-blue-text (ink text-on-light), coral→accent-red-text. mint→accent-green (4.62–5.03 as text, ink text-on-green). As a result the v2 Start/Collect buttons are light blue with dark text, not v3's `#0d6efd` with white. Batch 3 restyles the buttons with the real v3 tokens.
- Tiers: the fill is the tile (navy for 1920x), the ink is the v3 tier colour and the edge is tile-border.
- Radius: xs/md→input 6, sm→button 6, lg→card 8, xl/sheet→frame 8. The v2 space steps 12/16 were unused and are dropped.
- Shadows: every v2 shadow and glow is now `none` (v3 is flat). `--sh-focus` = 2px white ring.
- **z-index is kept at the v2 values** (stacking is structure, not colour/type/spacing). The v3 `z` names collide (toast/scrim) and the new frame comes in batch 2.

## Not removed (still referenced)
- **Plus Jakarta Sans 800** (woff2, @font-face, licence, devDep): the five inlined v2 chip SVGs (`src/assets/v2/chips/*.svg`) set `font-family="Plus Jakarta Sans" font-weight="800"`. Remove it in batch 3, when chips become pure CSS.
- `src/data/design-tokens.json` (v1) is still read by `test/unit/math.test.js` and the dead v1 `src/ui/svg.js`/`render.js`. These modules aren't imported anywhere. They still contain Nunito/Carter One/Lobster family-name strings, but they never loaded those font files. Cleanup is a batch 7 job.

## Known leftovers for later batches
- `src/styles.css` still has hard-coded v2 colours (purple background gradients, amber/mint/cyan rgba glows, bulb gradients), so the page background is still purple-ish. The v2 chip and icon SVG colours are hard-coded too.
- No `<link rel="preload">` for the Poppins files yet (perf-notes asks for it). That is an index.html/build change, for batch 7.
- README.md and IMPLEMENTATION-REPORT.md still describe the v2 fonts.

## Results
- `npm test`: **54/54 pass** (including 6 token tests; 46 contrast pairs pass).
- `npm run build` (needed by test:ui): OK. Fonts in the bundle: Poppins 600 8.0 KB, Poppins 700 7.8 KB, JetBrains Mono 21.9 KB, Plus Jakarta Sans 800 11.9 KB. Licences are in `dist/fonts/`.
- `npm run test:ui`: **27/27 pass**. No console errors, no failed or external requests, fonts loaded locally.
- `npm run sim:quick`: RTP **95.613%** (band 95.45 ± 0.3: PASS). Gamble 49.97%, Double Run 4.02%, E2 PASS.
- `git diff main -- src/engine`: empty.
- `npm run screenshots` (in the ignored `test-results/v2/`): 88 captures, 0 WIN-tag overlaps, no console or network issues. Checked by eye at 1920×1080: readable, on the v3 palette and Poppins.
