"""Running Light (perya) math model. Simulated credits only.
Base: 50 squares, multiplier m_i = total return incl. stake.
Stop weights w_i = 1/m_i (normalized) -> equal base RTP per square.
Double Run: with prob Q a second light runs; its stop is drawn from the same
weighted distribution EXCLUDING the first square (renormalized). A bet on a
square pays m_i if EITHER light stops there (max once per square per round).
Gamble: after any round with total win W>0, player may gamble the FULL win:
exactly fair 50% -> 2W, else 0. Up to MAX_GAMBLES consecutive times, may
collect at any point. Fair => EV-neutral, RTP unchanged, but volatility up.
"""
from fractions import Fraction as F
import numpy as np, sys, json

TIERS = [(24, 21), (96, 19), (480, 7), (960, 2), (1920, 1)]
Q = F(1, 25)            # Double Run trigger probability per round
MAX_GAMBLES = 3
GAMBLE_P = F(1, 2)

MULTS = [m for m, c in TIERS for _ in range(c)]  # square layout order (spec shuffles placement)
N = len(MULTS)

def probs():
    w = [F(1, m) for m in MULTS]; Z = sum(w)
    return [x / Z for x in w]

def analytic():
    p = probs()
    S = sum(pj / (1 - pj) for pj in p)
    hit = [pi + Q * pi * (S - pi / (1 - pi)) for pi in p]  # P(square i lit by either light)
    rtp = [h * m for h, m in zip(hit, MULTS)]
    base = [pi * m for pi, m in zip(p, MULTS)]
    return p, hit, rtp, base

def per_bet_stats(i, hit):
    """Single 1-credit bet on square i, no gamble: mean & sd of return."""
    m = MULTS[i]; h = float(hit[i]); mu = h * m
    return mu, (h * m * m - mu * mu) ** 0.5

def monte_carlo(rounds=10_000_000, seed=20261022, chunk=1_000_000):
    rng = np.random.default_rng(seed)
    p = np.array([float(x) for x in probs()]); cdf = np.cumsum(p); cdf[-1] = 1.0
    hits = np.zeros(N, np.int64); dr = 0
    for _ in range(rounds // chunk):
        a = np.searchsorted(cdf, rng.random(chunk), side='right')
        trig = rng.random(chunk) < float(Q); k = int(trig.sum()); dr += k
        a_t = a[trig]
        # second stop: weighted draw excluding first -> rejection sampling
        b = np.searchsorted(cdf, rng.random(k), side='right')
        bad = b == a_t
        while bad.any():
            b[bad] = np.searchsorted(cdf, rng.random(int(bad.sum())), side='right'); bad = b == a_t
        hits += np.bincount(a, minlength=N) + np.bincount(b, minlength=N)
    m = np.array(MULTS)
    return hits / rounds * m, hits / rounds, dr / rounds

def gamble_mc(trials=10_000_000, seed=7):
    """Win of 1 always gambled MAX_GAMBLES times: mean return should be 1."""
    rng = np.random.default_rng(seed)
    ok = (rng.random((trials, MAX_GAMBLES)) < 0.5).all(axis=1)
    return float((ok * 2 ** MAX_GAMBLES).mean())

if __name__ == '__main__':
    p, hit, rtp, base = analytic()
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 10_000_000
    sim_rtp, sim_hit, dr = monte_carlo(rounds)
    out = dict(analytic_rtp=[float(x) for x in rtp], base_rtp=float(base[0]),
               p=[float(x) for x in p], hit=[float(x) for x in hit],
               sim_rtp=sim_rtp.tolist(), sim_hit=sim_hit.tolist(), dr_rate=dr,
               gamble_mean=gamble_mc(), sd=[per_bet_stats(i, hit)[1] for i in range(N)],
               rounds=rounds)
    json.dump(out, open('results.json', 'w'), indent=1)
    print(json.dumps({k: v for k, v in out.items() if not isinstance(v, list)}))
