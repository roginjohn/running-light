// Responsive layout. Pure: viewport size -> region rectangles and tile geometry. The track pitch is fitted to the
// available space and clamped to the token values (never larger).
// v3 frame (batch 2, tokens.md §4): a centred frame (max 1600x980, 16 px minimum page margin) holding the rail
// (230 px + 1 px divider) and the game area, with a 40 px bottom bar across the full frame width. Tablet portrait
// stacks game area, control dock and bottom bar inside the same frame.
// SCOPE: desktop and tablet only. The mobile (< 600 px, 11x16 ring) layout is NOT built in this release: narrower
// viewports fall back to the tablet-portrait layout (scaled down). See README.md.

export const FRAME = { maxW: 1600, maxH: 980, margin: 16, rail: 230, divider: 1, bar: 40 };
export const TRACK = { gap: 6, pitchMin: 40, pitchMax: 70 };
export const TOP_ROW = { h: 56, hSmall: 44 };
// big mono multiplier (tokens.md §2): 88 desktop, 64 at 1280x720, 52 on tablet portrait
export const BIG_F = { 'desktop-xl': 88, desktop: 64, 'tablet-landscape': 64, 'tablet-portrait': 52 };

// Rail controls (v3 batch 3, tokens.md §3): rail padding 16 (12 at 1280) with a 12 gap between blocks; input 40,
// chip 34 (40 on tablet), secondary button 32, primary button 52 (48 at 1280, 56 on tablet).
// px = the square pitch the v2 WIN tag sizes were drawn for (tags scale by pitch / px; restyled in batch 5).
const BPS = {
  'desktop-xl': {
    s: 1, px: 84,
    tag: { h: 22, f: 12.5, gx: 70, gy: 32 },
    rail: { pad: 16, chip: 34, gapY: 12, inputH: 40, actH: 32, mainH: 52 },
  },
  desktop: {
    s: 0.8, px: 53,
    tag: { h: 17, f: 10.5, gx: 54, gy: 24 },
    rail: { pad: 12, chip: 34, gapY: 12, inputH: 40, actH: 32, mainH: 48 },
  },
  'tablet-landscape': {
    s: 0.8, px: 44,
    tag: { h: 16, f: 10, gx: 50, gy: 22 },
    rail: { pad: 12, chip: 34, gapY: 12, inputH: 40, actH: 32, mainH: 48 },
  },
  'tablet-portrait': {
    s: 0.85, px: 45,
    tag: { h: 16, f: 10, gx: 50, gy: 22 },
    dock: { minH: 390, chip: 40, gapY: 12, inputH: 40, actH: 32, mainH: 56 },
  },
};

export const COLS = 16;
export const ROWS = 11;

export function breakpointFor(w, h) {
  if (w < 900 && h > w) return 'tablet-portrait'; // includes the narrow fallback (phone sizes)
  if (w < 1200) return 'tablet-landscape';
  if (w < 1600) return 'desktop';
  return 'desktop-xl';
}

/** Track geometry: #1 top-left, clockwise; cols squares on top/bottom, rows-2 on each side. */
export function cell(n, cols = COLS, rows = ROWS) {
  const a = cols, b = cols + rows - 2, d = 2 * cols + rows - 2;
  if (n <= a) return [n - 1, 0, 'top'];
  if (n <= b) return [cols - 1, n - cols, 'right'];
  if (n <= d) return [cols - 1 - (n - b - 1), rows - 1, 'bottom'];
  return [0, rows - 1 - (n - d), 'left'];
}

