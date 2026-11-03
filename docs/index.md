# Documentation index

Every Markdown document in the repo (outside `node_modules/` and `dist/`). Links are relative to this file.

## Project

- [README](../README.md): what the game is, setup and run commands, fonts, tokens, supported screens, folder map.
- [CONTRIBUTING](../CONTRIBUTING.md): branch workflow, the locked engine, checks for every batch, how to publish.
- [CHANGELOG](../CHANGELOG.md): v2 baseline, v3 batches 1–7 and maintenance releases, newest first.

## v3 redesign (design-v3)

- [Design tokens](design-v3/tokens.md): the v3 colour, contrast, type, spacing, layout and motion tokens explained (source: `design-v3/tokens.json`).
- [Open questions](design-v3/open-questions.md): interpretations and undecided points from the v3 design session (bet field, phone layout, etc.).
- [Performance notes](design-v3/perf-notes.md): do/don't rules for keeping the flat UI at 60 fps.

### Batch notes

- [Batch 1: design tokens and fonts](design-v3/batch-1/NOTES.md): v3 token file, `gen-tokens.js`, Poppins and JetBrains Mono.
- [Batch 2: page frame and bottom bar](design-v3/batch-2/NOTES.md): centred frame, 230 px rail, bottom bar, z-index.
- [Batch 3: left panel controls](design-v3/batch-3/NOTES.md): flat rail controls, bet field with 1/2 and x2, Last bets.
- [Batch 4: track and centre display](design-v3/batch-4/NOTES.md): flat squares, pitch formula, class-only running light, big multiplier number.
- [Batch 5: result states](design-v3/batch-5/NOTES.md): win, loss, Double Run and the in-centre gamble flip.
- [Batch 6: overlays and small screens](design-v3/batch-6/NOTES.md): Game info, refill, error, start and loading screens, tablet layouts.
- [Batch 7: performance and cleanup](design-v3/batch-7/NOTES.md): staged result renders, type warm-up, credits count-up, dead v2 assets removed.

## Implementation records

- [Implementation report](IMPLEMENTATION-REPORT.md): the original (v1, Development Session Two) build report: decisions, tests, simulation, file list.
- [Audio record](AUDIO.md): every procedural Web Audio sound and how it is made.
- [Development specification](development-spec.md): the Stage Seven spec the first build was written against.

## Earlier sessions (copied notes)

- [Game design specification](spec/game-design-spec.md): Stage Three game rules, limits and credits.
- [Math results](math/results.md): paytable, Double Run and gamble analytics and Monte Carlo results (model in `math/model.py`).
- [Design brief](design/design-brief.md): Session One design-only brief.
- [Design decisions, revision 1](design/design-decisions-r1.md): decisions approved after the first design round.
