# Running Light v4 · mobile layout spec

Status: design only (v4 batch 1). Nothing in `src/` has changed. The mocks in `mocks/` are the reference, and
`png/` holds their renders. `render.mjs` re-renders them and checks the numeric rules below
(`measurements.json`).

Scope: portrait phones, landscape phones and portrait tablets. Desktop (≥ 1200 wide) stays as it is in v3.
Locked rules are unchanged: 50 squares; pays 24 / 96 / 480 / 960 / 1920x; Double Run 1 in 25; gamble up to 3 per win
(off above 30,000); bets 1–10 per square and 200 per round; chips 1, 5, 10, 25, 50; free refill to 1,000.
The style is v3: the same tokens (`src/data/design-tokens-v3.json` → `src/styles/tokens.css`), flat fills, 1 px
borders, no shadows or glows, and motion on transform and opacity only.

This document lists requirements only. Questions and recommendations are in `OPEN-QUESTIONS.md`.

---

## 1. Problems this fixes (audit 2026-10-27)

| Audit finding | v4 rule |
|---|---|
| Portrait phones get a shrunk tablet layout: squares cover the centre and the win card, labels overlap, chips are clipped | Phone-specific layout (§3). The centre is placed on the ring's inner grid cells, so it cannot overlap a square (§3.3). Chips are 44 px and fit at 360 wide (§3.5). |
| Landscape phones only show the rotate screen | Landscape is playable (§4, option A). The rotate screen is kept only as option B. |
| 64 of 65 controls are under 44 px | Every tap target is at least 44 × 44 (§5.1). |
| Minimum font is 10 px | Text is at least 12 px, and body copy is 14 px (§5.2). |
| No safe-area handling | `viewport-fit=cover` plus `env(safe-area-inset-*)` on every edge (§6). |
| The keyboard shortcut list shows on touch | It is hidden on `(hover: none), (pointer: coarse)` (§7.2). |
| Tooltips only work on hover | Long-press and tap open an info sheet (§7.1). |

## 2. Breakpoints

Mobile-first CSS: the rules without a media query are for portrait phones.

| Name | Media query | Board | Controls |
|---|---|---|---|
| phone portrait | `(max-width: 599px)` | 11 × 16 ring, or 12 × 15 when `max-height: 700px`. Bet grid 7 × 8 while betting. | bottom dock |
| phone portrait, tall | `(max-width: 599px) and (min-height: 760px)` | same; headline above the bet grid, centre number 44–48 px | bottom dock |
| phone landscape | `(max-height: 499px) and (orientation: landscape)` | 16 × 11 ring. Bet grid 10 × 5 while betting. | right rail, 252 px |
| tablet portrait | `(min-width: 600px) and (min-height: 500px)` | 13 × 14 ring of tap squares (≥ 44 px) | two-column dock |
| desktop | `(min-width: 1200px)`, landscape | v3, unchanged (16 × 11) | v3 rail + bottom bar |

Ring shape. The 50 squares always run clockwise from #1 at the top left. A C × R ring has 2C + 2R − 4 = 50, so
C + R = 27. The square-to-cell mapping for any shape:

```
i ≤ C              → row 1,  col i
i ≤ C + R − 2      → row i − C + 1, col C
i ≤ 2C + R − 2     → row R,  col C − (i − (C + R − 2)) + 1
otherwise          → row R − (i − (2C + R − 2)), col 1
```

Pitch is `min(70px, stageWidth / C, stageHeight / R)`. The mocks do this with a size container on the stage:
`min(var(--pmax), 100cqw / C, 100cqh / R)`. Phone gaps are 3 px and tablet gaps are 4 px. Rendered sizes:

| Viewport | Shape | Square | Notes |
|---|---|---|---|
| 360 × 640 | 12 × 15 | 24.6 px | display only |
| 390 × 844 | 11 × 16 | 30.5 px | display only |
| 430 × 932 | 11 × 16 | 34.1 px | display only |
| 844 × 390 | 16 × 11 | 25.6 px | display only |
| 768 × 1024 | 13 × 14 | 45.0–45.6 px | tap targets |
| 1024 × 1366 | 13 × 14 | 66.3 px | tap targets (pitch capped at 70) |

## 3. Phone portrait placement

Screen zones, top to bottom:

