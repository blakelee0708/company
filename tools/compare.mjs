// 시안과 캡처를 나란히: node tools/compare.mjs <mockup.png> <mine.png> <out.png> [height]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [a, b, out, hh = '760'] = process.argv.slice(2);
const H = Number(hh);
const d = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const html = `<body style="margin:0;background:#2a2f3a;font:700 16px sans-serif;color:#fff;display:flex;gap:16px;padding:16px;width:max-content">
<div><div style="margin-bottom:6px">시안 (docs/mockups)</div><img src="${d(a)}" style="height:${H}px"></div>
<div><div style="margin-bottom:6px">구현 (캡처)</div><img src="${d(b)}" style="height:${H}px"></div></body>`;
const br = await chromium.launch();
const p = await br.newPage({ viewport: { width: 400, height: H + 60 } });
await p.setContent(html);
await p.waitForTimeout(200);
await p.screenshot({ path: out, fullPage: true });
await br.close();
console.log('saved', out);
