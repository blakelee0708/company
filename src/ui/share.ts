// 결과 이미지(9:16) 만들기와 저장: 일반 브라우저는 내려받기, 아이폰과 앱 안 브라우저는 길게 눌러 저장
import type * as THREE from 'three';
import type { SlipData } from './payslip';
import { won, UNIT_PAY } from '../shared/pay';
import { portrait } from '../character/portrait';
import type { Look } from '../character/worker';
import { h, $ui, toast } from './dom';

const F = 'P, Pretendard, "Apple SD Gothic Neo", sans-serif';
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number): void { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fit(c: CanvasRenderingContext2D, t: string, max: number): string { if (c.measureText(t).width <= max) return t; let s = t; while (s.length && c.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }

export async function makeResultImage(d: SlipData, r: THREE.WebGLRenderer, look: Look): Promise<HTMLCanvasElement> {
  await document.fonts?.load?.(`800 40px P`).catch(() => undefined);
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2547'); g.addColorStop(1, '#0e1428'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const X = 70, Y = 150, CW = W - 140, CH = 1560;
  c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, X, Y + 24, CW, CH, 48); c.fill();
  c.fillStyle = '#fbfaf6'; rr(c, X, Y, CW, CH, 48); c.fill();
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#1d2b4f'; c.font = `800 54px ${F}`; c.fillText('∞', X + 56, Y + 110);
  c.font = `700 36px ${F}`; c.fillText('(주)무한채용 · 오늘의 급여 명세서', X + 126, Y + 104);
  c.fillStyle = '#7a8090'; c.font = `500 30px ${F}`; c.fillText(d.date, X + 56, Y + 160);
  c.fillStyle = '#3a4152'; c.font = `600 34px ${F}`; c.fillText(fit(c, d.who, 560), X + 56, Y + 206);
  // 도장
  c.save(); c.translate(X + CW - 130, Y + 130); c.rotate(-0.24); c.strokeStyle = '#d23b3b'; c.lineWidth = 7; c.globalAlpha = 0.9; c.beginPath(); c.arc(0, 0, 92, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#d23b3b'; c.font = `800 32px ${F}`; c.textAlign = 'center'; c.fillText('오늘도', 0, -24); c.fillText('출근', 0, 14); c.fillText('완료', 0, 52); c.restore();
  // 얼굴
  try { const img = new Image(); img.src = portrait(r, look, 120, 120, true, 0xeaf5ff); await img.decode(); c.save(); rr(c, X + CW - 330, Y + 60, 130, 130, 26); c.clip(); c.drawImage(img, X + CW - 330, Y + 60, 130, 130); c.restore(); } catch { /* 얼굴 없이 */ }
  const dash = (y: number): void => { c.strokeStyle = '#cfd3dc'; c.setLineDash([10, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(X + 56, y); c.lineTo(X + CW - 56, y); c.stroke(); c.setLineDash([]); };
  dash(Y + 270);
  c.fillStyle = '#4a5164'; c.font = `600 34px ${F}`; c.textAlign = 'left'; c.fillText('근무 시간', X + 56, Y + 340); c.textAlign = 'right'; c.fillText(d.hours, X + CW - 56, Y + 340);
  c.textAlign = 'center'; c.fillStyle = '#7a8090'; c.font = `500 32px ${F}`; c.fillText('오늘 번 돈', W / 2, Y + 430);
  c.font = `800 130px ${F}`; const pw = c.measureText(won(d.pay)).width; c.font = `700 54px ${F}`; const uw = c.measureText(' 원').width;
  c.textAlign = 'left'; c.fillStyle = '#d2462f'; c.font = `800 130px ${F}`; c.fillText(won(d.pay), W / 2 - (pw + uw) / 2, Y + 560); c.fillStyle = '#1d2433'; c.font = `700 54px ${F}`; c.fillText(' 원', W / 2 - (pw + uw) / 2 + pw, Y + 560);
  c.textAlign = 'center'; c.fillStyle = '#8a90a0'; c.font = `500 30px ${F}`; c.fillText(`시급 10,700원 기준 · 30분 단위 (${d.units} × ${won(UNIT_PAY)}원)`, W / 2, Y + 615);
  dash(Y + 670);
  c.textAlign = 'left'; c.fillStyle = '#1d2433'; c.font = `700 34px ${F}`; c.fillText('오늘 한 일', X + 56, Y + 735);
  let y = Y + 795;
  const todos = d.todos.length ? d.todos : [{ text: '출근한 것만으로 충분해요', mark: '' }];
  for (const t of todos.slice(0, 4)) {
    c.fillStyle = '#1d2433'; c.font = `500 34px ${F}`; c.textAlign = 'left'; c.fillText(fit(c, '✔ ' + t.text, CW - 330), X + 56, y);
    c.fillStyle = '#d23b3b'; c.font = `700 30px ${F}`; c.textAlign = 'right'; c.fillText(t.mark, X + CW - 56, y);
    y += 62;
  }
  y = Math.max(y, Y + 1060);
  const bw = (CW - 112 - 40) / 3;
  ([['마신 커피', d.coffee + '잔'], ['같이 일한 사람', d.people + '명'], ['받은 칭찬', d.praise + '번']] as const).forEach(([k, v], i) => {
    const bx = X + 56 + i * (bw + 20); c.fillStyle = '#eef1f6'; rr(c, bx, y, bw, 150, 26); c.fill();
    c.textAlign = 'center'; c.fillStyle = '#6a7080'; c.font = `500 28px ${F}`; c.fillText(k, bx + bw / 2, y + 56); c.fillStyle = '#1d2433'; c.font = `800 46px ${F}`; c.fillText(v, bx + bw / 2, y + 116);
  });
  y += 190;
  c.fillStyle = '#fff3e2'; rr(c, X + 56, y, CW - 112, 230, 30); c.fill();
  c.fillStyle = '#c07a2a'; c.font = `600 28px ${F}`; c.textAlign = 'center'; c.fillText('오늘의 한마디', W / 2, y + 60);
  c.fillStyle = '#1d2433'; c.font = `700 42px ${F}`;
  const words = d.quote.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > CW - 200 && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  lines.slice(0, 2).forEach((l, i) => c.fillText(l, W / 2, y + 130 + i * 56 - (lines.length > 1 ? 0 : -24)));
  c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `700 34px ${F}`; c.fillText('∞ (주)무한채용 · 출근하기', W / 2, H - 120);
  return cv;
}

export async function saveResultImage(d: SlipData, r: THREE.WebGLRenderer, look: Look): Promise<void> {
  const cv = await makeResultImage(d, r, look);
  const url = cv.toDataURL('image/png');
  const ua = navigator.userAgent;
  const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!inApp && !ios) {
    const a = document.createElement('a'); a.href = url; a.download = `무한채용-오늘의급여-${Date.now()}.png`; document.body.append(a); a.click(); a.remove();
    toast('이미지를 내려받았어요');
    return;
  }
  // 아이폰·앱 안 브라우저: 길게 눌러 저장
  const v = h('div', { class: 'veil', style: 'flex-direction:column;gap:12px' },
    h('div', { style: 'color:#fff;font:800 16px P;text-align:center' }, '이미지를 길게 눌러 저장하세요'),
    h('img', { src: url, alt: '오늘의 급여 명세서', style: 'max-width:86vw;max-height:72vh;border-radius:12px;-webkit-touch-callout:default;user-select:auto;pointer-events:auto' }),
    h('button', { class: 'btn', style: 'width:200px', onclick: () => v.remove() }, '닫기'));
  $ui().append(v);
}
