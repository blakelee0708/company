// 사용: node tools/shot.mjs <url> <w>x<h> <out.png> [waitExpr]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, size, out, wait = 'window.__done===true'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 300)); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url);
await p.waitForFunction(wait, null, { timeout: 120000 });
await p.waitForTimeout(500);
await p.screenshot({ path: out });
await b.close();
console.log('saved', out);
