# Running Light: Design Brief, Session One (DESIGN ONLY)

From: Online Casino Game Specialist (for Rogin John) · To: Claude CLI Specialist · Date: 2026-10-22 (Asia/Manila)
Project: `running-light` · Source spec: `/workspace/casino-games/running-light/spec/game-design-spec.md` (draft 2)

> **SCOPE: DESIGN ONLY. This brief does NOT authorise any coding.** Do not write game code, HTML, CSS, JS, a game engine, or a playable prototype. Coding happens only in a separate Session Two, after this design is reviewed and approved and a final development prompt is issued. Static design files (PNG mockups, token JSON/MD, SVG/PNG assets) are allowed. If you generate images with scripts, use those scripts only to produce the design files.

Legend: **[C]** confirmed by Rogin (2026-10-22) · **[R]** recommendation (design it as described) · **[O]** open: design the suggested default and flag it in your notes.

---
## 1. Game concept and objectives
A digital version of the Philippine perya (local fair) **Running Light** game [C]. Players bet simulated credits on numbered squares of a 50-square bulb track. A light races around the track, slows down and stops on one square. Bets on that square win its multiplier. Objectives: nostalgic, warm, suspenseful fun with results that are always clear. **Simulated credits only, with no real money** [C].

## 2. Core gameplay mechanics
- Loop: pick a chip, place bets on squares, press START. The light runs for 4–6 s and stops. The round is settled. If there is a win, the Gamble offer appears. Then Collect, and the board is ready for the next round (rebet).
- **Double Run** [C]: in 1 of 25 rounds a second light (turquoise-tinted) runs after the first stops. Two different squares win that round.
- **Gamble** [C]: after a win, the player may stake the full win on a fair 50/50 (double or nothing), up to 3 times, and may collect at any time. Gamble is disabled when doubling would exceed 30,000 credits.
- Outcomes are decided by RNG before any animation. Animations only reveal them (design must never imply a "near-stop" was the result).

## 3. Approved rules and interactions [C 2026-10-22]
- Paytable (multiplier = total return incl. stake): **21×24x, 19×96x, 7×480x, 2×960x, 1×1920x**. Stop weights 80/20/4/2/1 → hit chance 24x ≈1/25, 96x ≈1/101, 480x ≈1/503, 960x ≈1/1,005, 1920x ≈1/2,010. RTP ≈95.45%.
- Bet limits: **1–10 credits per square, 1–200 per round**, never above balance.
- **1,000 starting credits; free refill to 1,000** when balance < 1.
- Gamble max 3, cap 30,000, fair 50/50.
- Interactions [R]: chips 1/5/10/25/50. Left-click a square adds a chip, right-click/Shift-click removes one. Undo, Clear, Rebet, START. Keys: 1–5 chip, Space start, Ctrl+Z undo, C clear, R rebet, M mute, Tab/Enter on squares.
- Open [O]: **multiplier layout fixed vs reshuffled each round**. Design default: **fixed layout** (design one frozen arrangement and show it consistently). **Skip/Turbo**: show a **Turbo toggle in Settings as a design placeholder only**, labelled "placeholder – pending approval" in your notes.

## 4. Target platform and design constraints
- Desktop browser first [C]. **16:9, 1920×1080 reference**. Must stay legible scaled to 1280×720. Mobile is out of scope.
- Mouse + keyboard. Visible focus states are required.
- WCAG AA text contrast. Never rely on colour alone (numbers/icons on tier plaques and lit squares).
- Reduced-motion variant must be describable from your mockups.
- No real-money imagery: chips must not look like real peso coins/bills. No "deposit/withdraw/buy" UI anywhere.
- The 220V electrical background in Rogin's notes is real-world context only. No electrical hazard elements in gameplay.

