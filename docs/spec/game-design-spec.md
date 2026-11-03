# Running Light — Game Design Specification (Stage Three)

Project slug: `running-light` · Version: draft 1 (2026-10-22, Asia/Manila) · Status: **Draft 2: math, limits and credits approved by Rogin on 2026-10-22. Layout, Skip/Turbo and the reference video are still open.**
Math source of truth: `math/model.py`, `math/results.md`.

Legend: **[C]** Confirmed by Rogin · **[R]** Recommendation (NOT approved) · **[O]** Open decision for Rogin.

---
## 0. Requirement register

### Confirmed [C]
1. Digital version of the Philippine perya "Running Light" game.
2. Board of 50 numbered squares around a track (test size).
3. A running light cycles around the track and stops on one square; bets on that square win its prize.
4. Prizes differ (big and small) and are **credit multipliers**.
5. **Simulated credits only.** No real money, deposits, withdrawals, payments or wallets.
6. Desktop browser first.
7. Extras: **Double Run** (a rare second light, so two squares win) and a **double-or-nothing gamble** after a win.

### Confirmed by Rogin on 2026-10-22 [C]
8. Paytable: 21 squares at 24x, 19 at 96x, 7 at 480x, 2 at 960x and 1 at 1920x. Integer stop weights per square are 80/20/4/2/1.
9. Double Run triggers with probability 1/25 per round. The second stop excludes the first square, and a square hit by either light pays once.
10. Gamble: exactly fair 50/50 on the full win, up to 3 times in a row, collect at any time. Gamble is disabled if doubling would exceed 30,000 credits.
11. Bet limits: 1 to 10 credits per square and 1 to 200 per round.
12. Players start with 1,000 credits and get a free refill to 1,000 when their balance drops below 1.
13. The resulting RTP is about 95.45% (95.38% to 95.53% per square).

### Recommendations [R] (not approved)
- Chip values 1/5/10/25/50.
- Multiplier layout is fixed (shuffled once at design time, then frozen). **Open; this is the design default.**
- A Skip/Turbo toggle. **Open; it appears in designs as a placeholder only.**
- Light run lasts 4 to 6 s, with a reduced-motion mode and mute/volume controls.
- Round recovery through localStorage.

### Open decisions [O]
See Section I.

---
## A. Game Overview
- **Title:** Running Light (working title) [R]. Alt: "Ilaw-Takbo", "Perya Lights" [O].
- **Concept [C]:** Bet credits on numbered squares; a bulb light races around the 50-square track, slows and stops; the lit square pays its multiplier.
- **Theme [R]:** Nighttime Filipino perya: warm incandescent bulbs, hand-painted plywood board, banderitas (bunting), carnival crowd ambience.
- **Platform:** Desktop browser [C], 16:9 at 1920×1080 reference, scales 1280×720 to 2560×1440 [R]. Mobile out of scope for v1.
- **Primary objective:** Entertainment with simulated credits. The player tries to grow their credit balance.
- **Key features:** 50-square bulb track, tiered multipliers, Double Run [C], Gamble [C], rebet/undo/clear [R], round recovery [R].
- **Player experience:** Nostalgic and suspenseful. The slowdown is the emotional peak, and results stay unambiguous.
- **v1 scope:** Single player, one board, simulated credits. No accounts, leaderboards, missions or real money.

## B. Gameplay Design
1. **Startup:** loading screen with bulb-flicker logo and a progress bar → load assets → read localStorage (balance, settings, pending round) → if pending round, go to Recovery (C) → else Ready.
2. **Main menu/navigation [R]:** no separate menu. The game opens directly onto the board. Top bar: Balance, Info (paytable/rules), Settings (sound, volume, reduced motion, turbo [O]), Reset credits.
3. **Setup:** none required. First launch grants 1,000 credits [C 2026-10-22] and shows a 3-step tooltip tutorial (dismissible, "don't show again").
4. **Player actions (Betting state only):**
   - Select chip (1/5/10/25/50) → highlights chip.
   - Left-click square → add selected chip value to that square (clamped to per-square max and to remaining per-round max and balance; if clamped, show toast "Max bet reached").
   - Right-click / Shift+click square → remove one chip of the selected value (min 0).
   - **Undo** → reverts last bet action (stack, up to the whole round). **Clear** → removes all bets. **Rebet** → restores previous round's bets if affordable (else disabled, tooltip "Not enough credits"). **Rebet ×2** [O].
   - **Start** (button or Space/Enter) → enabled only when total bet ≥ 1 and ≤ balance.