```
┌ safe-area top (notch / status bar) ───────────┐
│ TOP BAR 52px: Play credits · Last results ·    │  secondary controls (sound, game info)
│              [sound 44] [game info 44]         │
├────────────────────────────────────────────────┤
│ STAGE (fills the rest)                         │  board: bet grid (betting) or ring (all other states)
│   ring: centre = inner cells only              │
├────────────────────────────────────────────────┤
│ DOCK (~140px): [½][×2] [1][5][10][25][50]      │  primary controls: bottom zone, thumb reach
│   Total bet 40 / 200 · 9 squares   Last bets … │
│   [Undo][Clear][Rebet]  [ START  40 on 9 ]     │
└ safe-area bottom (home indicator) ────────────┘
```

### 3.1 Top bar (52 px)
- Left: "Play credits" label (12 px) above the balance (16 px bold). The label also serves as the "play credits
  only" notice on phones.
- Middle: "Last" plus result pills (24 px tall, 12 px, not interactive). Pills that do not fit wrap onto a hidden
  line. The 360 width shows 3 pills and tablets show 10.
- Right: sound switch and game info (settings, paytable, help), each 44 × 44. These are secondary controls, so they
  sit in the top zone.

### 3.2 Board: two presentations of the same 50 squares
At phone pitch (25–34 px), ring squares cannot be 44 px tap targets. The largest ring that fits 360 wide with
44 px squares would be 7 × 20, and that is about 900 px tall. Phones therefore show the board in two ways:

