# Running Light

A browser version of the Philippine perya "Running Light" bulb-track game, redesign **v3** (flat UI).

Place play credits on the 50 squares of a 16 × 11 track, press Start, and a light runs around the ring and stops on
one square. A square pays its multiplier (24x, 96x, 480x, 960x or 1920x) times the bet on it. Sometimes a second
light runs (Double Run). After a win you can collect it or gamble it up to 3 times on a red/white pick.

**Simulated play credits only. No real money.** Credits cannot be bought, cashed out or transferred, and there is a
free refill to 1,000 when you run out. There are no payments, accounts, backend, analytics or network requests at
runtime; everything runs and is saved in the browser (`localStorage`).

Live site: https://roginjohn.github.io/running-light/

## Setup and run

Requires Node 22+ (see `.nvmrc`; `package.json` sets `"engines": { "node": ">=22" }`). All commands run from the repo
root.

```bash
npm ci                      # install dev dependencies (Vite, puppeteer-core, @fontsource fonts)
npm run dev                 # dev server on http://localhost:5173 (runs `npm run tokens` first)
npm run build               # static, offline bundle in dist/ (runs `npm run tokens` first)
npm run preview             # serve dist/ on http://localhost:4173
```

All `package.json` scripts:

| Script | Command | What it does |
|---|---|---|
| `dev` | `vite` | Dev server (port 5173). `predev` runs `gen-tokens.js` first |
| `build` | `vite build` | Builds `dist/` with relative paths. `prebuild` runs `gen-tokens.js` first |
| `preview` | `vite preview --port 4173 --strictPort` | Serves the built `dist/` |
| `test` | `node --test --test-reporter=spec test/unit/*.test.js` | Unit tests |
| `test:unit` | same as `test` | Unit tests |
| `test:ui` | `node --test --test-concurrency=1 --test-reporter=spec test/ui/ui.test.js` | Browser tests in Chrome via puppeteer-core; needs a build first |
| `sim` | `node scripts/simulate.js` | Seeded simulation (default 5,000,000 rounds per strategy) |
| `sim:quick` | `node scripts/simulate.js --rounds 1000000 --out /tmp/rl-sim` | 1M-round simulation |
| `screenshots:v3` | `node test/ui/screenshots-v3.js` | v3 states plus side-by-side compares with the `docs/design-v3/` mockups (default output `docs/design-v3/batch-7/`) |
| `perf:trace` | `node test/ui/perf-trace.js` | Chrome trace of one round at 1920×1080, real speed and 4× CPU throttling |
| `tokens` | `node scripts/gen-tokens.js` | Regenerates `src/styles/tokens.css` and checks the contrast pairs |

`node scripts/run-all.js` runs tokens, build, unit tests, UI tests and screenshots and saves the outputs in
`test-results/v3/` (git-ignored).

Set `CHROME=/path/to/chrome` if Chrome is not at `/usr/bin/google-chrome` (UI tests, screenshots, perf trace).

## Running the checks

Requires Node 22+ (see `.nvmrc`). Install with `npm ci`, then:

- `npm test` - unit tests
- `npm run sim:quick` - 1M-round simulation
- `npm run build` - production build
- `npm run test:ui` - UI tests in Chrome; needs a build first. Set `CHROME=/path/to/chrome`
  (default `/usr/bin/google-chrome`).

CI (`.github/workflows/ci.yml`) runs all of these on every pull request and every push to `main`.

## Stack

- Plain JavaScript ES modules, no framework. The UI renders with DOM + CSS: the 50 squares are persistent
  `<button>`s positioned from the layout tokens, and the running light is class swaps only.
- **Vite 5** for the dev server and the static `dist/` bundle (`base: './'`, fonts and icons bundled, works offline).
- **node:test** for unit tests and the simulation driver; **puppeteer-core** with an installed Chrome for UI tests.
- Audio: procedural Web Audio, no audio files (see [docs/AUDIO.md](docs/AUDIO.md)).

## Fonts

Three latin-only WOFF2 files are bundled from `src/assets/fonts/` (37.7 KB in total), all SIL OFL 1.1:

| Font | Weights | Use | Package |
|---|---|---|---|
| Poppins | 600, 700 | UI text | `@fontsource/poppins` |
| JetBrains Mono | 600 | The big centre number | `@fontsource/jetbrains-mono` |

