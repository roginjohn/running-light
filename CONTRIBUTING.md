# Batch workflow

- `main`: source code. Only tested batches get merged here.
- `gh-pages`: the built site served at https://roginjohn.github.io/running-light/. Only updated on a deliberate publish.
- Each batch gets its own branch: `v3/batch-N-<name>`. It is merged into `main` once it passes the checks below, then tagged `v3-batch-N`.

## Locked
`src/engine/` holds the game math (paytable 24/96/480/960/1920x, Double Run 1/25, fair gamble max 3 / 30k cap, bet limits). Do not change it without Rogin's approval. Play credits only.

## Checks for every batch
1. `npm test`: all unit tests pass.
2. `git diff main -- src/engine` is empty.
3. `npm run test:ui`: no console errors and no external requests.
4. `npm run sim:quick`: RTP 95.45% ± 0.3. Run the full `npm run sim` for batches 4 and 6.
5. Screenshots compared against `docs/design-v3/`.

## v3 batches
1. Design tokens and fonts
2. Page frame and bottom bar
3. Left panel controls
4. Track and centre display
5. Result states
6. Overlays and smaller screens
7. Performance and cleanup, then publish

## Publish
`npm run build`, then copy `dist/` to the `gh-pages` branch.
