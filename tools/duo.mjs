// 두 기기 같이 출근 시험: node tools/duo.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base = 'http://127.0.0.1:8787/', out = 'docs/progress/5'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const mk = async (name) => { const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}]`, m.text().slice(0, 200)); }); await p.goto(base + '?fast=1'); await p.waitForSelector('.sel-pill', { timeout: 90000 }); return p; };
const A = await mk('A'), B = await mk('B');
await B.evaluate(() => { window.__askMs = 300000; });
await A.evaluate(() => window.__game.debugEnter('m'));
await A.waitForTimeout(2000);
await B.evaluate(() => window.__game.debugEnter('f'));
const st = (p) => p.evaluate(() => { const g = window.__game; const o = g.office; return { dept: g.s.dept, live: g.net?.live, id: g.net?.id, peers: o ? [...o.peers.keys()] : [], hud: document.querySelector('.hud span')?.textContent }; });
await A.waitForFunction(() => window.__game.office?.peers.size === 1, null, { timeout: 120000 });
await B.waitForFunction(() => window.__game.office?.peers.size === 1, null, { timeout: 120000 });
console.log('A', JSON.stringify(await st(A)));
console.log('B', JSON.stringify(await st(B)));
// 둘을 가까이 세움(사무실 문 앞)
await A.evaluate(() => { const o = window.__game.office; o.mode = 'walk'; o.me.place(-1.0, 8.0, Math.PI); });
await B.evaluate(() => { const o = window.__game.office; o.mode = 'walk'; o.me.place(1.0, 8.0, Math.PI); });
await A.waitForTimeout(6000);
await A.screenshot({ path: `${out}/duo-A-sees-B.png`, timeout: 180000 });
await B.screenshot({ path: `${out}/duo-B-sees-A.png`, timeout: 180000 });
// 1) 인사 → B 토스트
const bid = await B.evaluate(() => window.__game.net.id);
await A.evaluate((id) => { const o = window.__game.office; o.bowTo(o.peers.get(id)); }, bid);
await B.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('인사했어요')), null, { timeout: 30000 });
console.log('bow toast ok');
// 2) 탕비실 같이 가요 → 다음에요(거절)
await A.evaluate((id) => { const o = window.__game.office; o.invite(o.peers.get(id)); }, bid);
await B.waitForSelector('.ask', { timeout: 30000 });
await B.screenshot({ path: `${out}/duo-B-ask.png`, timeout: 180000 });
await B.click('.ask .btn >> text=다음에요');
await A.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('다음에')), null, { timeout: 30000 });
console.log('decline ok');
// 3) 다시 → 같이 가요(수락) → 둘 다 탕비실로
await A.waitForTimeout(1000);
await A.evaluate((id) => { const o = window.__game.office; o.invite(o.peers.get(id)); }, bid);
await B.waitForSelector('.ask', { timeout: 30000 });
await B.click('.ask .btn >> text=같이 가요');
await A.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('같이 가요')), null, { timeout: 30000 });
console.log('accept ok');
await A.waitForFunction(() => window.__game.office.inPantry, null, { timeout: 240000 });
await B.waitForFunction(() => window.__game.office.me.pos.x > 8.5, null, { timeout: 240000 });
console.log('both in pantry', JSON.stringify(await A.evaluate(() => { const o = window.__game.office; return [o.me.pos.x.toFixed(1), o.me.pos.z.toFixed(1)]; })), JSON.stringify(await B.evaluate(() => { const o = window.__game.office; return [o.me.pos.x.toFixed(1), o.me.pos.z.toFixed(1)]; })));
await A.waitForTimeout(3000);
await A.screenshot({ path: `${out}/duo-pantry-A.png`, timeout: 180000 });
// 4) 게시판: A가 쓰면 B에게 보임, 걸러내기
await A.evaluate(() => window.__game.net.board.post('오늘 면접 봤어요'));
await B.waitForFunction(() => window.__game.net.board.list.some((n) => n.text === '오늘 면접 봤어요'), null, { timeout: 30000 });
console.log('board shared ok');
await A.evaluate(() => window.__game.net.send({ t: 'note', text: 'tlqkf' }));
await A.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('올릴 수 없어요')), null, { timeout: 30000 });
console.log('server filter ok');
await b.close();
