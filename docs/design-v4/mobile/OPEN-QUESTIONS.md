# Running Light v4 mobile · open questions

These questions need a decision. They are kept apart from SPEC.md, which lists requirements only. Each one has a
recommendation, and the recommended option is what the mocks show unless the question says otherwise.

### Q1. Landscape phones: playable (A) or rotate screen (B)?
- **A** (`landscape-A-*`): the board is on the left with the control rail on the right. It meets every size rule.
  The ring squares are small (25.6 px) but are only for display, and betting uses the 10 × 5 grid.
- **B** (`landscape-B-rotate`): the v3 rotate screen with clearer copy, so landscape cannot be played.
- **Recommendation: A.** Players hold phones sideways (lying down, in a car mount), and blocking play is the
  audit's complaint. Keep B only as a fallback for viewports under 320 px tall, where A's rail cannot fit.

### Q2. On phones, bet on a separate grid instead of the ring?
At 25–34 px, ring squares cannot meet the 44 px target, so betting on phones happens on a 7 × 8 (or 10 × 5) grid of
the same squares, and the ring appears once the light runs.
- Alternative 1: bet on the ring with a magnifier on long-press. This is fiddly, slower, and still has
  sub-44 targets.
- Alternative 2: keep the ring and open a bet sheet on every tap. That adds a step to every bet.
- **Recommendation: the grid, as mocked.** It is the only way to meet the 44 px rule at 360 wide, and the grid uses
  the same square numbers, tier colours and badges. Usability test it: can players find "#21" on the ring after
  betting on it in the grid?

### Q3. Bet amounts on the phone ring
The phone ring marks a square with a bet with a blue border but not the amount, because a badge would cover the
multiplier.
- **Recommendation: keep the border.** The amounts are on the bet grid, and the result card shows "Bet × pays".
  If testing shows players miss the amounts, show the badge only on the square the light stops on.

### Q4. Grid order: number order or ring order?
The grid lists 1–50 in reading order. Ring order wraps around (1–16 across the top on desktop), so it would not map
onto a 7-column grid in any readable way.
- **Recommendation: number order** (as mocked), with the number printed on every cell.

### Q5. What happens to the v3 bottom bar on phones and tablets?
v3 tablets have a 40 px bottom bar: sound, settings, stats and fairness icons at 32 px, plus a title. v4 moves sound
and game info to the top bar at 44 px. Fairness ("How results are decided") becomes a section of the Help tab.
- **Recommendation:** accept this on phones. On tablets, decide whether to bring back a 52 px bottom bar with 44 px
  icons and the "Play credits only · No real money value" title. The mocks leave it out to give the ring more
  height. If it comes back, the 768 board shrinks to about 45 px squares, which still passes.

### Q6. Update the token file for the mobile minimums?
`design-tokens-v3.json` has `type.min-size: 10` and `tile-mult.min: 10`, and v3 CSS hard-codes 11 px in several
places (chip values, bet badges, `.kc`, `.pay`, `.yp`).
- **Recommendation:** add v4 tokens rather than edit v3 values: `type.min-size-touch: 12`, `type.body-touch: 14`,
  `size.tap-min: 44`, `size.chip-touch: 44`. Then replace the hard-coded 11 px values behind the phone and tablet
  breakpoints. Desktop can keep 11 px for now. It is a separate decision whether desktop also moves to 12 px; that
  is recommended later for consistency.

### Q7. Long-press timing and conflicts
- **Recommendation:** 450 ms, cancelled by moving more than 10 px, with a short haptic (`navigator.vibrate(10)`)
  where available. Suppress the browser's own callout and selection (`-webkit-touch-callout: none` plus
  `user-select: none`, as v3 already sets on `#app`). Is haptics acceptable for a play-credits game? It is opt-out
  through Sound or Reduced motion.

### Q8. Gamble band on phones
The navy "Double or nothing · Fair 50/50 · Win → 3,840 · Lose → 0 · ●●● 3 of 3 left" band does not fit in the phone
centre beside the win card.
- **Recommendation:** move its facts into the Gamble button sub-label ("Fair 50/50 · 3 of 3 left"), as mocked. The
  "Win → 3,840 / Lose → 0" detail appears on the gamble panel cards once the player taps Gamble. Product should
  confirm that showing the double-or-nothing outcome only after the tap is acceptable.

### Q9. 360 × 640 headroom
At 360 × 640 with a 24 px status bar, the layout has about 7 px of vertical slack. Android's browser chrome can take
more space when the URL bar is shown. `dvh` handles this: the stage shrinks, and the grid rows have a 44 px floor.
- **Recommendation:** below 600 px of usable height, hide the "Betting open / Double Run" pills above the grid. The
  same status is in the dock Start sub-label. Below 560 px, let the bet grid scroll inside the stage instead of
  dropping under 44 px. This is not mocked yet. Add a 360 × 560 render to check it.

### Q10. Tablet landscape and foldables
Tablet landscape (1024 × 768 and up) falls to the v3 desktop layout, whose 32 px icons and 11 px text fail the touch
rules.
- **Recommendation:** apply the touch sizes on `(pointer: coarse)` at every width, not only below 1200 px, and add
  1024 × 768 and 1366 × 1024 renders in v4 batch 2. Foldables (about 600 × 900 or more, inner screen) get the tablet
  layout from the existing queries.

### Q11. Turbo placeholder
Turbo is still listed as "Placeholder – pending approval" (disabled). Should it ship on mobile, or be hidden until
approved? **Recommendation:** hide it on phones until approved, because a disabled row costs 64 px in a short sheet.
