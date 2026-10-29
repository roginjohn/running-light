# Running Light v4 mobile: Christmas skin (design only)

A seasonal colour skin on top of the v4 mobile mocks (`../mobile/`). It is one override stylesheet plus a few
decorative SVGs. Layout, sizes, spacing, type sizes and tap targets are unchanged, and `render.mjs` checks this:
every element's box on every rendered page is compared with the base page (0 differences on 13 pages).

```
node docs/design-v4/christmas/render.mjs      # builds mocks/, renders png/, runs every check, writes measurements.json
node docs/design-v4/christmas/build.mjs       # pages only
node docs/design-v4/christmas/contrast.mjs --md   # contrast table below
```

| File | What |
|---|---|
| `xmas.css` | The override stylesheet. Load after `mobile/mocks/mock.css`. It sets `:root` tokens plus a few selector rules. |
| `build.mjs` | Reads `../mobile/mocks/*.html` (read-only) and writes `mocks/*.html` with both stylesheets linked and the decorations injected. |
| `decor-snippets.html` | The exact markup `build.mjs` injects (handoff + weight measurement). |
| `render.mjs` | Renders with puppeteer-core and headless Chrome, using the same server, viewports, safe-area simulation and `measure()` as `../mobile/render.mjs`. Adds a layout-drift check against the base page, the contrast check and the weight check. |
| `contrast.mjs` | WCAG ratios, read from `src/styles/tokens.css` plus the `xmas.css` overrides, so the table stays in step with the CSS. |
| `png/` | Renders and the two comparisons. `measurements.json` has the per-page results. |

Note: the request said Playwright. The repo only has `puppeteer-core` installed, and the base `render.mjs` uses it, so
this script uses it too. That keeps the measurements comparable with the base. No new dependency was added.

## Palette

The festive accents sit on the existing dark base, which is now tinted pine.

| Role | Token | Hex |
|---|---|---|
| Deep pine (chip 10, holly leaves are a lighter `#3a9a62`) | `--x-pine` | `#1d6b44` |
| Berry red (Gamble, chip 5, gamble red disc, loss/error accent) | `--x-berry` / edge | `#dc1f3f` / `#9c1029` |
| Warm gold (Start / Play / Reload / Refill, chip 25, win number, jackpot, loading bar, logo) | `--x-gold` / ink / edge | `#f2c14e` / `#241500` / `#b8892a` |
| Snow white (lit square, chip 1, white gamble disc) | `--x-snow` | `#f4f1ea` |
| Page / frame / dock rail | `--c-bg-page` / `-frame` / `-rail` | `#0a1511` / `#0f1f18` / `#12251c` |
| Card / input / square / square border | `--c-bg-card` / `-input` / `--c-tile` / `-border` | `#16291f` / `#183026` / `#152a20` / `#23402f` |
| Text primary / muted / dim | `--c-text-*` | `#eef1ea` / `#a2b5a9` / `#7c9184` |
| Jackpot square / 1920x pill fill | (literal) | `#4a0a17` |
| Win card fill | (literal) | `#1b2a1a` |
| **Win (unchanged)** | `--c-accent-green` / text | `#16a34a` / `#4ade80` |
| **Bet (unchanged)** | `--c-accent-blue` | `#0d6efd` |

**Win green and bet blue are both kept.** The pine is only used on very dark surfaces (luminance ≤ 0.02) and as one chip
colour, so the bright win green (`#16a34a`, 4.6:1 against a square) still stands out. Win is a filled square and bet is a
2 px blue rim, so they differ in hue and in shape. Gold was considered for Start and the lit light. Only Start, the win
number and the jackpot use it. The lit square stays snow white so "the light" does not look like a gold call to action.

### Contrast (computed by `contrast.mjs`)

Text needs 4.5:1, large text needs 3:1 (the centre number is 40 to 64 px), and UI edges need 3:1. All 38 required pairs pass.

