// v2 responsive layout (design-tokens-v2.json -> layout.breakpoints). Pure: viewport size -> region rectangles and
// tile geometry. The track pitch is fitted to the available space and clamped to the token values (never larger).
// SCOPE: desktop and tablet only. The mobile (< 600 px, 11x16 ring) layout is NOT built in this release: narrower
// viewports fall back to the tablet-portrait layout (scaled down). See README.md.

const BPS = {
  'desktop-xl': {
    s: 1, header: 64, px: 84, py: 80, g: 8, util: 48,
    tile: { num: 17, bulb: 24, band: 21, bandF: 13, badge: 22, badgeF: 13 }, tag: { h: 22, f: 12.5, gx: 70, gy: 32 },
    rail: { x: 24, y: 80, w: 440, gapX: 16, pad: 24, chip: 68, gapY: 22, fieldH: 132, actH: 52, actF: 15, mainH: 96, mainF: 34 },
  },
  desktop: {
    s: 0.8, header: 52, px: 53, py: 52, g: 5, util: 40,
    tile: { num: 13, bulb: 15, band: 15, bandF: 10, badge: 16, badgeF: 10.5 }, tag: { h: 17, f: 10.5, gx: 54, gy: 24 },
    rail: { x: 16, y: 64, w: 356, gapX: 12, pad: 16, chip: 54, gapY: 14, fieldH: 100, actH: 40, actF: 12, mainH: 72, mainF: 24 },
  },
  'tablet-landscape': {
    s: 0.8, header: 52, px: 44, py: 54, g: 4, util: 40,
    tile: { num: 12, bulb: 15, band: 15, bandF: 9.5, badge: 16, badgeF: 10 }, tag: { h: 16, f: 10, gx: 50, gy: 22 },
    rail: { x: 12, y: 62, w: 264, gapX: 10, pad: 12, chip: 40, gapY: 12, fieldH: 78, actH: 40, actF: 12, mainH: 64, mainF: 20, compact: true },
  },
  'tablet-portrait': {
    s: 0.85, header: 56, px: 45, py: 44, g: 4, util: 40,
    tile: { num: 12, bulb: 14, band: 15, bandF: 9.5, badge: 16, badgeF: 10 }, tag: { h: 16, f: 10, gx: 50, gy: 22 },
    dock: { minH: 390, chip: 64, actH: 44, actF: 14, mainH: 76, mainF: 26, fieldH: 72 },
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
  const L = { bp, W, H, s: B.s, header: B.header, util: B.util, cols: COLS, rows: ROWS, dockMode };

  let stage, rail = null, dock = null, f;
  if (!dockMode) {
    const r = B.rail;
    rail = { ...r, x: r.x, y: r.y, w: r.w, h: H - r.y - r.x };
    stage = { x: r.x + r.w + r.gapX, y: r.y, w: 0, h: H - r.y - r.x };
    stage.w = W - stage.x - r.x;
    const fw = (stage.w - 24 + B.g) / (COLS * B.px);
    const fh = (stage.h - B.util - 24 + B.g) / (ROWS * B.py);
    f = Math.max(0.3, Math.min(1, fw, fh));
  } else {
    const d = B.dock;
    const fw = (W - 24 - 24 + B.g) / (COLS * B.px);
    const fh = (H - B.header - 10 - 24 - B.util - 12 - 12 - d.minH + B.g) / (ROWS * B.py);
    f = Math.max(0.3, Math.min(1, fw, fh));
    stage = { x: 12, y: B.header + 10, w: W - 24, h: 0 };
  }

  const px = B.px * f, py = B.py * f, g = Math.max(2, B.g * f);
  const tw = px - g, th = py - g;
  const trackW = COLS * px - g, trackH = ROWS * py - g;
  if (dockMode) stage.h = trackH + 24 + B.util;
  const track = {
    x: stage.x + (stage.w - trackW) / 2,
    y: stage.y + (dockMode ? 12 : Math.max(12, (stage.h - B.util - trackH) / 2)),
    w: trackW, h: trackH,
  };
  if (dockMode) {
    const y = stage.y + stage.h + 12;
    dock = { ...B.dock, x: 12, y, w: W - 24, h: H - y - 12 };
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
  Object.assign(L, { f, px, py, g, tile, tag, stage, rail, dock, track, inner, pos });
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
    '--chip': `${c.chip}px`, '--gap-y': `${c.gapY || 14}px`, '--rail-pad': `${c.pad || 16}px`, '--field-h': `${c.fieldH}px`,
    '--act-h': `${c.actH}px`, '--act-f': `${c.actF}px`, '--main-h': `${c.mainH}px`, '--main-f': `${c.mainF}px`,
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
