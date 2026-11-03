# Running Light — Math Results

Model: `math/model.py` (exact rational analytics + seeded NumPy Monte Carlo, seed 20261022, 10,000,000 rounds). Status: **Recommendation, not approved by Rogin.**

## Rules modelled
- 50 squares; multiplier = total return incl. stake. Tiers: 21×24x, 19×96x, 7×480x, 2×960x, 1×1920x (the original 25/100/500/1000/2000 scaled by 0.96 so Double Run fits the 95–96% target).
- Stop weight ∝ 1/multiplier (normalized). Base-game RTP (no Double Run) = 91.734% on every square.
- **Double Run**: probability q = 1/25 (4%) per round, drawn by RNG before animation. Second stop drawn from same weights excluding the first square. A bet pays if either light stops on its square (once per square).
- **Gamble**: optional after any win; stakes the full round win at exactly 50/50 (double or zero); max 3 consecutive gambles; collect anytime. Fair → EV-neutral, does not change RTP (chosen so the advertised RTP is true regardless of player choice; only volatility increases).

## Per-tier results (1-credit bet on one square)

| Mult | Squares | Stop prob (1st light) | Hit freq (either light) | RTP analytic | RTP simulated (tier avg) | SD per bet |
|---|---|---|---|---|---|---|
| 24x | 21 | 3.8223% | 3.9742% (1 in 25) | 95.381% | 95.379% | 4.7 |
| 96x | 19 | 0.9556% | 0.9947% (1 in 101) | 95.492% | 95.499% | 9.5 |
| 480x | 7 | 0.1911% | 0.1990% (1 in 503) | 95.520% | 95.392% | 21.4 |
| 960x | 2 | 0.0956% | 0.0995% (1 in 1,005) | 95.524% | 97.838% | 30.3 |
| 1920x | 1 | 0.0478% | 0.0498% (1 in 2,010) | 95.526% | 94.848% | 42.8 |

- Overall RTP (bet spread evenly on all 50): analytic **95.451%**, simulated **95.514%**.
- Per-square analytic RTP range: 95.381% – 95.526% (spread 0.144 pp; 24x squares slightly lower because the second light excludes the first square).
- Simulated per-square RTP range: 94.34% – 99.11% (rare tiers have large sampling noise; e.g. 1920x hit ~1 in 2,010 → ~5,000 hits in 10M).
- Double Run observed rate: 4.002% (target 4%).
- Gamble MC (10M chains of 3 gambles on a win of 1): mean return 0.9997 (fair = 1.0000).
- Round hit frequency depends on coverage: probability ≥1 win = Σ hit_i over bet squares minus overlap (two lights can land on two bet squares).

## Max win
- Max single-square win: 1920x stake. Max per round (no gamble): 1920x + 960x = 2,880x stake on those squares, only via Double Run.
- With 3 full gambles: ×8 → 15,360x (single square) / 23,040x (two squares).
- Recommended cap: max bet 10 credits/square → max base round win 28,800 credits. Gamble cap **30,000 credits**: the Gamble button is disabled when 2× current win would exceed 30,000. Because the gamble is exactly fair, disabling it never changes RTP, and base wins are never truncated → RTP stays exactly as computed above.

## Volatility
- Per-bet SD ranges from ~4.7 (24x) to ~42.8 (1920x) per credit staked — high-volatility game; gamble multiplies variance further.

## Reproduce
`python3 math/model.py 10000000` → writes `math/results.json`.