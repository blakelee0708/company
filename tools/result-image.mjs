// 결과 이미지(9:16)만 만들어 파일로: node tools/result-image.mjs <url> <out.png>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0' });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url);
await p.waitForSelector('.sel-pill', { timeout: 90000 });
await p.evaluate(() => window.__game.debugEnter('f'));
await p.waitForFunction(() => window.__game.office?.mode === 'walk', null, { timeout: 120000 });
await p.evaluate(() => { const s = window.__game.s; s.startAt -= 154 * 60000; s.todos[0].text = '자기소개서 1번 문항 쓰기'; s.todos[0].state = 'approved'; s.todos[0].done = true; s.todos[1].text = '이력서 한 군데 넣기'; s.todos[1].state = 'approved'; s.todos[2].text = '30분 산책하기'; s.todos[2].state = 'written'; s.todos[2].done = true; s.coffee = 2; s.praise = 5; });
await p.evaluate(() => window.__game.leave(true));
await p.waitForSelector('.ps-card', { timeout: 120000 });
await p.waitForTimeout(800);
// 앱 안 브라우저: 길게 눌러 저장 화면
await p.click('.ps-dock .btn >> text=결과 이미지 저장');
await p.waitForSelector('.veil img', { timeout: 60000 });
await p.waitForTimeout(500);
await p.screenshot({ path: out.replace('.png', '-longpress.png'), timeout: 120000 });
const data = await p.$eval('.veil img', (i) => i.src);
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log('saved', out);
await b.close();
