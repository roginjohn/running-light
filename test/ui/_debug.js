// Scratch debug helper (not part of the suites).
import { startServer, launch, openGame } from './harness.js';

const { server, url } = await startServer();
const b = await launch();
const p = await openGame(b, url, { presetStorage: { 'rl.v1.settings': '{not json' } });
console.log(await p.evaluate(() => [window.__rl.app.ui.settingsReset, localStorage.getItem('rl.v1.settings'), window.__rl.game.state.phase, document.querySelector('[data-role=toast]')?.textContent]));
console.log(p.__issues);
await p.evaluate(() => localStorage.setItem('rl.v1.settings', '{not json'));
console.log(await p.evaluate(() => localStorage.getItem('rl.v1.settings')));
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => window.__rl && window.__rl.game.state.phase !== 'INIT');
console.log(await p.evaluate(() => [window.__rl.app.ui.settingsReset, localStorage.getItem('rl.v1.settings'), window.__rl.game.state.phase]));
await b.close();
server.close();
