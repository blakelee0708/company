// 처음부터 퇴근까지 한 번: node tools/flow.mjs <baseUrl> <phone|pc> <outDir> [stage]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base, kind = 'phone', out = 'docs/progress/2', upto = '9'] = process.argv.slice(2);
const UPTO = Number(upto);
mkdirSync(out, { recursive: true });
const size = kind === 'pc' ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: kind !== 'pc', isMobile: kind !== 'pc', userAgent: kind === 'pc' ? undefined : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console]', m.text().slice(0, 300)); } });
p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message, e.stack?.slice(0, 400)); });
const shot = async (n) => { await p.screenshot({ path: `${out}/${kind}-${n}.png`, timeout: 180000 }); console.log('shot', n, await p.evaluate(() => { const g = window.__game; const i = g?.stage.r.info.render; return i ? 'calls=' + i.calls + ' tris=' + i.triangles + ' fps=' + g.stage.fps.toFixed(1) : ''; })); };
const sep = base.includes('?') ? '&' : '?';
const t0 = Date.now();
await p.goto(base + sep + 'fast=1');
await p.waitForTimeout(400);
await shot('00-title');
await p.waitForSelector('.sel-pill', { timeout: 60000 });
console.log('select ready in', Date.now() - t0, 'ms');
await p.waitForTimeout(800);
await shot('00b-select-empty');
await p.click('.sel-pill >> nth=0');
await p.waitForTimeout(700);
await shot('00b-select');
await p.click('.sel .btn.on');
await p.waitForFunction(() => document.querySelector('.hud b')?.textContent === '1층 로비', null, { timeout: 90000 });
await p.waitForTimeout(1500);
console.log('lobby ready in', Date.now() - t0, 'ms');
await shot('01-lobby');
await p.evaluate(() => window.__game.debugTapWorld(-0.9, -2.7));
await p.waitForSelector('.dock .btn', { timeout: 90000 });
await p.waitForTimeout(500);
await shot('01-lobby-gate');
await p.click('.dock .btn');
await p.waitForSelector('.idcard', { timeout: 60000 });
await p.waitForTimeout(400);
await shot('01b-card-tapped');
if (UPTO < 2) { await b.close(); process.exit(0); }
await p.waitForFunction(() => document.querySelector('.hud b')?.textContent === '엘리베이터 홀', null, { timeout: 90000 });
await p.waitForTimeout(1200);
await shot('02-elevator');
await p.click('.dock .btn');
await p.waitForFunction(() => /층$/.test(document.querySelector('.hud b')?.textContent || ''), null, { timeout: 90000 });
await p.waitForTimeout(800);
await shot('03-office-intro');
await p.waitForTimeout(2600);
await shot('03-office');
// 빈자리 하나로 걸어가서 앉기
const seat = await p.evaluate(() => { const o = window.__game.office; const s = o.B.seats.filter((s) => o.occ[s.idx] === null).sort((a, b) => b.z - a.z)[0]; o.me.goTo(o.B.nav, s.x, s.z); return s.idx; });
console.log('seat', seat);
await p.waitForFunction(() => [...document.querySelectorAll('.dock .btn')].some((b) => b.textContent.includes('자리에 앉기')), null, { timeout: 90000 });
await p.waitForTimeout(300);
await shot('03-office-seat');
await p.click('.dock .btn.on');
await p.waitForSelector('.pc-win', { timeout: 60000 });
await p.waitForTimeout(600);
const todos = ['자기소개서 1번 문항 쓰기', '이력서 한 군데 넣기', '30분 산책하기'];
for (let i = 0; i < todos.length; i++) { await p.fill(`.pc-in >> nth=${i}`, todos[i]); await p.waitForTimeout(100); }
await p.waitForTimeout(300);
await shot('04-pc-todo');
// 결재 올리기 → 상신
await p.click('.pc-b >> text=결재 올리기');
await p.waitForTimeout(300);
await shot('04b-approval-form');
await p.click('.pc-b.on >> text=상신');
await p.waitForTimeout(300);
// 완료 하나
await p.click('.pc-todo >> nth=2 >> .pc-b.on');
await p.waitForTimeout(300);
await shot('04c-pc-states');
if (UPTO >= 3) {
  await p.waitForSelector('.dialog', { timeout: 240000 });
  await p.waitForTimeout(1500);
  await shot('05-dialog');
  await p.click('.dialog .btn >> nth=0', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(2500);
  // 결재 도장 두 개 기다림
  await p.waitForFunction(() => window.__game.s.todos[0].state === 'approved' || document.querySelector('.dialog'), null, { timeout: 240000 }).catch(() => console.log('approval wait timeout'));
  for (let k = 0; k < 6; k++) { if (await p.$('.dialog')) { await p.waitForTimeout(800); await p.click('.dialog .btn >> nth=0', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(2200); } const st = await p.evaluate(() => window.__game.s.todos[0].state); if (st === 'approved') break; await p.waitForTimeout(2000); }
  console.log('todo0 state', await p.evaluate(() => window.__game.s.todos[0].state), 'stamps', await p.evaluate(() => window.__game.s.todos[0].stamps));
  await p.click('.pc-mi >> text=결재함').catch(() => {});
  await p.waitForTimeout(400);
  await shot('04d-approvals');
}
if (UPTO >= 4) {
  // 일어나서 탕비실 → 커피
  await p.evaluate(() => { document.querySelectorAll('.dialog').forEach((e) => e.remove()); window.__game.office.standUp(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const o = window.__game.office; const P = o.B.pantry.spots.coffee; o.me.goTo(o.B.nav, P.x, P.z); });
  await p.waitForFunction(() => [...document.querySelectorAll('.dock .btn')].some((b) => b.textContent.includes('커피')), null, { timeout: 240000 }).catch(() => console.log('no coffee btn'));
  await p.waitForTimeout(400);
  await shot('06-pantry');
  const coffeeBtn = await p.$('.dock .btn >> text=커피 마시기');
  if (coffeeBtn) {
    for (const name of ['아메리카노', '믹스커피', '라떼', '녹차']) {
      await p.click('.dock .btn >> text=커피 마시기').catch(() => {});
      await p.waitForTimeout(300);
      if (name === '아메리카노') await shot('06b-coffee-menu');
      await p.click(`.dock .btn >> text=${name}`);
      await p.waitForTimeout(4800);
      await p.evaluate(() => document.querySelectorAll('.dialog').forEach((e) => e.remove()));
    }
    console.log('coffee', await p.evaluate(() => window.__game.s.coffee));
    await shot('06c-coffee');
  }
}
// 게시판
await p.evaluate(() => window.__game.office.openBoard());
await p.waitForTimeout(500);
await shot('07-board');
await p.click('.board-wrap .dock .btn');
await p.fill('.bw-in', '오늘 면접 봤어요');
await p.click('.bw .btn.on');
await p.waitForTimeout(400);
await p.click('.board-wrap .x-close');
// 퇴근
await p.evaluate(() => { document.querySelectorAll('.dialog').forEach((e) => e.remove()); window.__game.s.startAt -= 154 * 60000; });
await p.click('.chip.w');
await p.waitForSelector('.confirm', { timeout: 5000 });
await shot('08a-confirm');
await p.click('.confirm .btn.dk');
await p.waitForSelector('.ps-card', { timeout: 60000 });
await p.waitForTimeout(900);
await shot('08-payslip');
console.log('pay text', await p.$eval('.ps-pay', (e) => e.textContent));
console.log('errors', errs.length);
await b.close();