## 5. Screen and layout requirements (1920×1080)
- **Top bar (~80 px):** logo left, "CREDITS 1,000" centre, Info/Help, Settings and Sound icons right.
- **Board (~1240×860, left/centre):** rectangular track of 50 squares, clockwise from top-left #1: 16 top, 9 right, 16 bottom, 9 left. Each square shows its bulb, number (1–50), tier plaque (multiplier) and a bet badge/chip stack. The **centre panel** inside the track shows the state text ("Place your bets" / "Running…" / "DOUBLE RUN!" / "You win 240"), a Double Run lamp, a mini paytable legend and the last result.
- **Right panel (~560 px):** Total Bet, Last Win, chip rack (5 chips), Undo, Clear, Rebet, large START, history strip (last 10 results, tier-coloured).
- **Modals:** Gamble (centre overlay), Refill/out of credits, Settings + Paytable + Help (tabbed modal OK), Error/Recovery.
- Fixed layout default: distribute tiers so the 1920x square and both 960x squares are spread apart (e.g. 1920x mid-top). Document your arrangement as a 1–50 list.

## 6. Visual direction and references
- Nighttime **Filipino perya**: **warm incandescent bulbs** (≈2700K glow), **hand-painted plywood board** with brush lettering, slight wear, screws and painted borders. **Festive fair** atmosphere: banderitas (bunting), Ferris wheel, string lights, crowd silhouettes in a soft-blurred background.
- Suggested palette [R] (you may refine; deliver final values as tokens): plywood #C8935A / #8A5A2B, perya red #D7263D, marigold #F6AE2D, turquoise #2EC4B6, cream #FFF3D6, night #1B1035, bulb glow #FFD27A.
- Tier colour coding [R]: 24x cream, 96x turquoise, 480x marigold, 960x red, 1920x gold leaf + star.
- Type [R]: sign-painter/hand-lettered display for the title and multipliers. Rounded sans with tabular figures for numbers/UI. Use only fonts with an open license (state the license).
- Visual hierarchy: lit square > balance/win > START > bets > decoration.
- Reference video: https://youtu.be/MNQI6M6pwMY. **[O] Not yet reviewed.** Do not depend on it. If you can view it, note any observations separately, labelled as unapproved.

## 7. Required interface components
Squares in 5 tiers × states **idle, hover/focus, bet placed (with badge 1–10), lit (running light passing), winner (stopped + win), dimmed (non-winning after stop), disabled**; Double Run second-light lit variant. Chips 1/5/10/25/50 × idle/selected/disabled. Buttons (START, Undo, Clear, Rebet, Collect, Gamble, Refill, Reload, Continue) × default/hover/pressed/disabled/focus. Balance, Total Bet and Last Win displays. Toasts ("Max bet reached", "Not enough credits"). Tooltips (square hover with multiplier and odds). Gamble remaining indicator (●●●) and red/white flip bulbs. History strip chips. Settings controls: mute, music/SFX sliders, reduced motion, Turbo (placeholder). Loading screen.

## 8. Animation and sound requirements (provide notes, not code)
- Light run: accelerate 0.6 s, then fast ≈18 squares/s, then ease-out to land on the target, 4–6 s total. Trailing glow on 2–3 bulbs. Relay click per step, slowing in pitch.
- Double Run: bunting flash + "DOUBLE RUN!" banner 0.6 s, then second light 2–3 s. The first winner stays lit.
- Wins: tiered celebration (small <100x, big ≥480x marquee chase, 1920x fanfare ≤4 s, skippable). Win count-up ≤1.5 s. Loss: soft fade, no harsh sound.
- Gamble: red/white bulbs alternate 1.2 s, then settle. Drumroll.
- Buttons: 80 ms press scale 0.96 + click.
- Reduced motion: no chase or particles or flashes. Light jumps in ≤3 steps / 0.8 s fade. Result text immediate.
- Audio: perya crowd/brass BGM loop, SFX list. Mute (M) + separate Music/SFX volume. Muted until the first interaction.
- Animations must never hide balance, bet or win values.

