# Running Light v4 desktop: Christmas skin (design only)

This is the desktop version of the Christmas skin in `../xmas.css`. It is one override stylesheet on top of the live v3
desktop game (`src/styles.css`). Only colours and decoration change. Layout, sizes, spacing and type are the same as v3.
Every decoration is a pseudo-element (`position: absolute`, `pointer-events: none`), so no element box can move.
`render.mjs` checks this on every rendered state.

```
node docs/design-v4/christmas/desktop/render.mjs
```

The script builds the real game with vite into `/tmp/rl-v4-xmas-desktop-dist`, so it does not touch `dist/` or
`src/`. It serves that build and drives each state through the test-mode hooks, the same way as
`test/ui/screenshots-v3.js` (same story: 20 credits on 6 squares, chip 5, credits 1,000, seed 7, forced outcomes). It
renders every state twice: standard (no override) and Christmas (the CSS is injected after the game's stylesheet). Then
it compares every element's box and writes the JSON files. It exits with 1 if any of these happen: a layout delta, a
contrast failure, gzip weight of 5 KB or more, the twinkle running under reduced motion, or a page error. Chrome comes
from `$CHROME`, or `/usr/bin/google-chrome` if that is not set (via `test/ui/harness.js`).

| File | What it is |
|---|---|
| `xmas-desktop.css` | The override. Load it after `src/styles.css`. It has `:root` tokens and a few selector rules. The light string and holly are inline SVG data URIs in this file. |
| `render.mjs` | Build, serve, render, compare, contrast, weight. |
| `png/` | Christmas renders and the two comparisons. |
| `measurements.json` | Element boxes, standard vs Christmas. Covers all 16 states (every element) plus key-element tables for betting and win at both sizes. Also has the twinkle / reduced-motion check. |
| `contrast.json` | WCAG ratios for every text/background and UI pair the skin uses. |
| `weight.json` | Raw and gzip size of `xmas-desktop.css`, including its inline SVGs. |

## PNGs (`png/`)

1920x1080: `start`, `loading`, `betting`, `running`, `win-gamble-offer`, `gamble-flip`, `double-run-result`, `loss`,
`jackpot-win`, `settings`, `paytable`, `help`, `refill`, `error` (each saved as `<state>-1920x1080.png`).
1280x720: `betting-1280x720.png`, `win-gamble-offer-1280x720.png`.
Comparisons: `compare-betting-1920x1080.png` and `compare-win-1920x1080.png`. Each shows standard v3 (live build, no
override) on the left and Christmas on the right.

## Palette (same as `../xmas.css`)

| Role | Hex |
|---|---|
| Pine (chip 10; the base is tinted pine) | `#1d6b44` |
| Berry / edge (chip 5, gamble red disc, loss / error accent) | `#dc1f3f` / `#9c1029` |
| Gold / hover / ink / edge (Start, Play, Refill, Reload, chip 25, win number, 1920x text, loading bar, logo mark) | `#f2c14e` / `#f6cf6e` / `#241500` / `#b8892a` |
| Snow (lit square, chip 1, white gamble disc, snow speckle) | `#f4f1ea` |
| Jackpot square / 1920x pill fill | `#4a0a17` (gold rim `#b8892a`) |
| Page / frame / rail / bottom bar | `#0a1511` / `#0f1f18` / `#12251c` / `#0d1b15` |
| Card / card pill / input / square / square border / divider | `#16291f` / `#0c1a13` / `#183026` / `#152a20` / `#23402f` / `#22392d` |
| Text primary / muted / dim | `#eef1ea` / `#a2b5a9` / `#7c9184` |
| Win card fill | `#1b2a1a` (gold rim) |
| **Kept from v3** | Gamble ×2 and every selection accent (bet badges, Betting open, toggles, sliders, tabs, Your pick): accent-blue `#0d6efd`. Win: green `#16a34a` / `#4ade80`. Gamble panel: navy `#14294a` (rim changed to `#5a4a22`). Selected chip ring: white. |

Decor:
- **Light string:** along the frame's top edge, with red and green bulbs plus gold and snow bulbs. The start and loading screens have one along the top of the screen.
- **Holly sprigs:** on the frame's two top corners, the win card, the start card, and the refill / error dialogs.
- **Snow:** a faint speckle on the page fill around the frame.
- **Twinkle:** the gold and snow bulbs fade slowly (2.4 s). It only runs with `prefers-reduced-motion: no-preference` and the in-game Reduced motion setting off.

## Results

- **Layout delta: 0 px.** That is 7,083 element boxes across 16 states with the same element count and font sizes in every state. For betting and win at 1920x1080 and 1280x720, every key group (50 board squares, centre, big number, centre pills, 5 chips, buttons, credits, bet field, top row, rail, bottom bar, frame, result card, gamble band, overlays) has a max delta of 0 px.
- **Contrast:** 53 pairs, 0 failing. The lowest required pair is 3.30:1 (berry chip 5 vs rail, UI, needs 3:1). The lowest text pair is 4.50:1 (white on accent-blue, which is unchanged v3). Two disabled pairs are listed for information only (they are exempt).
- **Weight:** `xmas-desktop.css` is 6,660 B raw and **2,504 B gzip**. That includes all 3 inline SVGs (1,004 B raw). No other file is added. The limit is 5 KB.
- **Twinkle:** 3 animations with no-preference, 0 with `prefers-reduced-motion: reduce`, 0 with the in-game Reduced motion setting. In the renders it is off, because `render.mjs` adds a render-only `animation: none`.

## Deviations

- **`settings`, `paytable` and `help` look almost the same.** At 1920x1080 the v3 Game info is one window with three columns, and it has no tabs. In each PNG, that section's heading has the keyboard focus ring (v3 style). Tabs only appear below `desktop-xl`.
- **The jackpot square turns green on a win (`jackpot-win`).** Win green overrides the berry fill so the win state stays the same everywhere. The berry square shows in every other state, and the "1920x" result pill stays berry and gold.
- **The Game info window has no holly.** Its close button sits in the top-right corner.
- **Two chip faces have low contrast against the rail.** Chip 10 (pine) is about 2.5:1 and chip 50 is about 1.3:1. The gold rim dashes carry them (9.6:1 and 7.2:1). v3's grey chip 50 was low as well.
- **Twinkle is turned off for renders by injection.** The renders use `prefers-reduced-motion: no-preference`, the same as the v3 screenshots, because reduce would switch the game to its reduced-motion plans. So the render injects `animation: none` instead of emulating reduced motion.

## Open questions

1. Should Gamble ×2 stay blue for the season? It is the default here. Berry (the mobile skin) would match the red disc.
2. Is the faint snow speckle on the page margins wanted, or should the page stay a flat fill?
3. Should the twinkle ship at all, given the pace of the game?
4. Should the Game info window get decor? And should the gamble panel keep navy with a gold rim, or move to pine?
5. Should the jackpot square stay berry when it wins, with only a green rim, so the jackpot win reads as special?
