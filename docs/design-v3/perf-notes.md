# Running Light v3: performance notes for the build

Goal: a light, flat UI that holds 60 fps on desktop and ≥55 fps on a mid-range phone during the light run. The v3 look is simpler than v2 (no bulbs, glows or textures), so it should be cheaper. Keep it that way.

## Do
- **DOM + CSS, no canvas/WebGL.** It is about 50 tiles plus maybe 40 other elements. Position the tiles absolutely from the pitch formula in `tokens.md §4`, and recompute only on resize (debounced via `ResizeObserver`).
- **Light run = class swaps on at most 4 tiles per step** (new lit, three trail steps). The trail is one overlay child per tile animated by `opacity` only. Never touch layout properties (`left/top/width/height`, borders, padding, font-size) per frame.
- Drive the run with **one `requestAnimationFrame` loop** that reads the precomputed step schedule (the outcome is already decided and saved). No `setInterval`, and no per-step `setTimeout` chains.
- Update the big mono number with `textContent` on a fixed-width element (mono + tabular-nums, so no reflow of neighbours). At most once per light step.
- **Gamble flip:** one element with two faces, `transform: rotateY()` and `backface-visibility: hidden`, 700 ms. The static mockup shows the mid-flip frame as `scaleX`.
- Dialog in/out: `opacity` + small `translateY` only. The scrim is a flat rgba fill.
- Put `will-change: transform` only on the flip disc and only while it flips. Do **not** apply `will-change` to all tiles.
- Use `contain: layout paint` on `.track` and `.rail` so that changes inside them do not invalidate the page.
- Fonts: self-host **Poppins 600/700** and **JetBrains Mono 600** as WOFF2, Latin subset (≈ 3 files, < 80 KB total). Use `font-display: swap`, preload the two Poppins files, and have no runtime font requests to third parties.
- Icons: inline SVG with `currentColor` (8 icons, < 3 KB total). Chips are pure CSS (`repeating-conic-gradient` + one pseudo-element), with no images.
- Respect `prefers-reduced-motion`: a short run, no rotation, crossfades only.
- Keep the engine untouched. The UI reads state and renders.

## Don't
- No `box-shadow` glows, `filter: blur/drop-shadow`, `backdrop-filter`, gradients on large areas, confetti, particles or canvas effects.
- Don't animate `background-color`, `box-shadow`, `width`, `height`, `top/left` or `font-size`. Swap classes instead (instant) or fade an overlay's opacity.
- Don't re-render the whole track per step (no `innerHTML` of the ring in the loop). Don't rebuild the rail on every state change: toggle classes and update text.
- Don't load images for tiles, chips, discs or the mark. No sprite sheets, no video, no Lottie.
- No network requests at runtime (no analytics, CDN fonts or remote icons).
- No layout thrash: never read `getBoundingClientRect`/`offsetWidth` inside the run loop.
- No third-party UI frameworks just for this screen. Vanilla JS + CSS is enough.

## Budgets (suggested acceptance checks)
| Item | Budget |
|---|---|
| JS (UI layer, gzipped, excluding the existing engine) | ≤ 25 KB |
| CSS (gzipped) | ≤ 8 KB |
| Fonts | ≤ 80 KB, 3 WOFF2 files |
| DOM nodes on the main screen | ≤ 400 |
| Elements changed per light step | ≤ 5 |
| Light run frame time (desktop / 4× CPU throttle) | < 8 ms / < 16 ms, no long tasks > 50 ms |
| First render (cached, local) | < 300 ms to interactive betting |

## Mockup tooling
`_render/` is throwaway (HTML + headless Chrome via puppeteer-core). `node _render/render.js` regenerates every PNG and writes `_render/check-report.json` (clipped, covered, overflowing and overlapping text). It is **not** production code and must not be copied into `game/`.
