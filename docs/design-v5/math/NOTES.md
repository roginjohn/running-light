# Running Light v5 math: design renders (docs only)

Base: live v3 desktop standard theme (main a760ce5), built unchanged with
`npx vite build --outDir /tmp/rl-v5-build --emptyOutDir`. Nothing in `src/`, tests or config is changed.
The Christmas theme is not used.

## How the renders are made
- `render.mjs` serves the build twice. **v3** is the build as it is. **v5** is the same build with the patches from
  `v5-inject.js` applied to the JS in memory, plus `v5-override.css`. It then drives the **real engine** through
  its test-mode hooks (`window.__RL_TEST__`, the same ones `test/ui/harness.js` uses).
  The board labels, limits and toasts in the PNGs come from that real engine. So do the gamble-cap block and the
  paytable's one-in-N values. None of them are painted on.
- `v5-inject.js` lists 32 patches. Each one must match its expected count, otherwise the render stops with an error,
  so a changed build can't quietly show v3 numbers.
- The render also checks itself: the round must win exactly 200,000 with Gamble blocked for `cap`, the 5x round must
  win 500 with Gamble open, and the full board must hold 50 squares totalling 1,000. The toast text must match, and
  every paytable row must match the spec's counts and one-in-N values.
- Overflow check on every PNG: it flags text that is clipped (scroll size larger than the box), text that leaves its
  button, tile, chip or pill, and text that goes off-screen. The final run reports **no overflow or console issues**,
  and every PNG was also checked by eye.
- Re-run: `npx vite build --outDir /tmp/rl-v5-build --emptyOutDir && node docs/design-v5/math/render.mjs`
  (optional `--scenes betting,win-200x,...`). Uses puppeteer-core (devDependency) and `/usr/bin/google-chrome`.

