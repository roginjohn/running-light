// v5 math design mock: in-memory patches for the built v3 bundle (docs only, nothing in src/ changes).
// render.mjs serves the real build from /tmp/rl-v5-build and applies these patches to the JS on the way out, so
// the real engine and view draw the v5 board, limits, toasts, paytable and gamble cap. Every patch must match the
// expected number of times; a miss throws, so a changed build fails instead of quietly showing v3 numbers.
// Numbers: math-v5/MATH-SPEC.md section 3 (Option A), section 5 (limits, gamble cap), section 7 (decisions).

export const V5 = {
  TIERS: [5, 10, 20, 50, 100, 200],
  WEIGHT_BY_TIER: { 5: 1493, 10: 743, 20: 371, 50: 148, 100: 74, 200: 37 },
  COUNT_BY_TIER: { 5: 1, 10: 3, 20: 4, 50: 6, 100: 18, 200: 18 },
  SQUARES_BY_TIER: {
    200: [3, 6, 9, 12, 15, 17, 20, 23, 25, 28, 31, 34, 37, 40, 42, 45, 48, 50],
    100: [1, 4, 7, 10, 13, 16, 19, 22, 24, 26, 29, 32, 35, 38, 41, 44, 47, 49],
    50: [5, 11, 18, 30, 36, 43],
    20: [2, 14, 27, 39],
    10: [21, 33, 46],
    5: [8],
  },
  TOTAL_WEIGHT: 8092,
  CHIPS: [1, 5, 10, 25, 50, 100, 500],
  MAX_PER_SQUARE: 1000,
  MAX_PER_ROUND: 1000,
  START_CREDITS: 10000,
  REFILL_AMOUNT: 10000,
  GAMBLE_CAP: 300000,
  RTP: '95.39%', // full-board exact 95.389% (spec section 3)
  // hit chance per round incl. Double Run, "1 in N" (spec section 3 table, Option A)
  HIT_ONE_IN: { 5: '5.24', 10: '10.48', 20: '20.94', 50: '52.44', 100: '104.85', 200: '209.66' },
};

const J = JSON.stringify;
const obj = (o) => J(o).replace(/"(\d+)":/g, '$1:'); // {"5":1} -> {5:1}, as the minifier writes it
const arrangement = () => {
  const a = {};
  for (const [t, sq] of Object.entries(V5.SQUARES_BY_TIER)) for (const n of sq) a[n] = `${t}x`;
  return obj(Object.fromEntries(Object.keys(a).sort((x, y) => x - y).map((k) => [k, a[k]])));
};
const loc = (e) => `(${e}).toLocaleString("en-US")`;

