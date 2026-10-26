# Running Light v3: design tokens

The source of truth is `tokens.json`. This file explains it. All mockups in this folder are rendered from those values (`_render/render.js` generates `_render/tokens.css` from the JSON).

## 1. Colour

| Token | Value | Use |
|---|---|---|
| bg-page | `#0f1216` | Page behind the frame |
| bg-frame | `#1a1f26` | Frame body, game area, dialogs |
| bg-rail | `#1c222a` | Left control rail |
| divider | `#2a313a` | 1 px rail divider, card borders, table rules |
| bg-bottombar | `#1f262e` | 40 px bottom bar |
| bg-input / border-input | `#222a33` / `#2f3742` | Bet input, secondary buttons |
| bg-segment | `#13181e` | Manual/Auto track, tab track |
| bg-card / bg-card-pill | `#20262e` / `#151a20` | Result/pay cards, and the dark multiplier pill inside them |
| bg-panel-navy / border | `#14294a` / `#1f3a63` | Secondary panel (gamble band, help disclaimer). Also the 1920x tile |
| tile / tile-border | `#232a33` / `#2a323c` | Track squares |
| tile-lit | `#e9eef3` | The square under the light, and a losing stop |
| tile-trail | `#fff` at opacity .34 / .20 / .10 | 3-step trail overlay (opacity only) |
| text-primary / strong | `#e6eaee` / `#fff` | Values, titles |
| text-muted | `#8a94a0` | Labels, hints, balance line, all small secondary text |
| text-dim | `#6b7580` | **Disabled only** (e.g. "Auto"). It fails AA for body text, so never use it for information |
| big-number / -win | `#6a7480` / `#e6eaee` | Mono centre number: grey when idle/lost, light when won |
| accent-blue | `#0d6efd` | Primary button, Manual pill, bet badges, Running pill |
| accent-green | `#16a34a` | Win stop tile, Collect button, active pays pill. **Text on green is dark `#06210f`** |
| accent-red | `#dc2626` | Error accent, red gamble disc, 5-chip |
| accent-*-text | blue `#6ea8fe`, green `#4ade80`, red `#f87171` | Coloured text on dark fills |
| btn-disabled | `#3a3f45` (text `#9aa2ab`) | Disabled Place bet |
| scrim | `rgba(15,18,22,.78)` | Dialog scrim (flat, no blur) |
| tiers | 24x `#8a94a0`, 96x `#c3cad2`, 480x/960x `#6ea8fe`, 1920x `#fff` on navy | Multiplier label colour on tiles |
| gamble | red `#dc2626`/edge `#a51c1c`, white `#f1f3f5`/edge `#c5cbd2` | Flat discs (the edge is an inset ring, not a shadow) |
| chips | 1 `#cbd5e1`, 5 `#dc2626`, 10 `#0d6efd`, 25 `#16a34a`, 50 `#4b5563`; edge stripes `#fff` | Poker-chip icons |

### Contrast (WCAG 2.x, measured)
| Pair | Ratio | Note |
|---|---|---|
| text-primary on bg-frame | 13.70 | |
| text-muted on bg-frame / bg-rail / bottombar | 5.38 / 5.20 / 4.96 | AA |
| tier-24 (= muted) on tile | 4.70 | AA |
| accent-blue-text on tile | 5.99 | AA |
| white on accent-blue | 4.50 | AA (just meets it). Keep button text ≥ 14 px bold |
| dark `#06210f` on accent-green | 5.17 | AA. White on this green would be 3.3, so do not use white |
| white on accent-red | 4.83 | AA |
| big-number `#6a7480` on bg-frame | 3.49 | Large text (≥ 52 px) only, so AA-large passes |
| text-dim on bg-frame | 3.53 | Fails AA for small text, so it is used for disabled labels only |
| `#a9bbd6` on navy | 7.45 | Secondary text inside the navy panel |

## 2. Type
- **Sans:** Poppins (OFL 1.1), weights 600 and 700 only. Fallback: `"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif`.
- **Mono (big numbers only):** JetBrains Mono (OFL 1.1) 600. Fallback: `"Roboto Mono", ui-monospace, Menlo, Consolas, monospace`.
- `font-variant-numeric: tabular-nums` on every number.

| Style | Size / weight / line | Use |
|---|---|---|
| label-xs | 11 / 600 / 14 | Tile square numbers, pays counts, caps (desktop only) |
| label-sm | 12 / 600 / 16 | Rail labels, balance line, pills, hints |
| label-md | 13 / 600 / 18 | Body text in the centre and in dialogs |
| label-lg | 14 / 700 / 20 | Buttons, segmented control, card values |
| title | 18 / 700 / 24 | Centre headline, dialog titles |
| big-number | mono 88 / 600 (64 at 1280×720, 52 at 768×1024) | Centre multiplier "00.00x" |
| tile-mult | 12 / 700 (11 at 1280, 10 at 768) | Multiplier on a tile. The minimum anywhere is 10 px |

## 3. Spacing, radius, sizes
- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40. Rail padding is 16 (12 at 1280), with a 12 gap between rail blocks.
- Radius: frame 8, card 8, tile/input/button 6, pills and chips fully round.
- Sizes: rail 230, bottom bar 40, segmented 40, input 40, primary button 52 (48 at 1280, 56 on tablet), secondary button 32, chip 34 (40 on tablet), pill 24–28, bet badge 18 (16/15 on smaller sizes), icons 18 in 32 px hit boxes (44 px hit boxes on touch).
- No shadows. Separation comes from fills and 1 px borders. The only "rings" are inset borders on the discs and chips, and the 2 px white focus/selected outline.

## 4. Layout
- The frame is centred, max 1600×980, with a 16 px minimum page margin. Columns: rail 230 | 1 px divider | game. A bottom bar of 40 px spans the full width.
- Game area: a top row (56 px, 44 at 1280) with "Last results:" on the left and "Last bets:" on the right, then the track box.
- Track: a 16 × 11 ring with #1 top-left, going clockwise (top 1–16, right 17–25, bottom 26–41, left 42–50). `pitch = clamp(40, floor(min(boxW/16, boxH/11)), 70)`, `tile = pitch − 6`. This gives 70/64 at 1920×1080, 54/48 at 1280×720 and 45/39 at 768×1024.
- Centre panel: the ring interior inset by 12 px. It holds the status pills, the big number, the headline/sub-line, the pays row, result cards and the navy gamble band.
- **Tablet portrait (600–1199 px wide, portrait):** game area on top (track width-limited), then the rail as a 2-column block (left: Manual/Auto, bet amount, credits; right: chips, Place bet, Undo/Clear/Rebet), then the bottom bar. Tile square numbers are hidden below 48 px tiles (they stay in the long-press sheet and the aria label).

## 5. Motion
Animate **transform and opacity only**.
- Light step: the lit class swaps instantly, and the trail fades on an opacity overlay (120 ms).
- Button press: 80 ms. Panel/dialog in: 160 ms opacity + translateY(4px).
- Gamble flip: 700 ms rotateY on one disc with two faces.
- Payout count-up: 600 ms (text only, no layout change).
- Reduced motion: no rotation (120 ms crossfade instead), a short light run, and no count-up.