| Where | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| Body / labels on frame | `#eef1ea` | `#0f1f18` | 14.97:1 | 4.5:1 (text) | pass |
| Titles on frame | `#ffffff` | `#0f1f18` | 17.08:1 | 4.5:1 (text) | pass |
| Muted text on page | `#a2b5a9` | `#0a1511` | 8.61:1 | 4.5:1 (text) | pass |
| Muted text on frame | `#a2b5a9` | `#0f1f18` | 7.90:1 | 4.5:1 (text) | pass |
| Muted text on dock rail | `#a2b5a9` | `#12251c` | 7.44:1 | 4.5:1 (text) | pass |
| Muted text on card | `#a2b5a9` | `#16291f` | 7.09:1 | 4.5:1 (text) | pass |
| Muted text on input / ½ ×2 | `#a2b5a9` | `#183026` | 6.52:1 | 4.5:1 (text) | pass |
| Square number on square | `#a2b5a9` | `#152a20` | 7.02:1 | 4.5:1 (text) | pass |
| Primary text on input | `#eef1ea` | `#183026` | 12.36:1 | 4.5:1 (text) | pass |
| Pill text on card pill | `#eef1ea` | `#0c1a13` | 15.69:1 | 4.5:1 (text) | pass |
| 24x on square | `#a2b5a9` | `#152a20` | 7.02:1 | 4.5:1 (text) | pass |
| 96x on square | `#d6e0d8` | `#152a20` | 11.21:1 | 4.5:1 (text) | pass |
| 480x / 960x on square | `#6ea8fe` | `#152a20` | 6.28:1 | 4.5:1 (text) | pass |
| 1920x star / pill on jackpot berry | `#f2c14e` | `#4a0a17` | 9.29:1 | 4.5:1 (text) | pass |
| Lit square multiplier | `#0a1511` | `#f4f1ea` | 16.50:1 | 4.5:1 (text) | pass |
| Win square / Collect (win green) | `#06210f` | `#16a34a` | 5.17:1 | 4.5:1 (text) | pass |
| Win amount on win card | `#4ade80` | `#1b2a1a` | 8.65:1 | 4.5:1 (text) | pass |
| Win delta on top bar | `#4ade80` | `#0f1f18` | 9.80:1 | 4.5:1 (text) | pass |
| Loss / error text on frame | `#ff8a98` | `#0f1f18` | 7.60:1 | 4.5:1 (text) | pass |
| Loss chip text on card | `#ff8a98` | `#16291f` | 6.81:1 | 4.5:1 (text) | pass |
| Bet badge / Betting open (bet blue) | `#ffffff` | `#0d6efd` | 4.50:1 (4.5008) | 4.5:1 (text) | pass (unchanged base value) |
| Start / Play / Reload (gold) | `#241500` | `#f2c14e` | 10.58:1 | 4.5:1 (text) | pass |
| Gamble button (berry) | `#ffffff` | `#dc1f3f` | 4.87:1 | 4.5:1 (text) | pass |
| Chip 1 (snow) | `#0f1216` | `#f4f1ea` | 16.65:1 | 4.5:1 (text) | pass |
| Chip 5 (berry) | `#ffffff` | `#dc1f3f` | 4.87:1 | 4.5:1 (text) | pass |
| Chip 10 (pine) | `#ffffff` | `#1d6b44` | 6.48:1 | 4.5:1 (text) | pass |
| Chip 25 (gold) | `#241500` | `#f2c14e` | 10.58:1 | 4.5:1 (text) | pass |
| Chip 50 (dark pine) | `#ffffff` | `#263a30` | 12.14:1 | 4.5:1 (text) | pass |
| Gamble panel text (navy, unchanged) | `#a9bbd6` | `#14294a` | 7.45:1 | 4.5:1 (text) | pass |
| Centre number, idle (40-64 px) | `#8a9f92` | `#0f1f18` | 6.06:1 | 3:1 (large) | pass |
| Centre number, win (gold, 40-64 px) | `#f2c14e` | `#0f1f18` | 10.18:1 | 3:1 (large) | pass |
| Bet rim (blue) vs square | `#0d6efd` | `#152a20` | 3.37:1 | 3:1 (ui) | pass |
| Win square (green) vs square | `#16a34a` | `#152a20` | 4.60:1 | 3:1 (ui) | pass |
| Lit square (snow) vs square | `#f4f1ea` | `#152a20` | 13.45:1 | 3:1 (ui) | pass |
| Jackpot gold rim vs frame | `#b8892a` | `#0f1f18` | 5.41:1 | 3:1 (ui) | pass |
| Win card gold rim vs frame | `#b8892a` | `#0f1f18` | 5.41:1 | 3:1 (ui) | pass |
| Gold Start vs dock rail | `#f2c14e` | `#12251c` | 9.57:1 | 3:1 (ui) | pass |
| Berry Gamble vs dock rail | `#dc1f3f` | `#12251c` | 3.30:1 | 3:1 (ui) | pass |
| Win green vs bet blue (state vs state) | `#16a34a` | `#0d6efd` | 1.37:1 | info | n/a: told apart by hue and shape (fill vs rim), as in the base |
| Disabled button text | `#a6b3ab` | `#2f3d36` | 5.24:1 | disabled | n/a (still above 4.5) |
| Dim (disabled) text on input | `#7c9184` | `#183026` | 4.19:1 | disabled | n/a (exempt; base was 3.6:1) |

The berry was first `#c8102e`. That gave only 2.73:1 for the Gamble button against the dock, so it was brightened to
`#dc1f3f`. White text on it still passes (4.87:1).

## Festive elements

1. **Pine-tinted dark base**: page, frame, dock, cards, inputs and squares.
2. **Festive chips**: 1 snow with berry rim dashes, 5 berry with snow dashes, 10 pine with gold dashes, 25 gold with
   berry dashes, 50 dark pine with gold dashes.
3. **Start / Play / Reload / Refill**: warm gold with dark ink and a 3 px inset "bevel" (`box-shadow`, so no layout
   change). **Gamble**: berry red. **Collect**: stays win green and gets a matching bevel. Disabled buttons are unchanged.
4. **Win card**: gold rim, warm tint, and a holly sprig (`::after`) sitting on its top edge. The win number is gold, and
   the win-amount text stays green.