/** [description, pattern (string or RegExp with /g), replacement, expected match count] */
export const PATCHES = [
  // ---- engine config (src/engine/config.js)
  ['TIERS', '[24,96,480,960,1920]', J(V5.TIERS), 1],
  ['WEIGHT_BY_TIER', 'Object.freeze({24:80,96:20,480:4,960:2,1920:1})', `Object.freeze(${obj(V5.WEIGHT_BY_TIER)})`, 1],
  ['COUNT_BY_TIER', 'Object.freeze({24:21,96:19,480:7,960:2,1920:1})', `Object.freeze(${obj(V5.COUNT_BY_TIER)})`, 1],
  ['SQUARES_BY_TIER', /Object\.freeze\(\{1920:\[8\],960:\[[\d,]+\],480:\[[\d,]+\],96:\[[\d,]+\],24:\[[\d,]+\]\}\)/g, `Object.freeze(${obj(V5.SQUARES_BY_TIER)})`, 1],
  ['assert counts', '{24:0,96:0,480:0,960:0,1920:0}', obj(Object.fromEntries(V5.TIERS.map((t) => [t, 0]))), 1],
  ['assert total weight', '!==2093', `!==${V5.TOTAL_WEIGHT}`, 2],
  ['CHIPS', 'Object.freeze([1,5,10,25,50])', `Object.freeze(${J(V5.CHIPS)})`, 1],
  // MIN_BET=1, MAX_PER_SQUARE=10, MAX_PER_ROUND=200, MIN_BET=1, START=1e3, REFILL=1e3, MAX_GAMBLES=3, GAMBLE_CAP=3e4
  ['limits, credits, gamble cap', /([\w$]+)=1,([\w$]+)=10,([\w$]+)=200,([\w$]+)=1,([\w$]+)=1e3,([\w$]+)=1e3,([\w$]+)=3,([\w$]+)=3e4,/g,
    `$1=1,$2=${V5.MAX_PER_SQUARE},$3=${V5.MAX_PER_ROUND},$4=1,$5=${V5.START_CREDITS},$6=${V5.REFILL_AMOUNT},$7=3,$8=${V5.GAMBLE_CAP},`, 1],
  ['TOASTS.square', 'Max bet reached – 10 per square', 'Max bet reached – 1,000 per square', 1],
  ['TOASTS.round', 'Round limit reached – 200 per round', 'Round limit reached – 1,000 per round', 1],
  // ---- design tokens (board-arrangement, checked at boot against config)
  ['tokens board-arrangement', /"board-arrangement":\{1:"24x"[^}]*\}/g, `"board-arrangement":${arrangement()}`, 1],
  // ---- UI copy (src/ui/view.js, app.js, keys.js)
  // the rail is 198 px inside: "1–1,000 per square · 1,000 per round" (215 px) was cut with an ellipsis, so the hint
  // breaks at the "·" onto two lines in both states (v5-override.css .hint b)
  ['bet hint (fmt the limits)', /\$\{([\w$]+)\}–\$\{([\w$]+)\} per square · \$\{([\w$]+)\} per round/g, (m, a, b, c) => `\${${a}}–\${${loc(b)}} per square<b> · </b>\${${loc(c)}} per round`, 1],
  ['bet hint while betting', / · \$\{([\w$]+)\(([\w$]+)\.total\)\} \/ \$\{([\w$]+)\} per round`/g, (m, f, t, a) => `<b> · </b>\${${f}(${t}.total)} / \${${loc(a)}} per round\``, 1],
  ['help: place bets', /up to \$\{([\w$]+)\} per square and \$\{([\w$]+)\} per round/g, (m, a, b) => `up to \${${loc(a)}} per square and \${${loc(b)}} per round`, 1],
  ['paytable limits', /\$\{([\w$]+)\}–\$\{([\w$]+)\} per square, \$\{([\w$]+)\} per round\./g, (m, a, b, c) => `\${${a}}–\${${loc(b)}} per square, \${${loc(c)}} per round.`, 1],
  ['bet badge on a square', /<span class="bet">\$\{([\w$]+)\}<\/span>/g, (m, a) => `<span class="bet">\${${loc(a)}}</span>`, 1],
  ['bet ghost badge', /<span class="bet ghost">\$\{([\w$]+)\}<\/span>/g, (m, a) => `<span class="bet ghost">\${${loc(a)}}</span>`, 1],
  ['tooltip bet / max', /Your bet: \$\{([\w$]+)\} \/ 10</g, (m, a) => `Your bet: \${${loc(a)}} / ${V5.MAX_PER_SQUARE.toLocaleString('en-US')}<`, 1],
  // one-in-N hit chance: the spec's 2-decimal values (computed live by the patched engine; render.mjs cross-checks)
  ['ODDS 2 decimals', /`1 in \$\{([\w$]+)\(Math\.round\(1\/([\w$]+)\(e\)\)\)\}`/g, (m, f, p) => `\`1 in \${(1/${p}(e)).toFixed(2)}\``, 1],
  ['paytable example', 'A bet of 5 on a 96x square returns 480.', 'A bet of 5 on a 20x square returns 100.', 1],
  ['paytable RTP', 'RTP ≈95.45%:</b> the theoretical long-run average return', `Payback (RTP) ≈${V5.RTP}:</b> the theoretical long-run average return`, 1],
  ['help RTP', 'RTP about 95.45%.', `RTP about ${V5.RTP}.`, 1],
  // gamble offer when the cap blocks it: say why, with the numbers (was "Gamble is off above 300,000 credits.")
  ['offer sub when capped', /`Collect it\. Gamble is off above \$\{([\w$]+)\(([\w$]+)\)\} credits\.`/g,
    (m, f, cap) => `\`Doubling \${${f}(s.currentWin)} would go over the \${${f}(${cap})} cap, so Gamble is off. Collect it.\``, 1],
  // rail button sub-lines are 198 px: "Doubling would go over the 300,000 cap" (230 px) spilled out of Gamble ×2, so the
  // button says it short; the full sentence stays in the centre sub, the navy band and the button's title
  ['gamble button sub (offer)', /<span class="sub">\$\{([\w$]+)\?([\w$]+)\(([\w$]+)\):`Fair 50\/50/g,
    (m, w, e, p) => `<span class="sub">\${${w}?(${w}==="cap"?"Over the ${V5.GAMBLE_CAP.toLocaleString('en-US')} cap":${e}(${p})):\`Fair 50/50`, 1],
  ['gamble button sub (in gamble)', /Gamble ×2<\/span><span class="sub">\$\{([\w$]+)\(([\w$]+)\(([\w$]+)\)\)\}/g,
    (m, e, j, w) => `Gamble ×2</span><span class="sub">\${${w}==="cap"?"Over the ${V5.GAMBLE_CAP.toLocaleString('en-US')} cap":${e}(${j}(${w}))}`, 1],
  // "1,000 credits on 50 squares · Space" (226 px) spilled out of Start: drop "credits" (the rail head says Credits)
  ['start button sub', /<span class="sub">\$\{([\w$]+)\(([\w$]+)\.total\)\} credits on /g, (m, f, n) => `<span class="sub">\${${f}(${n}.total)} on `, 1],
  ['result card bet', /\$\{([\w$]+)\?`\$\{([\w$]+)\} × \$\{/g, (m, c, b) => `\${${c}?\`\${${loc(b)}} × \${`, 1],
  ['keys table chips', '["1–5","Chip"]', '["1–7","Chip"]', 1],
  ['keys 6 and 7 pick a chip', /\/\^\[1-5\]\$\/\.test\(s\)&&!e\.ctrlKey\)return\{kind:"dispatch",action:\{type:"SELECT_CHIP",value:\[1,5,10,25,50\]/g,
    `/^[1-7]$/.test(s)&&!e.ctrlKey)return{kind:"dispatch",action:{type:"SELECT_CHIP",value:${J(V5.CHIPS)}`, 1],
  ['rail footer refill', 'Free refill to 1,000 whenever you run out.', 'Free refill to 10,000 whenever you run out.', 1],
  ['refill announce', 'Refilled: 1,000 play credits.', 'Refilled: 10,000 play credits.', 1],
  ['refill count-up', /([\w$]+)\.displayBalance=Math\.round\(1e3\*r\)/g, (m, a) => `${a}.displayBalance=Math.round(${V5.REFILL_AMOUNT}*r)`, 1],
];

/** Apply PATCHES to the bundle source. Throws on any count mismatch. */
export function patchBundle(src) {
  const report = [];
  for (const [name, pat, rep, want] of PATCHES) {
    const re = typeof pat === 'string' ? new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : pat;
    const n = (src.match(re) || []).length;
    if (n !== want) throw new Error(`v5 patch "${name}": ${n} matches, expected ${want}`);
    // literal patterns get a literal replacement (no $-expansion); RegExp patterns may use $1.. back-references
    src = src.replace(re, typeof rep === 'function' || typeof pat !== 'string' ? rep : () => rep);
    report.push(`${name}: ${n}`);
  }
  return { src, report };
}