- **Betting: the bet grid** (`.bgrid`). All 50 squares are `<button>`s in number order: 7 columns by 8 rows in
  portrait (row 8 holds #50 plus a touch hint), and 10 × 5 in landscape. Each cell is ≥ 44 × 44 (44–66 px) and shows
  the square number (12 px), the multiplier (12 px bold, tier colour) and a bet badge (16 px, 12 px text). Above it:
  the centre display status pills ("Betting open", "Double Run · 1 in 25"). Tall phones also show "Place your bets"
  and a hint.
- **Every other state: the ring** (`.ring`, display only, so squares are not interactive). It is used for running,
  Double Run, win offer, gamble, loss and payout. Squares show the multiplier without the "x" (12 px). The 1920x
  square shows the star, and a square with a bet has a 2 px accent-blue border instead of a number badge (there is no
  room for both at 25–34 px). The amounts appear on the bet grid and on the result card.
- Switching: Start swaps grid → ring (a 160 ms opacity crossfade; reduced motion makes it instant). After a result
  the ring stays up. **Change bets** (in the loss centre), any chip, Undo or Clear goes back to the grid. Rebet and
  Start work from either view.

### 3.3 Centre display: never under a square
- The centre is a grid item on lines `2 / 2 / -2 / -2` of the ring, which are exactly the inner cells. By
  construction it cannot overlap a square. Its content must fit there. Requirement: no `scrollHeight` overflow (it is
  checked) and nothing is scaled to fit.
- Contents by state (phone sizes):
  - running: status pills, centre number (40 / 44 / 48 px mono), "Good luck" (18 px), and one body line.
  - win offer: "Jackpot" or "Win" pill, number, "You win 1,920", body line, and the result card ("#8 [1920x] Bet ×
    pays 1 × 1920 = 1,920").
  - gamble: the navy panel with the heading on two lines, 52–60 px discs, the coin edge, the message and three
    cards (Current / Red / White).
  - loss: "No win" pill, number, title, "Stopped on #26 (24x). Your bets are kept.", the card, and **Change bets**
    (44 px).
- The v3 navy "Double or nothing" band does not fit in the phone centre. Its content moves into the Gamble button
  sub-label ("Fair 50/50 · 3 of 3 left").
- The paytable pills (24x … 1920x with square counts) show only in the tablet centre. On phones they are in the
  paytable sheet.

### 3.4 Results never overlap the board
The win card and the gamble panel live inside the centre (§3.3). The dock and top bar are separate grid rows. The
render check fails if any `.tile` rectangle intersects `.centre > *`, `.dock` or `.top`.

### 3.5 Dock (primary controls, bottom zone)
Phone grid columns are `96px 48px 1fr`:

| Row | Betting / loss | Running | Win offer | Gamble flip |
|---|---|---|---|---|
| 1 (44) | ½, ×2 · chips 1 5 10 25 50 | same, disabled | same, disabled | same, disabled |
| 2 (16) | Total bet 40 / 200 · 9 squares · Last bets 20 20 15 | Total bet · Controls locked | Uncollected win 1,920 · Bet 40 taken | In gamble 3,840 · Flip 2 of 3 |
| 3 (52) | Undo · Clear · Rebet (44+ each) · **Start** | Running… (disabled) | **Collect 1,920** · **Gamble ×2** (half width each) | Collect (outline, locked) · Flipping… |

- Disabled controls keep their size and place, so the layout does not jump between states.
- Start, Collect and Gamble are the largest targets (52 px tall, 164–192 px wide at 360) and sit at the bottom right
  and bottom centre, inside the natural thumb arc.
- The v3 "Bet amount" field (● 40 | ½ | ×2) is shown in full on tablets. On phones, the total moves to row 2 and
  only the ½ and ×2 buttons stay in row 1.

## 4. Phone landscape (option A, playable)
- Grid: columns `[stage | 252px rail]`, rows `[44px top | stage]`. The rail spans the full height on the right.
- Stage: the bet grid is 10 × 5 (≥ 44 px cells, about 46 × 54) while betting, and the 16 × 11 ring (25.6 px
  squares) otherwise. The centre uses the 14 × 9 inner cells, and its title and sub-line wrap onto one row.
- Rail, top to bottom, aligned to the bottom so the primary controls are under the right thumb: chips (5 × 44),
  [½ ×2 | Undo Clear Rebet], info lines, Start (56). In the win offer, Collect and Gamble are stacked (52 each).
- Insets: left and right `env(safe-area-inset-left/right)` (47 px on notched iPhones), bottom 21 px.
- Option B (`landscape-B-rotate`): the v3 rotate screen with better copy, kept as a fallback. See OPEN-QUESTIONS.md
  Q1.

## 5. Size rules (checked by render.mjs)

### 5.1 Tap targets
- Every `button`, `[role=button]`, `input`, `select` and `a` must be at least **44 × 44 CSS px** on both sides. The
  only exemption is an element under an `inert` subtree, which is what is behind a modal.
- Sizes used: icon buttons 44; ½ and ×2 44; chips 44 on phones and 52 on tablets; Undo / Clear / Rebet ≥ 44 wide
  and 52 tall; Start, Collect and Gamble 52 on phones, 56 in landscape and 60 on tablets; tabs 44; switches are
  56 × 44 hit boxes around a 40 × 24 track; range inputs are 44 tall; dialog buttons 56; gamble picks ≥ 64 × 80;
  bet grid squares ≥ 44; tablet ring squares ≥ 44.
- Keep 4 px or more between neighbouring targets wherever space allows. Chips are spaced 4 px at 360 wide, the
  minimum.

### 5.2 Text
- **Minimum 12 px** for any visible text, including bet badges, chip values, square numbers and footnotes.
- **Body copy 14 px / 20 px**: dialog and sheet paragraphs, the centre sub-line, the gamble message and help text.
  In the mocks these are `p` elements and `.body`. Footnote paragraphs are marked `.fn` and are 12 px.
- The token `type.min-size` (10) and `tile-mult.min` (10) are not used below 1200 px. In v4 the phone and tablet
  minimum is `--fs-min: 12px`. See OPEN-QUESTIONS.md Q6 on updating the token file.
- The centre number stays mono 600: 40 px (≤ 700 px tall), 44 px (tall phones), 48 px (≥ 420 wide), 36 px
  (landscape), 64 px (768 tablet) and 80 px (1024 tablet).

## 6. Safe areas and viewport units
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Inset variables are applied on the app shell, sheets, dialogs and full screens:
  ```css
  --sat: env(safe-area-inset-top, 0px);   /* same for -right, -bottom, -left */
  .app { padding: var(--sat) var(--sar) var(--sab) var(--sal); }
  ```
  The mocks use `max(env(...), var(--sim-*, 0px))`, so render.mjs can simulate a notch on a desktop browser. The
  production code uses only `env()`.
- Simulated insets in the renders: 360 × 640 top 24; 390 × 844 top 47 / bottom 34; 430 × 932 top 59 / bottom 34;
  844 × 390 left 47 / right 47 / bottom 21; tablets top 24 / bottom 20. In the PNGs these bands are tinted and the
  home indicator is drawn.
- Sheets pad their bottom by `--sab` so their last row clears the home indicator. Dialogs sit `--sab + 12px` above
  the bottom edge.
- Height: `height: 100vh; height: 100dvh;` on the shell and full screens, in that order, so browsers without dvh fall
  back to vh. Sheets: `max-height: calc(100vh - var(--sat) - 24px)` first, then the same with `100dvh`.
- The render check fails if an interactive element, or the scroll box that holds it, extends into a simulated inset.

## 7. Touch replacements

### 7.1 Tooltips → info sheet
- The v3 hover tooltip on squares (pays, hit chance, your bet) becomes a **bottom info sheet**
  (`mocks/tip-sheet.html`) that opens on **long-press** (≥ 450 ms, cancelled by moving more than 10 px) of a bet
  grid square. On tablets it also opens from a ring square.
- Sheet contents: "Square #8 · 1920x" heading with Close (44); rows for Pays / Hit chance per round / Your bet;
  actions **Remove 1** and **Add {chip}** (48 px tall). Tapping the scrim or Close dismisses it. The long-press must
  not also place a bet.
- `title=""` attributes that carry information (for example why Gamble is off) need a visible equivalent on touch:
  put the text in the button's sub-label (as Gamble already does) or in the dock info row. Do not rely on `title`.
- Hover styles stay behind `@media (hover: hover)`, so a tap leaves no sticky hover state.

### 7.2 Keyboard shortcuts
- The Keys table in Settings is `.kbd-only`, hidden by `@media (hover: none), (pointer: coarse)`. On those devices a
  `.touch-only` note about long-press and Change bets is shown in its place.
- Key hints in button sub-labels ("· G", "· Enter") are also left out on coarse pointers. v3 already does this for
  the dock.

## 8. Overlays and screens
- **Game info** (settings, paytable, help) is a bottom sheet over an `inert` game: max-height is the viewport minus
  the top inset minus 24 px; the header is 56 px with Close at 44; three tabs at 44; the body scrolls inside
  (`overscroll-behavior: contain`); the footer carries "Play credits only" and "Outcome is decided and saved before
  the light runs".
  - Settings: Sound, Music, Sound effects, Reduced motion and Turbo (disabled placeholder) as 64 px rows.
  - Paytable: the v3 4-column table becomes a 2-row list item per tier: pill | count + hit chance, then the square
    numbers on the second line.
  - Help: the 4 steps; how the gamble works; **how results are decided**, which on phones takes the place of v3's
    separate fairness dialog (the bottom-bar scales icon); and the navy play-credits note.
- **Refill and error** are dialogs anchored to the bottom (thumb zone) on phones and centred on tablets, with a full
  width 56 px primary button. The error dialog keeps its red top edge and mono round line.
- **Start**: brand and description sit in the middle; Play (56) and How to play / Sound (48) are in the bottom zone.
- **Loading**: brand, bar and percentage, centred.
- Wording: plain facts only ("drawn first", "fair 50/50", "decided and saved before the light runs"). Make no
  claim of verifiable or seed-checkable fairness. There is no seed verification, and the copy must not suggest one.

## 9. Motion and weight
- No new animations. The grid ↔ ring swap is a 160 ms opacity crossfade, and sheets enter with the v3 160 ms
  opacity plus a 4 px rise. The light step, trail, landing pop and 700 ms gamble flip stay as in v3. Reduced motion
  follows v3.
- The phone ring has the same 50 elements as desktop. The bet grid adds 50 buttons that are `display: none` outside
  betting. The layout is plain CSS grid, with no per-frame JavaScript layout.

## 10. Verification
`node docs/design-v4/mobile/render.mjs` (puppeteer-core, `/usr/bin/google-chrome --no-sandbox`, touch emulation, so
`(pointer: coarse)` and `(hover: none)` match):
- renders 45 PNGs into `png/`,
- writes `measurements.json`: for each page, the smallest tap target, the smallest font, the smallest body font, the
  ring square size and any violations,
- exits 1 if it finds a tap target under 44, text under 12, body text under 14, a square overlapping the centre,
  dock or top bar, centre overflow, a control inside a safe-area inset, or clipped text.

The current result is 45 pages and 0 violations, with minimum tap target 44 px, minimum text 12 px and minimum body
text 14 px.
