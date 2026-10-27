#!/usr/bin/env node
// Build + unit tests + UI tests + screenshots, saving every output in test-results/.
// The long simulation is separate: npm run sim (writes test-results/simulation.{md,json}).
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../test-results/v3/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const steps = [
  ['tokens-output.txt', ['scripts/gen-tokens.js']],
  ['build-output.txt', ['node_modules/vite/bin/vite.js', 'build']],
  ['unit-tests.txt', ['--test', '--test-reporter=spec', 'test/unit/']],
  ['ui-tests.txt', ['--test', '--test-concurrency=1', '--test-reporter=spec', 'test/ui/ui.test.js']],
  ['screenshots-output.txt', ['test/ui/screenshots-v3.js', '--out', 'test-results/v3/screenshots']],
];
let failed = 0;
for (const [file, args] of steps) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', timeout: 900000 });
  const text = `$ node ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}\n[exit ${r.status}, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${new Date().toISOString()}]\n`;
  writeFileSync(OUT + file, text);
  console.log(`${file}: exit ${r.status}`);
  console.log(text.split('\n').filter((l) => /^(ℹ (tests|pass|fail)|✓ built|E2|console\/network|captured \d|tokens)/.test(l)).join('\n'));
  if (r.status !== 0) failed++;
}
process.exitCode = failed ? 1 : 0;