5. **Round initiation:** On Start: lock UI → deduct total bet from balance → RNG generates outcome (first stop, Double Run flag, second stop) → persist round record → begin animation.
6. **Rules and calculations:** see H. Win = Σ over bet squares hit (bet_i × m_i). A square hit by either light pays once.
7. **Resolution:** Light 1 stops → highlight square → if Double Run, banner "DOUBLE RUN!" → second light runs (2–3 s) → stops → highlight. Then total win shown. Loss: lit square(s) pulse, "Try again" text, no penalty sound.
8. **Rewards:** If win > 0, a Gamble offer appears (Collect / Gamble). Collect → credit balance. Loss → straight back to Betting with bets retained (for rebet).
9. **Completion:** each round is independent. There is no game over. At balance < 1 with no bets on the board, show a "Refill 1,000 credits" button [C 2026-10-22].
10. **Replay:** after payout, the board returns to Betting with the last bets shown as ghosts. Rebet is one click.
11. **Error/recovery:** see C (Error, Recovery) and H.

## C. Game State and Logic
States: `INIT → (RECOVERY) → BETTING → SPINNING → RESOLVING → [DOUBLE_RUN → RESOLVING2] → (GAMBLE_OFFER ⇄ GAMBLE) → PAYOUT → BETTING`; any → `ERROR`.

| State | Entry | Allowed input | Exit |
|---|---|---|---|
| INIT | app load | none | assets loaded → RECOVERY if pending record, else BETTING |
| RECOVERY | pending record found | "Continue" | replay result (short or skip) → RESOLVING/GAMBLE_OFFER/PAYOUT as per stored phase |
| BETTING | ready | chips, squares, undo, clear, rebet, start, settings, info | Start valid → SPINNING |
| SPINNING | bet deducted, outcome drawn & persisted | settings (mute) only; optional "Skip" [O] | animation done → RESOLVING |
| RESOLVING | light 1 stopped | none | doubleRun? → DOUBLE_RUN : evaluate |
| DOUBLE_RUN | banner + 2nd light | none | 2nd stop → evaluate |
| GAMBLE_OFFER | win > 0 | Collect, Gamble (if gambles<3 and 2×win ≤ 30,000) | Collect → PAYOUT; Gamble → GAMBLE |
| GAMBLE | gamble outcome drawn & persisted before reveal | none | win → GAMBLE_OFFER (doubled); lose → PAYOUT (0) |
| PAYOUT | credit win, mark record settled | none (≈1.5 s count-up, click to fast-forward) | BETTING |
| ERROR | exception/storage failure | "Reload" | INIT |

Rules:
- **Outcome before animation:** All outcomes (stops, Double Run flag, each gamble flip) are drawn by RNG and written to the round record *before* any reveal animation. Animations only display the stored result.
- **Duplicate start prevention:** Start is disabled on first click. The state guard rejects Start unless state==BETTING. A roundId (monotonic counter + random) is ignored if it already exists. Key auto-repeat is ignored.
- **Duplicate gamble/collect:** same guard. The first accepted action locks the buttons.
- **Invalid actions:** any input outside its allowed state is ignored silently (no state change).
- **Contradictory results:** visual stop square = stored result. In development, an assertion compares the animation's final index to the record.

