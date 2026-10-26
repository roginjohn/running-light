// Quick visual smoke check: node test/ui/smoke.js <out.png>
import { startServer, launch, openGame } from './harness.js';

const out = process.argv[2] || '/tmp/rl-smoke.png';
const { server, url } = await startServer();
const browser = await launch();
const page = await browser.newPage();
const issues = [];
page.on('console', (m) => issues.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
try {
  await openGame(browser, url, { seed: 3 }, page);
} catch (e) {
  console.log('open failed', e.message);
}
await page.screenshot({ path: out });
console.log(issues.join('\n'));
await browser.close();
server.close();
