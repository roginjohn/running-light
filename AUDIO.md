# Running Light — audio record

All audio is **procedural Web Audio synthesis** implemented in `src/ui/audio.js`. No audio files are shipped,
downloaded or streamed. Every sound is original, generated at runtime from oscillators, filtered noise and envelopes
written for this project. **Licence/source for every entry below: original work, project-owned (Running Light),
created in Development Session Two; no third-party samples, no CC0 sources used.**

Behaviour: muted until the first click or key press (the `AudioContext` is created then). Master mute (M key / Sound
icon), separate Music and SFX volumes 0–100 (defaults 60/80), persisted in `rl.v1.settings`. BGM ducks −6 dB during
the light's slowdown and during big-win / jackpot stings. A dynamics compressor on the master bus keeps peaks below
clipping. Loudness targets in the design notes (−18 LUFS SFX / −23 LUFS BGM) were **not measured** (see report).

| ID | Implementation (synthesis recipe) | Approx. length | Source / licence |
|---|---|---|---|
| `bgm_perya_loop` | 110 BPM major-key brass-band loop: triangle "tuba" bass, off-beat square brass stabs, band-passed noise snare, sawtooth "trumpet" melody; 32-bar pattern scheduled with look-ahead | ~70 s loop | original, procedural |
| `amb_crowd_bed` | very quiet low band-pass noise swell under the BGM on the Music bus | per 16 bars | original, procedural |
| `sfx_click` | wood tick (short triangle + noise) | 60 ms | original, procedural |
| `sfx_chip_select` | two light clacks | 120 ms | original, procedural |
| `sfx_chip_place` | wood token tick, +1 semitone per extra chip on the square | 150 ms | original, procedural |
| `sfx_chip_remove` | softer, lower clack | 120 ms | original, procedural |
| `sfx_deny` | soft low "tuk" (180 Hz triangle), never a buzzer | 150 ms | original, procedural |
| `sfx_start` | relay clunk (noise + low square) + lever tick | 400 ms | original, procedural |
| `sfx_relay_tick` | narrow band-pass noise click, 6 round-robin pitches, pitch drops with speed during the slowdown | 25–40 ms | original, procedural |
| `sfx_relay_tick_alt` | brighter tick for the turquoise second light | 25–40 ms | original, procedural |
| `sfx_stop_thunk` | final latch: low noise + 70 Hz triangle | 250 ms | original, procedural |
| `sfx_double_run_horn` | two-note brass "ta-daa" (detuned saw + square) | 1.2 s | original, procedural |
| `sfx_win_small` | two-note bell jingle (inharmonic partials) | 1.0 s | original, procedural |
| `sfx_win_big` | brass arpeggio sting + soft noise "cheer" bed | 2.5 s | original, procedural |
| `sfx_win_jackpot` | full brass fanfare + cheer bed; cut with a 150 ms stop on skip | ≤ 4.0 s | original, procedural |
| `sfx_loss` | soft descending two wood blocks | 500 ms | original, procedural |
| `sfx_collect` | bell + chime (no coin sounds) | 800 ms | original, procedural |
| `sfx_gamble_pick` | wood tick + tiny bell | 150 ms | original, procedural |
| `sfx_drumroll` | 40 rapid noise snare hits, rising | 1.2 s | original, procedural |
| `sfx_gamble_win` | rim-shot noise + bell | 600 ms | original, procedural |
| `sfx_gamble_lose` | high-passed noise "cymbal choke" | 500 ms | original, procedural |
| `sfx_modal` | very quiet band-passed noise slide | 150 ms | original, procedural |
| `sfx_refill` | four-note cheerful bell chime | 1.0 s | original, procedural |
| `sfx_toast` | tiny tick (available; toasts use `sfx_deny` for warnings) | 80 ms | original, procedural |
