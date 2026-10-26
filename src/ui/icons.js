// v2 icons, chips, star and logo mark: the exported SVGs from design/redesign-v2/assets (copied to src/assets/v2),
// inlined at build time (no runtime requests). Icons are recoloured to `currentColor`.
const raw = import.meta.glob('../assets/v2/{icons,chips,ui}/*.svg', { query: '?raw', import: 'default', eager: true });

const byName = {};
for (const [p, svg] of Object.entries(raw)) byName[p.split('/').pop().replace('.svg', '')] = svg;

const cc = (svg) => svg.replace(/#F6F2FF/gi, 'currentColor').replace(/fill="#241400"/i, 'fill="currentColor"');

/** Inline icon markup: <span class="ic">svg</span>. */
export function icon(name, cls = '') {
  const svg = byName[`icon-${name}`];
  if (!svg) throw new Error(`unknown icon ${name}`);
  return `<span class="ic${cls ? ` ${cls}` : ''}" aria-hidden="true">${cc(svg)}</span>`;
}
export const star = () => `<span class="ic" aria-hidden="true">${cc(byName['star-1920'])}</span>`;
export const logoMark = () => byName['logo-mark'].replace('<svg ', '<svg class="mark" aria-hidden="true" ');
export const chipSvg = (v) => byName[`chip-${v}`].replace('<svg ', '<svg aria-hidden="true" ');
