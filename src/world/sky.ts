// 창밖 하늘: 실제 시각에 따라 아침·낮·저녁·밤. 밤이면 도시 야경.
import * as THREE from 'three';
import { canvasTex } from './kit';

export type Daypart = 'morning' | 'day' | 'evening' | 'night';
export function daypart(d = new Date()): Daypart {
  const h = d.getHours();
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}
const SKY: Record<Daypart, [string, string, string]> = {
  morning: ['#a9d8ff', '#e3f4ff', '#fff1dc'],
  day: ['#8fd0ff', '#bfe3ff', '#e3f4ff'],
  evening: ['#6f7fc9', '#f6a77c', '#ffd9a8'],
  night: ['#0e1430', '#1d2b4f', '#2c3a64'],
};
let cache: THREE.CanvasTexture | null = null;
export function windowTex(part: Daypart = daypart()): THREE.CanvasTexture {
  if (cache) return cache;
  cache = canvasTex(256, 128, (c, w, h) => {
    const [a, b, d] = SKY[part];
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(0.6, b); g.addColorStop(1, d);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // 먼 건물들
    const night = part === 'night';
    let x = 0, k = 7;
    while (x < w) {
      k = (k * 37 + 11) % 97;
      const bw = 18 + (k % 22), bh = 26 + ((k * 3) % 50);
      c.fillStyle = night ? '#141a33' : part === 'evening' ? 'rgba(90,80,130,.55)' : 'rgba(150,180,210,.45)';
      c.fillRect(x, h - bh, bw, bh);
      if (night) { for (let yy = h - bh + 5; yy < h - 4; yy += 7) for (let xx = x + 3; xx < x + bw - 3; xx += 6) if ((xx * 7 + yy * 13 + k) % 5 < 2) { c.fillStyle = '#ffd98a'; c.fillRect(xx, yy, 3, 3); } }
      x += bw + 4;
    }
  });
  return cache;
}