The licences are in `public/fonts/` (`LICENSE-Poppins-OFL.txt`, `LICENSE-JetBrainsMono-OFL.txt`) and are copied to
`dist/fonts/` by the build. `scripts/copy-v3-fonts.js` copies the WOFF2 files and licences from
`node_modules/@fontsource` again if the font packages change (`node scripts/copy-v3-fonts.js`).

## Design tokens

| File | Role |
|---|---|
| `docs/design-v3/tokens.json` | Design source of truth for v3 (colour, type, spacing, radius, layout, motion, paytable, rules) |
| `docs/design-v3/tokens.md` | Explains the tokens: colour and contrast, type, spacing, layout, motion |
| `src/data/design-tokens-v3.json` | The token file the game reads. Copies the v3 sections of `tokens.json` verbatim and adds the board arrangement, the `legacy` v2 aliases and the WCAG contrast pairs. A unit test (`test/unit/tokens-v3.test.js`) checks the copied sections still equal `tokens.json` |
| `scripts/gen-tokens.js` | Generates `src/styles/tokens.css` from `src/data/design-tokens-v3.json`, and fails if any contrast pair misses its required ratio. Runs before `dev` and `build`, or with `npm run tokens` |
| `src/styles/tokens.css` | **Generated**; do not edit. CSS custom properties used by `src/styles.css` |

## Supported screens

These are the sizes the UI tests check (`test/ui/ui.test.js`) and the v3 mockups cover:

| Breakpoint | Width | Checked at |
|---|---|---|
| desktop-xl | ≥ 1600 | 1920×1080 |
| desktop | 1200–1599 | 1280×720 |
| tablet-landscape | < 1200 | 1024×768 |
| tablet-portrait | < 900 and portrait | 768×1024 (touch) |

The frame is centred, at most 1600×980, with a 230 px control rail on the left and a 40 px bottom bar. On tablet
portrait the controls move into a dock under the track.

**Phones are not designed for in this release.** Narrower portrait viewports fall back to the tablet-portrait layout
scaled down (the UI tests also check a 390×844 fallback); a phone layout is still an open question in
[docs/design-v3/open-questions.md](docs/design-v3/open-questions.md). Below 320 px wide or 480 px tall a
"Rotate / enlarge" screen is shown.

## Folder map

```
.github/workflows/ci.yml   CI: unit tests, sim:quick, build, UI tests in Chrome
index.html                 page shell (loading, rotate and app containers)
vite.config.js             relative base, dist/ output
src/
  main.js                  boot: fonts, tokens check, minimum-size screen, start screen
  styles.css               all component styles
  styles/tokens.css        generated from src/data/design-tokens-v3.json
  data/                    design-tokens-v3.json (used); design-tokens.json (v1 leftover)
  engine/                  game core: config, rng, outcome, bets, storage, game, lightpath. Locked (see CONTRIBUTING.md)
  ui/                      app.js (controller), view.js (state -> HTML), layout.js (breakpoints, track geometry),
                           track.js, lightplan.js, betscale.js, bettotals.js, icons.js, keys.js, audio.js;
                           render.js / svg.js are the retired v1 renderer (not imported)
  assets/fonts/            bundled WOFF2 fonts
  assets/v2/               the icons and 1920x star still in use
public/fonts/              font licences
scripts/                   gen-tokens.js, copy-v3-fonts.js, copy-v2-assets.js, simulate.js, run-all.js
test/unit/                 node:test suites
test/ui/                   ui.test.js, harness.js, scenes.js, smoke.js, screenshots-v3.js, perf-trace.js
docs/                      all documentation; start at docs/index.md
  design-v3/               v3 mockups, tokens, open questions, perf notes, per-batch NOTES.md and screenshots
  design/, spec/, math/    copied notes from the design, spec and math sessions
```

## Documentation

- [docs/index.md](docs/index.md): every doc in the repo, grouped
- [CHANGELOG.md](CHANGELOG.md): v2 baseline, the seven v3 batches and later maintenance
- [CONTRIBUTING.md](CONTRIBUTING.md): branches, the locked engine, checks for every batch, publishing
- [docs/IMPLEMENTATION-REPORT.md](docs/IMPLEMENTATION-REPORT.md): the original (v1) implementation report
- [docs/AUDIO.md](docs/AUDIO.md): how every sound is made