export function computeLayout(W, H) {
  const bp = breakpointFor(W, H);
  const B = BPS[bp];
  const dockMode = bp === 'tablet-portrait';
  const L = { bp, W, H, s: B.s, cols: COLS, rows: ROWS, dockMode };

  const fw0 = Math.min(FRAME.maxW, W - 2 * FRAME.margin), fh0 = Math.min(FRAME.maxH, H - 2 * FRAME.margin);
  const frame = { x: Math.round((W - fw0) / 2), y: Math.round((H - fh0) / 2), w: fw0, h: fh0 };
  const bar = { x: frame.x, y: frame.y + frame.h - FRAME.bar, w: frame.w, h: FRAME.bar };
  const bodyH = frame.h - FRAME.bar;
  L.header = frame.y; // top edge of the playable area (tooltips and full dialogs stay below it)

  let stage, rail = null, dock = null;
  if (!dockMode) {
    rail = { ...B.rail, x: frame.x, y: frame.y, w: FRAME.rail, h: bodyH };
    const gx = frame.x + FRAME.rail + FRAME.divider;
    stage = { x: gx, y: frame.y, w: frame.x + frame.w - gx, h: bodyH };
  } else {
    stage = { x: frame.x, y: frame.y, w: frame.w, h: 0 };
  }

  // Track (v3 batch 4, tokens.md §4): a top row ("Last results" / "Last bets"), then the track box. Square pitch
  // = clamp(40, floor(min(boxW / 16, boxH / 11)), 70), tile = pitch - 6, centred in the box. The 40 floor only
  // gives way when 16 squares of 40 cannot fit the width (the narrow < 600 px fallback, not a v3 layout).
  const xl = bp === 'desktop-xl';
  const padX = xl ? 24 : 16;
  const top = { x: stage.x + padX, y: stage.y, w: stage.w - 2 * padX, h: xl ? TOP_ROW.h : TOP_ROW.hSmall };
  const boxW = stage.w - 2 * padX;
  const boxH = dockMode ? bar.y - 12 - B.dock.minH - (stage.y + top.h) : stage.h - top.h;
  const fit = Math.floor(Math.min(boxW / COLS, boxH / ROWS));
  const pitch = Math.min(TRACK.pitchMax, Math.max(fit, Math.min(TRACK.pitchMin, Math.floor(boxW / COLS))));
  const g = pitch >= TRACK.pitchMin ? TRACK.gap : Math.max(2, Math.round(pitch * 0.12));
  const f = Math.min(1, pitch / B.px);
  const px = pitch, py = pitch;
  const tw = px - g, th = py - g;
  const trackW = COLS * px - g, trackH = ROWS * py - g;
  if (dockMode) stage.h = top.h + trackH + 12;
  const track = {
    x: Math.round(stage.x + (stage.w - trackW) / 2),
    y: Math.round(stage.y + top.h + (dockMode ? 0 : Math.max(0, (boxH - trackH) / 2))),
    w: trackW, h: trackH,
  };
  if (dockMode) {
    const y = stage.y + stage.h;
    dock = { ...B.dock, x: frame.x + 12, y, w: frame.w - 24, h: bar.y - y - 12 };
  }
  // tile type (tokens.md §2-3): square numbers hidden at 48 px tiles and below; multiplier 12/11/10; badge 18/16/15
  const tile = { w: tw, h: th, showNum: tw > 48, mult: tw >= 60 ? 12 : tw >= 44 ? 11 : 10, badge: tw >= 60 ? 18 : tw >= 44 ? 16 : 15 };
  const tag = { h: Math.max(14, B.tag.h * f), f: Math.max(9, B.tag.f * f), gx: B.tag.gx * f, gy: B.tag.gy * f };
  // centre panel: the ring interior inset by 12 px (tokens.md §4)
  const inner = { x: track.x + tw + 12, y: track.y + th + 12, w: (COLS - 1) * px - tw - 24, h: (ROWS - 1) * py - th - 24 };
  L.bigF = Math.min(BIG_F[bp], Math.floor(inner.w / 5.2));
  const pos = [null];
  for (let n = 1; n <= 50; n++) {
    const [c, r, side] = cell(n);
    pos.push({ x: track.x + c * px, y: track.y + r * py, side });
  }
  Object.assign(L, { f, px, py, g, tile, tag, frame, bar, stage, rail, dock, top, track, inner, pos });
  return L;
}

/** CSS custom properties for the current layout (applied on #app). */
export function layoutVars(L) {
  const t = L.tile;
  const v = {
    '--s': L.s, '--tw': `${t.w}px`, '--th': `${t.h}px`, '--num-d': t.showNum ? 'block' : 'none', '--mult-f': `${t.mult}px`,
    '--badge': `${t.badge}px`, '--big-f': `${L.bigF}px`, '--tag-h': `${L.tag.h}px`, '--tag-f': `${L.tag.f}px`,
  };
  const c = L.rail || L.dock;
  Object.assign(v, {
    '--chip': `${c.chip}px`, '--gap-y': `${c.gapY}px`, '--rail-pad': `${c.pad || 0}px`, '--input-h': `${c.inputH}px`,
    '--act-h': `${c.actH}px`, '--main-h': `${c.mainH}px`,
  });
  return v;
}

/** Where the inward WIN tag of square n goes (top row -> below, bottom -> above, left col -> right, right col -> left). */
export function winTagRect(L, n, second) {
  const { x, y, side } = L.pos[n];
  const t = L.tag;
  const w = (second ? 5 : 4.6) * t.f * 0.72 + t.h * 0.7;
  const tw = L.tile.w, th = L.tile.h;
  const cx = x + tw / 2, cy = y + th / 2;
  if (side === 'top') return { x: cx - w / 2, y: y + th + 8, w, h: t.h, dir: 'down' };
  if (side === 'bottom') return { x: cx - w / 2, y: y - 8 - t.h, w, h: t.h, dir: 'up' };
  if (side === 'left') return { x: x + tw + 9, y: cy - t.h / 2, w, h: t.h, dir: 'right' };
  return { x: x - 9 - w, y: cy - t.h / 2, w, h: t.h, dir: 'left' };
}
