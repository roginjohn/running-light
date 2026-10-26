// Procedural Web Audio implementation of every sound in animation-sound-notes §3.
// No audio files: all sounds are synthesised at runtime (original, project-owned; see AUDIO.md).
// Muted until the first user interaction (the AudioContext is created on the first click/key).

const SFX_IDS = [
  'sfx_click', 'sfx_chip_select', 'sfx_chip_place', 'sfx_chip_remove', 'sfx_deny', 'sfx_start', 'sfx_relay_tick',
  'sfx_relay_tick_alt', 'sfx_stop_thunk', 'sfx_double_run_horn', 'sfx_win_small', 'sfx_win_big', 'sfx_win_jackpot',
  'sfx_loss', 'sfx_collect', 'sfx_gamble_pick', 'sfx_drumroll', 'sfx_gamble_win', 'sfx_gamble_lose', 'sfx_modal',
  'sfx_refill', 'sfx_toast',
];
export const AUDIO_IDS = ['bgm_perya_loop', 'amb_crowd_bed', ...SFX_IDS];

export function createAudio() {
  let ctx = null, master, musicBus, sfxBus, duckGain, noiseBuf;
  let settings = { mute: false, music: 60, sfx: 80 };
  let unlocked = false;
  let bgmTimer = null, bgmStep = 0, bgmNext = 0;
  let jackpotNodes = [];
  let tickRR = 0;

  const vol = (v) => (v / 100) ** 1.6; // perceptual-ish curve

  function apply() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(settings.mute ? 0 : 0.9, now, 0.03);
    musicBus.gain.setTargetAtTime(vol(settings.music) * 0.55, now, 0.05);
    sfxBus.gain.setTargetAtTime(vol(settings.sfx), now, 0.03);
  }

  function unlock() {
    if (unlocked) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    unlocked = true;
    master = ctx.createGain();
    master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); // keeps peaks below clipping
    comp.threshold.value = -10;
    comp.connect(master);
    musicBus = ctx.createGain();
    duckGain = ctx.createGain();
    musicBus.connect(duckGain);
    duckGain.connect(comp);
    sfxBus = ctx.createGain();
    sfxBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
    apply();
    startBgm();
  }

  // ---------------------------------------------------------------- building blocks
  function env(g, t, a, peak, dec, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + dec);
  }
  function tone(freq, t, dur, { type = 'sine', peak = 0.3, attack = 0.005, bus = sfxBus, detune = 0, slideTo = null } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    o.detune.value = detune;
    env(g, t, attack, peak, dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }
  function noise(t, dur, { peak = 0.3, freq = 2000, q = 1, type = 'bandpass', bus = sfxBus, attack = 0.002 } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  }
  const wood = (t, f, peak = 0.35) => { tone(f, t, 0.06, { type: 'triangle', peak }); noise(t, 0.03, { peak: peak * 0.5, freq: f * 3, q: 4 }); };
  const bell = (t, f, dur = 0.8, peak = 0.18) => { tone(f, t, dur, { peak }); tone(f * 2.76, t, dur * 0.6, { peak: peak * 0.35 }); tone(f * 5.4, t, dur * 0.3, { peak: peak * 0.12 }); };
  const brass = (t, f, dur, peak = 0.12) => {
    tone(f, t, dur, { type: 'sawtooth', peak, attack: 0.03 });
    tone(f, t, dur, { type: 'square', peak: peak * 0.4, attack: 0.03, detune: 7 });
  };
  const semis = (base, n) => base * 2 ** (n / 12);

  // ---------------------------------------------------------------- SFX
  const SFX = {
    sfx_click: (t) => wood(t, 1400, 0.25),
    sfx_chip_select: (t) => { wood(t, 1800, 0.22); wood(t + 0.04, 2400, 0.12); },
    sfx_chip_place: (t, o = {}) => wood(t, semis(900, o.step || 0), 0.32),
    sfx_chip_remove: (t) => wood(t, 650, 0.18),
    sfx_deny: (t) => tone(180, t, 0.14, { type: 'triangle', peak: 0.25 }),
    sfx_start: (t) => { noise(t, 0.08, { peak: 0.4, freq: 300, q: 2 }); tone(90, t, 0.25, { type: 'square', peak: 0.12 }); wood(t + 0.18, 500, 0.3); },
    sfx_relay_tick: (t, o = {}) => {
      tickRR = (tickRR + 1) % 6;
      const f = (2600 + tickRR * 60) * 2 ** ((o.pitch || 0) / 12);
      noise(t, 0.025, { peak: 0.16 * (o.gain || 1), freq: f, q: 6 });
      tone(f / 4, t, 0.02, { type: 'square', peak: 0.03 * (o.gain || 1) });
    },
    sfx_relay_tick_alt: (t, o = {}) => { const f = 3600 * 2 ** ((o.pitch || 0) / 12); noise(t, 0.025, { peak: 0.14, freq: f, q: 8 }); tone(f / 3, t, 0.02, { peak: 0.04 }); },
    sfx_stop_thunk: (t) => { noise(t, 0.12, { peak: 0.45, freq: 220, q: 1.5 }); tone(70, t, 0.22, { type: 'triangle', peak: 0.3 }); },
    sfx_double_run_horn: (t) => { brass(t, 392, 0.28); brass(t + 0.3, 523, 0.9, 0.14); brass(t + 0.3, 659, 0.9, 0.08); },
    sfx_win_small: (t) => { bell(t, 1046); bell(t + 0.22, 1318, 0.9); },
    sfx_win_big: (t) => {
      [523, 659, 784].forEach((f, i) => brass(t + i * 0.14, f, 0.25, 0.12));
      brass(t + 0.45, 1046, 1.2, 0.14); brass(t + 0.45, 784, 1.2, 0.08);
      noise(t + 0.4, 2.0, { peak: 0.06, freq: 1200, q: 0.4, attack: 0.3 }); // crowd cheer bed
    },
    sfx_win_jackpot: (t) => {
      const nodes = [];
      const seq = [523, 659, 784, 1046, 784, 1046, 1318];
      seq.forEach((f, i) => nodes.push(tone(f, t + i * 0.18, 0.3, { type: 'sawtooth', peak: 0.1, attack: 0.02 })));
      nodes.push(tone(1046, t + 1.35, 2.2, { type: 'sawtooth', peak: 0.12, attack: 0.05 }), tone(1568, t + 1.35, 2.2, { type: 'square', peak: 0.05, attack: 0.05 }));
      nodes.push(noise(t + 0.8, 3.0, { peak: 0.07, freq: 1300, q: 0.4, attack: 0.4 }));
      jackpotNodes = nodes;
    },
    sfx_loss: (t) => { wood(t, 700, 0.15); wood(t + 0.18, 520, 0.12); },
    sfx_collect: (t) => { bell(t, 1568, 0.6, 0.14); bell(t + 0.12, 2093, 0.7, 0.12); },
    sfx_gamble_pick: (t) => { wood(t, 1500, 0.2); bell(t + 0.03, 2637, 0.15, 0.06); },
    sfx_drumroll: (t) => { for (let i = 0; i < 40; i++) noise(t + i * 0.03, 0.04, { peak: 0.06 + i * 0.002, freq: 1800, q: 0.8 }); },
    sfx_gamble_win: (t) => { noise(t, 0.08, { peak: 0.35, freq: 2500, q: 1 }); bell(t + 0.05, 1318, 0.5, 0.16); },
    sfx_gamble_lose: (t) => noise(t, 0.35, { peak: 0.12, freq: 6000, q: 0.5, type: 'highpass' }),
    sfx_modal: (t) => noise(t, 0.12, { peak: 0.05, freq: 900, q: 0.7 }),
    sfx_refill: (t) => [784, 988, 1175, 1568].forEach((f, i) => bell(t + i * 0.12, f, 0.6, 0.11)),
    sfx_toast: (t) => wood(t, 2000, 0.08),
  };

  function play(id, opts) {
    if (!ctx || settings.mute || !SFX[id]) return;
    try {
      SFX[id](ctx.currentTime + 0.005, opts);
    } catch { /* audio is decorative */ }
  }

  function stopJackpot() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const n of jackpotNodes) {
      try { n.stop(t + 0.15); } catch { /* already stopped */ }
    }
    jackpotNodes = [];
  }

  // ---------------------------------------------------------------- BGM: bgm_perya_loop (+ amb_crowd_bed)
  // 110 BPM major-key brass-band loop, 32 bars (~70 s) generated step by step with a look-ahead scheduler.
  const BPM = 110, STEP = 60 / BPM / 2; // eighth notes
  const PROG = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
  const MEL = [7, 9, 11, 12, 11, 9, 7, 4, 5, 7, 9, 12, 11, 9, 7, 7, 9, 11, 12, 14, 12, 11, 9, 7, 4, 5, 7, 9, 7, 4, 2, 0];
  function bgmStepAt(t, i) {
    const bar = Math.floor(i / 8) % PROG.length;
    const chord = PROG[bar];
    const root = 196; // G3
    const beat = i % 8;
    if (beat % 2 === 0) tone(semis(root / 2, chord[0] + (beat % 4 === 0 ? 0 : 7)), t, 0.22, { type: 'triangle', peak: 0.22, bus: musicBus }); // tuba
    if (beat % 2 === 1) chord.forEach((n) => tone(semis(root, n), t, 0.12, { type: 'square', peak: 0.025, bus: musicBus })); // off-beat brass stabs
    if (beat === 2 || beat === 6) noise(t, 0.09, { peak: 0.06, freq: 2200, q: 0.9, bus: musicBus }); // snare
    if (i % 2 === 0) {
      const m = MEL[(i / 2) % MEL.length];
      if ((i / 2) % 8 !== 7) tone(semis(root * 2, m), t, STEP * 1.7, { type: 'sawtooth', peak: 0.03, attack: 0.02, bus: musicBus }); // trumpet line
    }
    if (i % 32 === 0) noise(t, STEP * 32, { peak: 0.012, freq: 700, q: 0.3, bus: musicBus, attack: 1.0 }); // amb_crowd_bed
  }
  function startBgm() {
    if (bgmTimer || !ctx) return;
    bgmNext = ctx.currentTime + 0.1;
    bgmTimer = setInterval(() => {
      if (!ctx) return;
      while (bgmNext < ctx.currentTime + 0.25) {
        if (settings.music > 0 && !settings.mute) bgmStepAt(bgmNext, bgmStep);
        bgmStep = (bgmStep + 1) % (PROG.length * 8 * 4);
        bgmNext += STEP;
      }
    }, 60);
  }
  function duck(on) {
    if (!ctx) return;
    duckGain.gain.setTargetAtTime(on ? 0.5 : 1, ctx.currentTime, 0.12); // -6 dB
  }

  return {
    unlock,
    get unlocked() { return unlocked; },
    setSettings(s) { settings = { ...settings, ...s }; apply(); },
    play,
    duck,
    stopJackpot,
    ids: AUDIO_IDS,
  };
}