## PNGs (`png/`)
| File | What it shows |
|---|---|
| `01-betting-1920x1080.png` | Betting. New board from SQUARES_BY_TIER, 7-chip row with 100 selected, 800 on 6 squares, credits 10,000 |
| `01-betting-1280x720.png` | The same at 1280x720 |
| `01-betting-top200-option-1920x1080.png` | **Option, not approved:** 200x styled as the top prize |
| `02-large-bets-full-board-1920x1080.png` | 20 on every one of the 50 squares = 1,000, the round limit |
| `03-win-200x-gamble-capped-1920x1080.png` | 1,000 on #3 (200x): you win 200,000. Gamble is off with a clear reason |
| `03-win-200x-top200-option-1920x1080.png` | The same win with the top-prize option on |
| `04-win-5x-gamble-offer-1920x1080.png` | 100 on #8 (5x): win 500, with Gamble ×2 offered (Win → 1,000) |
| `05-paytable-game-info-1920x1080.png` | Game info: paytable tiers, square counts, square numbers, one-in-N hit chances, Payback (RTP) ≈95.39%, limits, chips |
| `06-refill-1920x1080.png` | Out of play credits: Refill 10,000 |
| `06-toast-square-limit-1920x1080.png` | Toast "Max bet reached – 1,000 per square" (1,000 on #3, then one more chip on #3) |
| `06-toast-round-limit-1920x1080.png` | Toast "Round limit reached – 1,000 per round" (500 on #3 and 500 on #6, then a chip on #9) |
| `07-last-results-history-1920x1080.png`, `07-last-results-history-zoom.png` | Last results chips with every tier, including a Double Run "200x · 100x", and Last bets up to 1,000 (zoom at 2x) |
| `08-compare-betting-v3-vs-v5.png`, `08-compare-paytable-v3-vs-v5.png` | Side by side: v3 (unmodified build) and v5 |
| `v3-betting-1920x1080.png`, `v3-paytable-game-info-1920x1080.png` | The v3 sources for the comparisons |

## Layout notes
- **Tier colours (v3 tokens only):** 5x, 10x and 20x use tier-24 grey and 50x uses tier-96 light grey. 100x uses
  tier-480 blue. 200x uses tier-480 blue with the navy edge (v3's 960x look). The jackpot tile is not used by default,
  because there is no unique top square.
- **7 chips in the 230 px rail (198 px inside):** each chip takes an equal flexible share, capped at the v3 size,
  which works out to about 26 px. Labels are 10 px; "100" and "500" are 9 px so they clear the edge stripes.
  - New chip colours, from existing tokens: **100 black** (`--c-text-on-light`) and **500 light blue**
    (`--c-accent-blue-text`).
  - The digit keys 1–7 pick chips. In v3, keys.js hard-codes 1–5.
- **Bet hint:** "1–1,000 per square · 1,000 per round" is 215 px, so it was cut off with an ellipsis. It now breaks
  at the "·" onto two lines in both states ("6 squares / 800 / 1,000 per round"). The rail has plenty of free height.
- **Start sub-line:** "1,000 credits on 50 squares · Space" spilled out of the button. It now reads
  "1,000 on 50 squares · Space".
- **Gamble ×2 when blocked:** the sub-line now reads "Over the 300,000 cap". The full reason is still shown in the
  centre ("Doubling 200,000 would go over the 300,000 cap, so Gamble is off. Collect it."), the navy band
  ("Doubling would go over the 300,000 cap") and the button title. The old centre text, "Gamble is off above 300,000
  credits", was misleading for a 200,000 win.
- **Formatted numbers:** square bet badges, the result card ("1,000 × 200 = 200,000"), the tooltip
  "Your bet: x / 1,000", the hint, help and paytable limits now go through `toLocaleString`. "1,000" fits the 64 px
  tile badge.
- **Big number:** shows "200.00x" at most, narrower than v3's "1920.00x". The largest displayed value is 300,000
  (7 characters), and 200,000 fits in the Collect button, the Uncollected row and the centre headline.
- The square-limit toast wraps to 3 lines in the rail at 1920. v3's toast box did this already, and nothing is clipped.

## Numbers used (source: `math-v5/MATH-SPEC.md`)
| Value | Used | Spec |
|---|---|---|
| Paytable, Option A | 5x ×1 (#8), 10x ×3, 20x ×4, 50x ×6, 100x ×18, 200x ×18 = 50 | §2 table, §3 SQUARES_BY_TIER, §7 decision 1 |
| Weights, total | 1493 / 743 / 371 / 148 / 74 / 37, W = 8,092 | §3 Option A |
| Hit chance per round (incl. Double Run) | 1 in 5.24 / 10.48 / 20.94 / 52.44 / 104.85 / 209.66 | §3 table. The patched engine's `pRound` gives the same values, and the render checks them |
| Payback | ≈95.39% (full board exact 95.389%) | §3 |
| Double Run | 1 in 25 (unchanged) | §1 |
| Limits | 1–1,000 per square, 1,000 per round | §5, §7 |
| Chips | 1, 5, 10, 25, 50, 100, 500 | §5, §7 |
| Start and refill credits | 10,000 | §5, §7 |
| Gamble cap | 300,000. A 200,000 win can't be doubled; anything up to 150,000 can be doubled once | §5, §7 |
| Top win | 200 × 1,000 = 200,000 | §5 |
| Toasts | "Max bet reached – 1,000 per square", "Round limit reached – 1,000 per round" | §6 |
| Full-board story | 50 × 20 = 1,000 | §7 decision 3 |
| Jackpot | no 1920x and no unique top square | §6, §7 |

## Found while mocking (hard-coded v3 values missing from the spec's change list in §6)
- `src/ui/keys.js`: chip keys `/^[1-5]$/` and `[1, 5, 10, 25, 50]` are hard-coded; the Settings key table says "1–5".
- `src/ui/view.js`:
  - rail disclaimer: "Free refill to 1,000" is hard-coded.
  - tooltip: "Your bet: x / 10" is hard-coded.
  - the bet badge, result card and Start sub-line print raw numbers ("1000").
- `src/ui/app.js`:
  - announce "Refilled: 1,000 play credits." and the refill count-up `1e3` are hard-coded.
  - win sounds: `top >= 480` → big win and `>= 1920` → jackpot, so **no v5 win would play the big-win sound**. The
    thresholds need new values (for example 100 / 200).
  - status pill "Jackpot" keyed on `=== 1920`.
- `src/engine/game.js` log: "balance unreadable: fell back to 1,000".
- The Start and Gamble sub-lines and the bet hint overflow the rail at v5 numbers (see the layout notes).

## Open questions
1. **200x as the top prize (recommendation, NOT approved).** Should all 18 200x squares get v3's jackpot look (navy
   tile, white label, navy pills)? See `*-top200-option-*.png`. Light and win states still win over it. The default
   renders keep 200x as a normal blue tier with a navy edge. Also open: whether the win headline or sound should say
   "top prize", and whether to remove the Jackpot pill, banner and sound.
2. **100 and 500 chip colours:** v3 has no tokens for them. The mock uses black and light blue from existing tokens.
   Alternatively, add `--c-chip-100` and `--c-chip-500` (for example the traditional purple for 500).
3. **Payback copy:** spec §6 says "≈95.4%"; this brief says 95.39%. The mock shows "Payback (RTP) ≈95.39%" in the
   paytable and "RTP about 95.39%" in fairness/help. Which number and which label should ship?
4. **One-in-N precision:** v3 rounds to whole numbers, which would make 5x read "1 in 5". The mock shows the spec's 2
   decimals ("1 in 5.24"). Keep the decimals, or round?
5. **Short copy:** OK to drop "credits" from the Start sub-line, and to show "Over the 300,000 cap" on Gamble ×2 when
   blocked? Also OK to split the bet hint onto two lines?
6. **Equal caps:** the square toast only fires when one square holds the whole 1,000. With bets on two or more squares
   the round toast fires first. That matches decision 3, but confirm it reads right to players.
7. **DEFAULT_CHIP:** stays 1, or becomes 10 (spec §6, undecided)? The mocks select 100, 25 or 50 to fit each story.
8. **Tier colour ladder:** 5x, 10x and 20x share one grey, so the low tiers are told apart by label only. OK, or should
   20x use the tier-96 colour?