5. **Jackpot square and 1920x pill**: berry fill, gold rim and gold star or label. A bet on the jackpot keeps its blue
   rim on phones.
6. **Holly sprig in the top bar**: an injected `aria-hidden` SVG sitting on the top bar's bottom edge. It is hidden in
   phone landscape, where only 4 px separate the bar from the board.
7. **Light-bulb string**: an injected `aria-hidden` SVG pattern (wire plus red, gold, green and snow bulbs) along the top
   edge of the dock. On the start and loading screens it runs along the top of the screen.
8. **Gold brand mark** on the start and loading screens, a gold loading bar, and a gold-brown rim on the navy gamble panel.
9. **Optional motion**: half of the bulbs twinkle (opacity, 2.4 s, alternate). This is CSS-only and only inside
   `@media (prefers-reduced-motion: no-preference)`. The renders emulate `reduce` so the PNGs are deterministic.

There are no images, no background art and no snow or particles. Every decoration is `aria-hidden`, absolutely
positioned (or a pseudo-element) and `pointer-events: none`. None of them contains text or a focusable element.

## Weight

| | Raw | gzip |
|---|---|---|
| `xmas.css` | 4,807 B | 2,104 B (`gzip -c xmas.css \| wc -c`) |
| Injected SVG (`decor-snippets.html`) | 1,238 B markup (+ comment) | 532 B (`gzip -9 -c decor-snippets.html \| wc -c`) |
| **Both together** | | **2,452 B** (`cat xmas.css decor-snippets.html \| gzip -9 -c \| wc -c`), under the ~5 KB budget |

`render.mjs` also measures with zlib and fails above 5,120 B (`measurements.json` → `summary.weight`: 2,422 B
together, without the snippet file's comment). The SVG is injected once per page, so per page it is about 0.5 KB gzip.

## Measurement results (render.mjs)

13 pages were rendered and **all checks pass**:

| PNG | min tap | min font | min body | ring square | layout drift vs base |
|---|---|---|---|---|---|
| betting-390x844 | 44 | 12 | 14 | (grid) | 0 / 530 elements |
| running-390x844 | 44 | 12 | 14 | 30.5 | 0 / 341 |
| win-gamble-offer-390x844 | 44 | 12 | 14 | 30.5 | 0 / 345 |
| gamble-flip-390x844 | 44 | 12 | 14 | 30.5 | 0 / 365 |
| loss-390x844 | 44 | 12 | 14 | 30.5 | 0 / 348 |
| settings-390x844 | 44 | 12 | 14 | (sheet) | 0 / 614 |
| start-390x844 | 48 | 12 | 14 | – | 0 / 26 |
| loading-390x844 | – | 12 | – | – | 0 / 20 |
| betting-360x640 | 44 | 12 | – | (grid) | 0 / 530 |
| win-gamble-offer-360x640 | 44 | 12 | 14 | 24.6 | 0 / 345 |
| landscape-A-betting-844x390 | 44 | 12 | – | (grid) | 0 / 530 |
| landscape-A-win-844x390 | 44 | 12 | 14 | 25.6 | 0 / 345 |
| betting-768x1024 | 44 | 12 | 14 | 45.6 | 0 / 530 |

No tap target is under 44 px. No text is under 12 px, and no body copy is under 14 px. No square overlaps the centre,
dock or top bar. The centre does not overflow, no control sits outside the safe area, no text is clipped, and no
element's box or font size differs from the base page. The numbers match the base renders, as expected.
`compare-betting-390x844.png` and `compare-win-390x844.png` show the standard design on the left and the Christmas skin
on the right.

## Open questions

1. **Gold Start vs blue Start.** In the base, Start shares the bet blue, which ties "your bets" to "start the round".
   The skin makes Start gold so it reads as festive. Is losing that link acceptable for the season? The alternative is
   to keep Start blue and use gold only on the win and jackpot.
2. **Berry Gamble next to red loss / error semantics.** Gamble is now the same red family as the loss accent and the
   red gamble disc. That is arguably fitting (risk), but it does make Gamble look louder than Collect. Should Gamble
   stay blue?
3. **Selection accents left blue** (settings tabs, toggles, "Your pick", "Betting open"). Changing them to berry or gold
   would look more festive, but red toggles can read as "off" or "error". Is keeping them blue OK?
4. **Bet badge at 4.50:1** is the unchanged base `#0d6efd` with white text, so it passes by a hair. Should v4 darken
   the bet blue slightly (e.g. `#0b63e5`) for both skins?
5. **Gamble panel** keeps the midnight navy because red and white discs need a neutral ground. Is a navy panel on a
   pine page fine, or should it become a darker pine?
6. **Twinkle**: it is opt-in by motion preference only. Should it also follow the in-game "Reduced motion" setting, and
   should it pause while the light runs so it doesn't compete with the light?
7. **How it ships**: a body class (`.theme-xmas`) toggled by date, or a separate CSS bundle? `xmas.css` is written as
   `:root` overrides, so either works. A class gate would need the selectors prefixed.
8. Pages that were not asked for (paytable, help, refill, error, tip-sheet, rotate) are also generated in `mocks/` but
   not rendered. Should they get PNGs too?
