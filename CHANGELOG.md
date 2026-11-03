# Changelog

Newest first. Each v3 batch has its full notes (changed files, checks, open issues) in
`docs/design-v3/batch-N/NOTES.md`. Nothing under `src/engine/` changed in any v3 batch. Play credits only.

## 2026-11-03 — Docs overhaul (PR #9)

- README rewritten for v3: what the game is, live site, setup and run commands matching `package.json`, bundled
  fonts, token files, supported screens and a folder map. The "Running the checks" section is unchanged.
- New [docs/index.md](docs/index.md) listing every doc in the repo.
- `AUDIO.md` and `IMPLEMENTATION-REPORT.md` moved to [docs/AUDIO.md](docs/AUDIO.md) and
  [docs/IMPLEMENTATION-REPORT.md](docs/IMPLEMENTATION-REPORT.md).
- Notes from the earlier sessions copied into `docs/design/`, `docs/spec/` and `docs/math/`.
- This changelog.

## 2026-11-03 — CI and test command fix (PR #8)

- `npm test` / `npm run test:unit` glob fixed: they now run `test/unit/*.test.js`.
- Node 22 pinned: `.nvmrc` and `"engines": { "node": ">=22" }` in `package.json`.
- GitHub Actions CI (`.github/workflows/ci.yml`) on every pull request and push to `main`: unit tests, `sim:quick`,
  build, and UI tests in Chrome.
- `main` branch protection requires the `checks` status to pass before merging.

## v3-batch-7 — 2026-10-27 — Performance and cleanup (PR #7, `a760ce5`)

[Notes](docs/design-v3/batch-7/NOTES.md)

- Staged result renders: board and centre first, then rail, top row and bar, then the focus move, so no task goes over
  50 ms at 4× CPU throttling.
- Type warm-up: result templates are laid out once after boot in a hidden, contained box to avoid cold text shaping.
- Frame scheduler fixed to request one animation frame at a time (it could run every tween twice per frame).
- Credits count-up writes only the balance text inside a contained box (no full-document layouts).
- Removed dead v2 assets, unused legacy tokens and contrast pairs (46 → 33), and `test/ui/screenshots-v2.js` /
  `npm run screenshots`.
- Checks: 96/96 unit, 48/48 UI, `sim:quick` RTP 95.613% / 95.656% (band 95.45 ± 0.3).

## v3-batch-6 — 2026-10-27 — Overlays and small screens (PR #6, `0beec98`)

[Notes](docs/design-v3/batch-6/NOTES.md)

- One "Game info" window with Settings, Paytable and Help columns (tabs below 1600 px, a bottom sheet on tablet
  portrait).
- Flat Refill, Error and Recovery dialogs and game info panel; one 160 ms entrance per dialog.
- Flat start and loading screens; the bulb-ring ticker and bunting removed.
- Help text for the gamble rewritten to match the engine.
- 768×1024: the frame hugs the track, dock and bar and is centred; Double Run "1st"/"2nd" markers repositioned on
  tablet tiles.
- Checks: 92/92 unit, 47/47 UI, `sim:quick` and full `sim` within the RTP band. CSS 7.04 KB gzipped.

## v3-batch-5 — 2026-10-27 — Result states (PR #5, `c919e0e`)

[Notes](docs/design-v3/batch-5/NOTES.md)

- Flat win and loss stops; Double Run stops marked "1st" / "2nd".
- WIN tags, confetti, the jackpot overlay, glows and chase animations removed.
- New centre result layouts: win with result card and "Double or nothing" band, loss, Double Run result.
- Gamble moved from a modal into the centre: one disc with two faces, a 700 ms `rotateY` flip ending on the stored
  result (crossfade in reduced motion).
- Rail note count-up writes only the number text.
- Checks: 88/88 unit, 43/43 UI, `sim:quick` within the RTP band, `perf:trace` 0 long tasks.

## v3-batch-4 — 2026-10-27 — Track and centre display (PR #4, `eedde40`)

[Notes](docs/design-v3/batch-4/NOTES.md)

- Flat 50-square track with tier-coloured multipliers and accent-blue bet badges.
- Track pitch from the tokens.md formula (`clamp(40, floor(min(boxW/16, boxH/11)), 70)`).
- Running light as class swaps only, with an opacity-only trail and a 260 ms landing pop.
- Centre display: status pills, the big JetBrains Mono multiplier number, title, sub line and pays row.
- New top row above the track: "Last results" and "Last bets".
- Checks: 82/82 unit, 38/38 UI, `sim:quick` and full `sim` within the RTP band.

## v3-batch-3 — 2026-10-26 — Left panel controls (PR #3, `1a3a688`)

[Notes](docs/design-v3/batch-3/NOTES.md)

- Every rail control restyled flat (desktop rail and tablet-portrait dock): chips, Start, Collect, Gamble ×2,
  Undo / Clear / Rebet, rail note, disclaimer.
- Bet field shows the total bet on the board, with 1/2 and x2 (clamped to the per-square, per-round and balance
  limits).
- "Last bets" list (round totals, stored in `rl.v3.betTotals`).
- Plus Jakarta Sans removed; the bundle now has only Poppins 600/700 and JetBrains Mono 600 (37.7 KB).
- Checks: 75/75 unit, 35/35 UI, `sim:quick` within the RTP band.

## v3-batch-2 — 2026-10-26 — Page frame and bottom bar (PR #2, `efe507e`)

[Notes](docs/design-v3/batch-2/NOTES.md)

- Top header removed; centred frame (max 1600×980) with a 230 px rail and a 40 px bottom bar.
- Bottom bar holds sound, settings, stats (Info) and fairness icons plus the title and play-credits line.
- Play credits line moved to the top of the rail.
- z-index stacking from the tokens; v2 purple tints removed from `src/styles.css`.
- Checks: 62/62 unit, 31/31 UI, `sim:quick` within the RTP band.

## v3-batch-1 — 2026-10-26 — Design tokens and fonts (PR #1, `1f6f46d`)

[Notes](docs/design-v3/batch-1/NOTES.md)

- New token source `src/data/design-tokens-v3.json` (copied from `docs/design-v3/tokens.json`, plus board
  arrangement, legacy v2 aliases and 46 contrast pairs); `design-tokens-v2.json` deleted.
- `scripts/gen-tokens.js` emits the v3 CSS variables and the v2 names as aliases.
- Fonts: Poppins 600/700 and JetBrains Mono 600 added via `@fontsource`; Bungee, Carter One, Lobster, Nunito and
  most Plus Jakarta Sans weights removed. New `scripts/copy-v3-fonts.js`.
- Checks: 54/54 unit, 27/27 UI, `sim:quick` RTP 95.613% (band 95.45 ± 0.3).

## v2-baseline — 2026-10-26 (`12edb14`)

- Running Light source (v2, "Perya After Dark") plus the v3 mockups and the batch workflow.