## 9. Required design deliverables
Save everything under **`/workspace/casino-games/running-light/design/session-one/`**:
1. `mockups/` high-fidelity **PNG, 1920×1080**:
   - `01-board-betting.png`: main board idle/betting with several bets placed.
   - `02-spinning.png`: light mid-run, controls locked.
   - `03-win-single.png`: single win result (e.g. 5 on a 96x square = 480).
   - `04-double-run-result.png`: Double Run with two lit winners and banner.
   - `05-gamble.png`: gamble modal (current win, Gamble ×2 / Collect, remaining ●●○).
   - `06-loss.png`: loss result.
   - `07-refill-modal.png`: out of credits / refill 1,000.
   - `08-settings-paytable-help.png`: modal(s) showing settings (incl. Turbo placeholder), the full paytable with odds, and help/rules incl. the "Play credits only. No real money value." disclaimer (multiple PNGs `08a/08b/08c` OK).
   - `09-error-recovery.png`: error state + "Round restored – Continue" recovery state (two PNGs OK).
2. `design-tokens.json` (+ `design-tokens.md` readable version): colours (incl. tier colours and state colours), typography (families, sizes, weights, line heights), spacing scale, radii, shadows/glows, z-layers, motion durations/easings.
3. `component-sheet.png` (one or more, any size): chips; squares in all 5 tiers × states idle, bet placed, lit, winner (plus hover/focus, dimmed, disabled); buttons; displays; toasts.
4. `asset-inventory.md`: every asset needed for the build (name, type, size/format, layers/states, source/license, file path if produced).
5. `animation-sound-notes.md`: per-event timing, easing, sequencing, reduced-motion variant, SFX/BGM list with mood and duration.
6. `design-implementation-notes.md`: layout grid and measurements, 1–50 square arrangement (fixed layout default), component behaviour per state, scaling rules to 1280×720, accessibility notes, assumptions, and the open items below.
7. Any exported assets in `assets/` (PNG/SVG).

## 10. Design quality criteria (acceptance)
- All 9 mockup screens are present at exactly 1920×1080, in a single consistent style.
- The 50 squares are numbered 1–50 and use tier counts exactly 21/19/7/2/1 with the correct multipliers.
- Balance, Total Bet and Last Win are visible and legible on every gameplay screen. The game state is clear without animation.
- Text meets AA contrast. Tier is identifiable without colour. Focus states are shown.
- No real-money or payment UI. The disclaimer is present in Help.
- Limits shown correctly (1–10/square, 200/round, gamble max 3, cap 30,000, refill 1,000).
- Tokens and component sheet match the mockups. Every asset in the mockups is listed in the inventory.
- Open items are designed as defaults and explicitly flagged.

## 11. Known limitations and open questions [O]
1. Fixed vs reshuffled multiplier layout. **Design default: fixed.**
2. Skip/Turbo option. **Design default: Turbo toggle in Settings as a placeholder only.**
3. YouTube reference not reviewed. Do not rely on it.
- Title "Running Light" is a working title.
- No mobile layouts are needed in v1.

## 12. Scope boundaries
- In scope: visual and UX design deliverables listed in §9 only.
- Out of scope: **any code or playable build**, RNG/math changes (the math is approved and fixed), mobile, accounts, leaderboards, real money, external services.
- Do not change approved rules. If something seems wrong, note it in `design-implementation-notes.md` under "Questions for the Specialist".
- Do not contact Rogin or other agents. Return results only to the Online Casino Game Specialist.

---
## Instructions for the Claude CLI Specialist design session
1. Read this brief and the source spec. Do not begin coding.
2. Produce the §9 deliverables in `/workspace/casino-games/running-light/design/session-one/`.
3. Self-check against §10 and list any criteria you could not meet.
4. **Return directly to the Online Casino Game Specialist:** a short summary of the design, the full file list with paths, the §10 self-check, deviations/assumptions, and open questions. Do not claim deliverables you did not produce.


## Update 2026-10-22
Chip values 1/5/10/25/50 are now CONFIRMED by Rogin (supersedes [R] marks on chips).
