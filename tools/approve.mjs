// 결재 도장 두 개 확인: node tools/approve.mjs <url> <out.png>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url + '?fast=1');
await p.waitForSelector('.sel-pill', { timeout: 90000 });
await p.evaluate(() => window.__game.debugEnter('m'));
await p.waitForFunction(() => window.__game.office?.mode === 'walk', null, { timeout: 120000 });
await p.evaluate(() => { const o = window.__game.office; const s = o.B.seats.find((x) => o.occ[x.idx] === null && x.team === 2) ?? o.B.seats.find((x) => o.occ[x.idx] === null); o.me.place(s.x, s.z); o.sit(s); });
await p.waitForSelector('.pc-win', { timeout: 120000 });
await p.fill('.pc-in >> nth=0', '자기소개서 1번 문항 쓰기');
await p.click('.pc-b >> text=결재 올리기'); await p.click('.pc-b.on >> text=상신');
const t0 = Date.now();
while (Date.now() - t0 < 900000) {
  const st = await p.evaluate(() => ({ s: window.__game.s.todos[0].state, n: window.__game.s.todos[0].stamps }));
  if (st.s === 'approved') break;
  if (await p.$('.dialog .btn')) await p.click('.dialog .btn >> nth=0', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(3000);
}
const st = await p.evaluate(() => ({ s: window.__game.s.todos[0].state, n: window.__game.s.todos[0].stamps, praise: window.__game.s.praise }));
console.log('final', JSON.stringify(st), 'sec', (Date.now() - t0) / 1000);
await p.waitForTimeout(4000);
await p.evaluate(() => { document.querySelectorAll('.dialog').forEach((e) => e.remove()); });
await p.click('.pc-mi >> text=결재함');
await p.waitForTimeout(600);
await p.screenshot({ path: out, timeout: 120000 });
await b.close();