## D. UI/UX Design Requirements (16:9 desktop)
- **Layout (1920×1080 ref):**
  - Top bar (h≈80): logo left, Balance center ("CREDITS 1,000"), Info/Settings/Sound icons right.
  - Center (≈1240×860): rectangular track of 50 bulb squares (16 top, 9 right, 16 bottom, 9 left, clockwise from top-left = #1). Each square shows its number, its multiplier plaque and a bet chip stack. The center panel shows the last result, the Double Run lamp and a paytable mini-legend.
  - Right panel (≈560 wide): Total Bet, Last Win, chip rack (5 chips), Undo, Clear, Rebet, large START button, history strip (last 10 results).
  - Gamble modal: center overlay, current win, "Gamble ×2 (50/50)", "Collect", remaining gambles (●●●), red/white bulb flip reveal.
- **Indicators:** per-square bet amount badge, total bet, balance (updates on deduct and payout), state text ("Place your bets", "Running…", "DOUBLE RUN!", "You win 240").
- **Disabled states:** greyed with tooltip reason. Start shows "Place a bet" when empty.
- **Modals:** Reset credits (confirm), Info (paytable with exact probabilities/RTP), Settings.
- **Loading/error/empty:** loading bar; error panel with Reload; empty-board hint.
- **Input:** mouse (left/right click, hover highlight with multiplier tooltip), keyboard (Tab focus through squares, Enter = add chip, Backspace = remove, 1–5 = chip select, Space = Start, Z/Ctrl+Z = Undo, C = Clear, R = Rebet, G/Enter = gamble/collect in modal). Touch is not required for v1.
- **Accessibility:** WCAG AA contrast for text; result announced via aria-live; never rely on colour alone (number + icon on lit square); reduced-motion setting (auto from `prefers-reduced-motion`).
- **Responsive:** letterboxed 16:9 scaling; min supported 1280×720; below that show the message "Please enlarge window".

## E. Visual Direction [R]
- **Art direction:** hand-painted plywood carnival board at night, slightly worn paint, brushed lettering, visible screws and wiring channels (decorative only; no electrical-hazard gameplay).
- **Palette:** plywood #C8935A / #8A5A2B, perya red #D7263D, marigold #F6AE2D, turquoise #2EC4B6, cream #FFF3D6, night #1B1035. Bulb glow #FFD27A (warm 2700K look).
- **Typography:** display font = hand-lettered sign-painter style (e.g. a "Pinoy jeepney/sign" script) for the title and multipliers; UI = a clean rounded sans for numbers (tabular figures).
- **Background:** blurred perya night (Ferris wheel, banderitas, string lights, crowd silhouettes).
- **Objects:** each square is a painted panel with a glass bulb, number, and a multiplier plaque colour-coded by tier (24x cream, 96x turquoise, 480x marigold, 960x red, 1920x gold leaf with star). Chips look like painted tokens (peso-coin inspired but clearly not real currency).
- **Lighting/FX:** bulbs have off/dim/on states with bloom; the running light leaves a 2–3 bulb trailing glow; win = flashing marquee chase on the frame.
- **Hierarchy:** the lit square > balance/win > Start > bets > decoration.
- **Consistency:** one illustration style, one light temperature, and the same tier colour on board, legend and history.
- **References:** Rogin's video (https://youtu.be/MNQI6M6pwMY) not yet analysed [O].

## F. Animations and Sound
- **Buttons:** 80 ms press-down scale 0.96 + click sound.
- **Light run (4–6 s total, duration RNG-independent of outcome):** accelerate 0.6 s → constant fast ≈18 squares/s for 1.5–2.5 s → ease-out deceleration over the final 1.5–2.5 laps-proportional distance so it stops exactly on the stored square. The path is precomputed from start index, laps (2–4) and target.
- **Double Run:** 0.6 s bunting flash + "DOUBLE RUN!" banner, then a second (turquoise-tinted) light runs 2–3 s. The first lit square stays lit.
- **Win:** square pulse, coins/confetti particles scaled by tier (small < 100x, big ≥ 480x with marquee chase, 1920x jackpot fanfare ≤ 4 s, skippable). Win count-up ≤ 1.5 s.
- **Loss:** soft fade of the lit bulb, no harsh sound.
- **Gamble:** two bulbs (red/white) alternate quickly for 1.2 s, then settle on the stored outcome.
- **Reduced motion:** no chase. The light jumps directly with a 0.8 s fade sequence (or 3 discrete steps). No particles or screen flashes. Results text appears immediately.
- **Sound:** relay clicks per bulb step (pitch-decreasing in slowdown), crowd/brass perya loop (BGM), win jingles by tier, Double Run horn, gamble drumroll. Master mute toggle (M key), separate Music/SFX volume sliders 0–100, persisted. Audio starts muted until the first user interaction (browser autoplay policy).
- Animations never hide balance/bet values and never show a false near-stop as the final result.

## G. Game-Specific Systems
- **Bonus features:** Double Run, Gamble (see H). [C]
- **Save/resume:** localStorage keys `rl.v1.balance`, `rl.v1.settings`, `rl.v1.lastBets`, `rl.v1.round` (pending record), `rl.v1.history` (last 50). [R]
- **Tutorial:** 3 tooltips on first launch. [R]
- **Settings:** sound, volume, reduced motion, turbo [O].
- Out of scope v1: progression, achievements, leaderboards, multiplayer.

## H. Casino-Specific Mechanics
- **Credits:** simulated only, integers, never purchasable or redeemable [C]. Start 1,000. Refill to 1,000 when balance < 1 and no round pending [C 2026-10-22]. Disclaimer in Info: "Play credits only. No real money value."
- **Wager limits:** chip values 1/5/10/25/50 [R]. [C 2026-10-22] for the limits: Per square 1–10. Per round 1–200 (≤ balance). Bets on any number of squares (1–50).
- **Paytable [C 2026-10-22]:** 21×24x, 19×96x, 7×480x, 2×960x, 1×1920x (multiplier = total return incl. stake; e.g. 5 on 96x returns 480).
- **Probabilities [C 2026-10-22]:** first stop P(i) = (1/m_i)/Σ_j(1/m_j) → 24x 3.8223%, 96x 0.9556%, 480x 0.1911%, 960x 0.0956%, 1920x 0.0478% per square.
- **Double Run [C 2026-10-22]:** independent Bernoulli(1/25) per round. Second stop drawn with P(j)/(1−P(first)) over j ≠ first. Each square pays at most once.
- **Payout formula:** win = Σ_{i ∈ bets, i ∈ {s1, s2}} bet_i · m_i. Integer arithmetic only.
- **RTP [C 2026-10-22, derived]:** analytic 95.381% (24x) – 95.526% (1920x); 95.451% for an even all-square spread; Monte Carlo 10M rounds 95.514% overall (see results.md). Base-only 91.734%.
- **Gamble [C 2026-10-22]:** offered when win > 0 (cap of 30,000 confirmed). Stakes the entire current win: P=0.5 → ×2, else 0. Max 3 gambles. Collect anytime. Disabled if 2×win > 30,000. Fair, so RTP is unchanged. Max theoretical round result 28,800 (no gamble) / 30,000 cap with gamble.
- **RNG:** `crypto.getRandomValues` (32-bit uniform, rejection-sampled to avoid modulo bias), mapped through a cumulative-weight table using integer weights (LCM-scaled 1/m_i: 80/20/4/2/1 per square). Seeded PRNG is allowed only in test mode. Do not claim "provably fair" or certified.
- **Round settlement:** record `{id, bets, totalBet, s1, doubleRun, s2, win, gambles:[outcomes], phase, settled}`. Write before animation; update phase on each step; on PAYOUT credit balance and set `settled=true` in a single write of `{balance, round}`.
- **Invalid wagers:** total > balance, square > 10, round > 200, or non-integer → rejected with a toast; Start is disabled.
- **Interrupted round recovery:** on load, if an unsettled record exists: bet was already deducted; resume from stored phase using stored outcomes (no redraw). If in GAMBLE_OFFER, re-offer. Pending gamble outcome is shown as stored. The player can never re-draw by refreshing.
- **Duplicate prevention:** see C. Each roundId is settled at most once (checked before crediting).
- **Testing requirements:** (1) unit tests of payout formula on all tiers and the two-square Double Run case; (2) seeded 10M-round simulation of the JS RNG mapping reproducing RTP within ±0.2 pp overall and hit frequencies within 3σ; (3) chi-square on stop distribution; (4) refresh-at-every-state recovery test; (5) double-click/keyboard repeat test; (6) animation final index == stored stop for 10k rounds.
- **Transaction consistency:** local only. No server or external transactions in v1.

## I. Open decisions for Rogin
1. Should the multiplier layout stay fixed (design default) or be reshuffled each round?
2. Should there be a Skip/Turbo option? The designs show the toggle as a placeholder.
3. The YouTube reference (https://youtu.be/MNQI6M6pwMY) has not been reviewed. Should it be analysed before the design is finalised?

(Paytable, Double Run, gamble, limits and credits were approved on 2026-10-22. See Section 0.)


## Update 2026-10-22
Chip values 1/5/10/25/50 are now CONFIRMED by Rogin (supersedes [R] marks on chips).
