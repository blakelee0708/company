// 엘리베이터, 타이틀, 캐릭터 선택 장면 — scenes4.js elevator(), title(), select()를 옮김.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, plane, floor, floorTex, canvasTex, sign, ring, mat, FONT, instancify } from './kit';

/* ================= 엘리베이터 ================= */
export function buildElevator() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8e1d6);
  floor(scene, 12, 12, floorTex((c, w, h) => { c.fillStyle = '#eceae6'; c.fillRect(0, 0, w, h); c.fillStyle = '#e2dfd9'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); }, [6, 6]), 0, 2);
  for (const [w, x] of [[4.3, -3.85], [4.3, 3.85]]) plane(scene, w, 5, 0xe3dcd0, x, 2.5, -1.5);
  plane(scene, 3.4, 1.7, 0xe3dcd0, 0, 4.15, -1.5);
  box(scene, 0.4, 3.3, 0.2, 0xb9c0cb, -1.5, 0, -1.45, 0.06, { rough: 0.35 }); box(scene, 0.4, 3.3, 0.2, 0xb9c0cb, 1.5, 0, -1.45, 0.06, { rough: 0.35 }); box(scene, 3.4, 0.4, 0.2, 0xb9c0cb, 0, 2.95, -1.45, 0.06, { rough: 0.35 });
  const cab = new THREE.Group(); cab.position.set(0, 0, -2.9); scene.add(cab);
  plane(cab, 2.8, 2.9, 0xf1d3a1, 0, 1.45, -1.2);
  for (const s of [-1, 1]) plane(cab, 2.6, 2.9, 0xe9c58f, s * 1.4, 1.45, 0.1, (-s * Math.PI) / 2);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), mat(0xcda675)); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.01, 0.1); fl.receiveShadow = true; cab.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff6df })); ce.rotation.x = Math.PI / 2; ce.position.set(0, 2.9, 0.1); cab.add(ce);
  box(scene, 0.3, 3.0, 0.12, 0xdfe3e9, -1.35, 0, -1.32, 0.02, { rough: 0.3 }); box(scene, 0.3, 3.0, 0.12, 0xdfe3e9, 1.35, 0, -1.32, 0.02, { rough: 0.3 });
  // 문(양쪽으로 열림) — 벽 뒤로 숨어 들어감
  const doorM = mat(0xc9ced8, 0.3);
  const doors = [-1, 1].map((s) => { const d = box(scene, 1.25, 2.75, 0.05, doorM, s * 0.62, 0, -1.6, 0.01, { inst: false }); return d; });
  // 층 표시
  const disp = document.createElement('canvas'); disp.width = 180; disp.height = 64;
  const dispTex = new THREE.CanvasTexture(disp); dispTex.encoding = THREE.sRGBEncoding;
  const drawFloor = (n: number, up: boolean): void => { const c = disp.getContext('2d')!; c.fillStyle = '#262a35'; c.fillRect(0, 0, 180, 64); c.fillStyle = '#ffb347'; c.font = `800 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((up ? '▲ ' : '') + n + 'F', 90, 34); dispTex.needsUpdate = true; };
  drawFloor(1, true);
  const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32), new THREE.MeshBasicMaterial({ map: dispTex })); dp.position.set(0, 3.55, -1.38); scene.add(dp);
  box(scene, 0.22, 0.5, 0.08, 0xb9c0cb, 2.1, 1.2, -1.42, 0.04);
  const meRing = ring(scene, -0.55, 2.3, 0.55);
  instancify(scene);
  let open = 1, target = 1;
  const update = (dt: number): void => {
    open += Math.sign(target - open) * Math.min(Math.abs(target - open), dt * 1.8);
    doors[0].position.x = -0.62 - open * 1.3; doors[1].position.x = 0.62 + open * 1.3;
  };
  return { scene, drawFloor, setDoors: (o: boolean) => { target = o ? 1 : 0; }, update, meRing, cam: { pos: new THREE.Vector3(0, 2.9, 9.6), tgt: new THREE.Vector3(0, 1.6, -1.5), fov: 42 } };
}

/* ================= 타이틀 ================= */
export function buildTitle() {
  const scene = new THREE.Scene();
  scene.background = canvasTex(64, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.62, '#e3f4ff'); g.addColorStop(1, '#fff4e2'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  floor(scene, 60, 60, null, 0, 0, 0xe9e3d8);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 4), mat(0xbfe3a8, 0.9)); grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.005, -3.6); grass.receiveShadow = true; scene.add(grass);
  const glass = canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#9fcbea'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 24) { c.fillStyle = y % 48 ? '#b7dcf4' : '#a6d1ee'; c.fillRect(0, y, w, 20); } c.fillStyle = 'rgba(255,255,255,.9)'; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 3, h); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(0, h * 0.1); c.lineTo(w * 0.5, 0); c.lineTo(w * 0.8, 0); c.lineTo(0, h * 0.35); c.fill(); });
  const tower = new THREE.Mesh(new RoundedBoxGeometry(4.6, 9, 3.4, 3, 0.25), [mat(0x9fcbea, 0.2), mat(0x9fcbea, 0.2), mat(0xe8eef4, 0.4), mat(0xe8eef4, 0.4), new THREE.MeshStandardMaterial({ map: glass, roughness: 0.2, envMapIntensity: 0.6 }), mat(0x9fcbea, 0.2)]);
  tower.position.set(0, 4.5, -5.5); tower.castShadow = true; scene.add(tower);
  box(scene, 4.7, 1.0, 3.5, 0x1d2b4f, 0, 9, -5.5, 0.2); sign(scene, '∞ 무한채용', 4.2, 0.8, 0, 9.5, -3.74, { bg: '#1d2b4f' });
  box(scene, 6.4, 1.5, 4.2, 0xf4f1ea, 0, 0, -5.5, 0.2); box(scene, 1.6, 1.2, 0.1, 0x9fd4f5, 0, 0, -3.36, 0.04, { rough: 0.1 });
  for (const [x, s] of [[-4.2, 1.2], [4.3, 1.4]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 14), mat(0xb7814f)); t.position.set(x, 0.6, -2.8); scene.add(t); const b = new THREE.Mesh(new THREE.SphereGeometry(0.85 * s, 28, 20), mat(0x6cc27a, 0.8)); b.position.set(x, 1.7 * s, -2.8); b.castShadow = true; scene.add(b); }
  for (const [x, y, z, s] of [[-3.4, 10.8, -8, 1], [3.6, 11.6, -9, 0.9], [-1.6, 12.4, -10, 0.7]]) { const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); for (const [px, py, r] of [[-0.5, 0, 0.5], [0.12, 0.22, 0.66], [0.75, 0, 0.5]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); c.position.set(px, py, 0); g.add(c); } }
  return { scene, cam: { pos: new THREE.Vector3(0, 3.0, 19), tgt: new THREE.Vector3(0, 7.0, 0), fov: 44 } };
}

/* ================= 캐릭터 선택 ================= */
export function buildSelect() {
  const scene = new THREE.Scene();
  scene.background = canvasTex(64, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#dff1ff'); g.addColorStop(1, '#fff5e6'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  floor(scene, 40, 40, null, 0, 0, 0xf4ece0);
  const pads = [-0.85, 0.85].map((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 48), mat(0xffffff, 0.4).clone()); p.position.set(x, 0.08, 0); p.castShadow = p.receiveShadow = true; scene.add(p); return p; });
  return { scene, pads, cam: { pos: new THREE.Vector3(0, 1.9, 11), tgt: new THREE.Vector3(0, 1.15, 0), fov: 34 } };
}
