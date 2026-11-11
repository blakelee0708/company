// 캐릭터 얼굴 그림(사원증·대화창·퇴근 카드용). 3D 캐릭터를 잘라서 그림으로 만든다.
import * as THREE from 'three';
import { Worker, type Look } from './worker';
import { envTexture } from '../core/render';

const cache = new Map<string, string>();
export function portrait(r: THREE.WebGLRenderer, look: Look, w = 116, h = 116, mouthOpen = false, bg = 0xeaf5ff): string {
  const key = JSON.stringify(look) + w + 'x' + h + mouthOpen + bg;
  const hit = cache.get(key);
  if (hit) return hit;
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(bg);
  sc.environment = envTexture(r);
  sc.add(new THREE.HemisphereLight(0xffffff, 0xe3d8c6, 0.3 * 0.9));
  const d = new THREE.DirectionalLight(0xfff3e2, 0.55); d.position.set(-4, 10, 7); sc.add(d);
  const f = new THREE.DirectionalLight(0xdfe9ff, 0.3); f.position.set(4, 5, -7); sc.add(f);
  const p = new Worker({ ...look });
  p.hiRes = true;
  p.update(0.016);
  p.setEyesClosed(false);
  p.setMouth(mouthOpen);
  sc.add(p.root);
  const cam = new THREE.PerspectiveCamera(24, w / h, 0.1, 50);
  cam.position.set(0, 1.05, 3.2); cam.lookAt(0, 0.88, 0);
  const rt = new THREE.WebGLRenderTarget(w * 2, h * 2, { samples: 4 });
  rt.texture.encoding = THREE.sRGBEncoding;
  const prev = r.getRenderTarget();
  r.setRenderTarget(rt);
  r.render(sc, cam);
  const px = new Uint8Array(w * 2 * h * 2 * 4);
  r.readRenderTargetPixels(rt, 0, 0, w * 2, h * 2, px);
  r.setRenderTarget(prev);
  rt.dispose();
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w * 2, h * 2);
  for (let y = 0; y < h * 2; y++) img.data.set(px.subarray((h * 2 - 1 - y) * w * 2 * 4, (h * 2 - y) * w * 2 * 4), y * w * 2 * 4);
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
