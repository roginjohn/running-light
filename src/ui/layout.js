// Responsive layout. Pure: viewport size -> region rectangles and tile geometry. The track pitch is fitted to the
// available space and clamped to the token values (never larger).
// v3 frame (batch 2, tokens.md §4): a centred frame (max 1600x980, 16 px minimum page margin) holding the rail
// (230 px + 1 px divider) and the game area, with a 40 px bottom bar across the full frame width. Tablet portrait
// stacks game area, control dock and bottom bar inside the same frame.
// SCOPE: desktop and tablet only. The mobile (< 600 px, 11x16 ring) layout is NOT built in this release: narrower
// viewports fall back to the tablet-portrait layout (scaled down). See README.md.

export const FRAME = { maxW: 1600, maxH: 980, margin: 16, rail: 230, divider: 1, bar: 40 };

// Rail controls (v3 batch 3, tokens.md §3): rail padding 16 (12 at 1280) with a 12 gap between blocks; input 40,
// chip 34 (40 on tablet), secondary button 32, primary button 52 (48 at 1280, 56 on tablet).
const BPS = {
  'desktop-xl': {
    s: 1, px: 84, py: 80, g: 8,
    tile: { num: 17, bulb: 24, band: 21, bandF: 13, badge: 22, badgeF: 13 }, tag: { h: 22, f: 12.5, gx: 70, gy: 32 },
    rail: { pad: 16, chip: 34, gapY: 12, inputH: 40, actH: 32, mainH: 52 },
  },
  desktop: {
    s: 0.8, px: 53, py: 52, g: 5,
    tile: { num: 13, bulb: 15, band: 15, bandF: 10, badge: 16, badgeF: 10.5 }, tag: { h: 17, f: 10.5, gx: 54, gy: 24 },
    rail: { pad: 12, chip: 34, gapY: 12, inputH: 40, actH: 32, mainH: 48 },
  },
  'tablet-landscape': {
    s: 0.8, px: 44, py: 54, g: 4,
    tile: { num: 12, bulb: 15, band: 15, bandF: 9.5, badge: 16, badgeF: 10 }, tag: { h: 16, f: 10, gx: 50, gy: 22 },
    rail: { pad: 12, chip: 34, gapY: 12, inputH: 40, actH: 32, mainH: 48 },
  },
  'tablet-portrait': {
    s: 0.85, px: 45, py: 44, g: 4,
    tile: { num: 12, bulb: 14, band: 15, bandF: 9.5, badge: 16, badgeF: 10 }, tag: { h: 16, f: 10, gx: 50, gy: 22 },
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

  let stage, rail = null, dock = null, f;
  if (!dockMode) {
    rail = { ...B.rail, x: frame.x, y: frame.y, w: FRAME.rail, h: bodyH };
    const gx = frame.x + FRAME.rail + FRAME.divider;
    stage = { x: gx, y: frame.y, w: frame.x + frame.w - gx, h: bodyH };
    const fw = (stage.w - 24 + B.g) / (COLS * B.px);
    const fh = (stage.h - 24 + B.g) / (ROWS * B.py);
    f = Math.max(0.3, Math.min(1, fw, fh));
  } else {
    const d = B.dock;
    const fw = (frame.w - 24 + B.g) / (COLS * B.px);
    const fh = (bodyH - 24 - 12 - d.minH + B.g) / (ROWS * B.py);
    f = Math.max(0.3, Math.min(1, fw, fh));
    stage = { x: frame.x, y: frame.y, w: frame.w, h: 0 };
  }

  const px = B.px * f, py = B.py * f, g = Math.max(2, B.g * f);
  const tw = px - g, th = py - g;
  const trackW = COLS * px - g, trackH = ROWS * py - g;
  if (dockMode) stage.h = trackH + 24;
  const track = {
    x: stage.x + (stage.w - trackW) / 2,
    y: stage.y + (dockMode ? 12 : Math.max(12, (stage.h - trackH) / 2)),
    w: trackW, h: trackH,
  };
  if (dockMode) {
    const y = stage.y + stage.h;
    dock = { ...B.dock, x: frame.x + 12, y, w: frame.w - 24, h: bar.y - y - 12 };
  }
  const tile = {
    w: tw, h: th,
    num: Math.max(10, B.tile.num * f), bulb: Math.max(8, B.tile.bulb * f), band: Math.max(11, B.tile.band * f),
    bandF: Math.max(9, B.tile.bandF * f), badge: Math.max(13, B.tile.badge * f), badgeF: Math.max(9, B.tile.badgeF * f),
  };
  tile.numX = Math.max(4, tw * 0.11);
  tile.numY = Math.max(4, th * 0.1);
  tile.bulbY = (th - tile.band) * 0.56 + 2;
  tile.lock = Math.max(10, tile.num * 0.75);
  const tag = { h: Math.max(14, B.tag.h * f), f: Math.max(9, B.tag.f * f), gx: B.tag.gx * f, gy: B.tag.gy * f };
  const inner = {
    x: track.x + px + tag.gx, y: track.y + py + tag.gy,
    w: (COLS - 2) * px - g - 2 * tag.gx, h: (ROWS - 2) * py - g - 2 * tag.gy,
  };
  const pos = [null];
  for (let n = 1; n <= 50; n++) {
    const [c, r, side] = cell(n);
    pos.push({ x: track.x + c * px, y: track.y + r * py, side });
  }
  Object.assign(L, { f, px, py, g, tile, tag, frame, bar, stage, rail, dock, track, inner, pos });
  return L;
}

/** CSS custom properties for the current layout (applied on #app). */
export function layoutVars(L) {
  const t = L.tile;
  const v = {
    '--s': L.s, '--tw': `${t.w}px`, '--th': `${t.h}px`, '--num-f': `${t.num}px`, '--num-x': `${t.numX}px`, '--num-y': `${t.numY}px`,
    '--bulb': `${t.bulb}px`, '--bulb-y': `${t.bulbY}px`, '--band': `${t.band}px`, '--band-f': `${t.bandF}px`,
    '--badge': `${t.badge}px`, '--badge-f': `${t.badgeF}px`, '--lock-s': `${t.lock}px`, '--tag-h': `${L.tag.h}px`, '--tag-f': `${L.tag.f}px`,
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
