// 탕비실 — scenes4.js pantry()를 옮김. 사무실 오른쪽 벽 문 너머(월드 x 9~15, z -0.5~10.5).
// 로컬 좌표(앞 = +z = 사무실 쪽)로 만들고, 무리째 돌려서 붙인다: 월드 = (10.5 − 로컬z, 5 + 로컬x)
import * as THREE from 'three';
import { box, plane, floor, floorTex, canvasTex, plant, mat, sign } from './kit';
import { windowTex } from './sky';
import type { NavGrid } from './nav';

export const PANTRY = { X0: 9, X1: 15, Z0: -0.5, Z1: 10.5, OX: 10.5, OZ: 5 };
export const pantryToWorld = (lx: number, lz: number): THREE.Vector3 => new THREE.Vector3(PANTRY.OX - lz, 0, PANTRY.OZ + lx);

export function buildPantry(scene: THREE.Scene, nav: NavGrid) {
  const g = new THREE.Group();
  g.position.set(PANTRY.OX, 0, PANTRY.OZ);
  g.rotation.y = -Math.PI / 2;
  scene.add(g);
  const tops: Record<string, THREE.Vector3> = {};
  const fl = floor(g, 11, 6, floorTex((c, w, h) => { c.fillStyle = '#f2e8d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#e9ddc8'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); }, [5.5, 3]), 0, -1.5);
  fl.position.y = 0.002;
  const back = plane(g, 11, 3.1, 0xfdf6ea, 0, 1.55, -4.5); back.userData.inst = false;
  for (const s of [-1, 1]) { const w = plane(g, 6, 3.1, 0xfaf1e2, s * 5.5, 1.55, -1.5, -s * Math.PI / 2); w.userData.inst = false; }
  { const c = new THREE.Mesh(new THREE.PlaneGeometry(11, 6), mat(0xf4f2ee, 0.95)); c.rotation.x = Math.PI / 2; c.position.set(0, 3.1, -1.5); g.add(c); }
  const tile = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#d3ebe4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#bcdcd2'; c.lineWidth = 4; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  plane(g, 7.2, 0.9, new THREE.MeshStandardMaterial({ map: tile, roughness: 0.5 }), -1.6, 1.42, -4.48);
  box(g, 2.2, 1.3, 0.06, 0xdfe3ea, 3.4, 0.9, -4.47, 0.02, { cast: false });
  { const w = plane(g, 2.06, 1.16, 0xbfe3ff, 3.4, 1.55, -4.42, 0, true); w.material = new THREE.MeshBasicMaterial({ map: windowTex() }); w.userData.inst = false; }
  box(g, 7.0, 0.9, 0.9, 0xc99a6b, -1.6, 0, -3.95, 0.04, { rough: 0.55 }); box(g, 7.1, 0.06, 1.0, 0xfbf8f2, -1.6, 0.9, -3.95, 0.02, { rough: 0.3 });
  // 커피 머신
  box(g, 0.9, 1.0, 0.65, 0x3b3f4b, -4.2, 0.96, -4.0, 0.08, { rough: 0.35 });
  const lamp = box(g, 0.5, 0.07, 0.02, 0x7fd0ff, -4.2, 1.7, -3.66, 0.02, { inst: false });
  box(g, 0.24, 0.05, 0.2, 0x262a35, -4.2, 0.97, -3.72, 0.02, { inst: false });
  // 정수기
  box(g, 0.55, 1.0, 0.55, 0xe6f3fb, -2.9, 0.96, -4.0, 0.06, { rough: 0.3 });
  const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 24), new THREE.MeshStandardMaterial({ color: 0x9fd4f5, transparent: true, opacity: 0.8, roughness: 0.1 })); wb.position.set(-2.9, 2.16, -4); g.add(wb);
  // 간식 바구니
  box(g, 1.0, 0.25, 0.55, 0xe0a85c, -1.6, 0.96, -3.95, 0.06);
  ([[0xff8f8f, -1.85], [0xffe08a, -1.6], [0xa8e6a1, -1.35]] as const).forEach(([c, x]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat(c, 0.5)); b.position.set(x, 1.3, -3.95); g.add(b); });
  for (let i = 0; i < 4; i++) box(g, 0.12, 0.04, 0.3, 0x6b3f2a, -1.25 + i * 0.03, 1.22 + i * 0.02, -3.85, 0.01);
  // 냉장고
  box(g, 1.3, 2.3, 1.0, 0xf2f4f7, 2.0, 0, -3.95, 0.08, { rough: 0.3 });
  box(g, 0.05, 0.6, 0.06, 0xaab3c2, 1.5, 1.2, -3.43, 0.02);
  plant(g, 4.8, -3.8, 1.4);
  // 액자
  sign(g, '오늘도 수고 많으십니다 ☕', 1.9, 0.42, 0.25, 2.45, -4.47, { bg: '#fff8ea', fg: '#7a5434' });
  box(g, 2.0, 0.52, 0.04, 0x7a5434, 0.25, 2.19, -4.5, 0.02, { cast: false });
  // 둥근 높은 테이블 2개 + 의자
  for (const [tx, tz] of [[-0.6, -1.4], [3.0, -1.1]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 16), mat(0x4a5060, 0.4)); leg.position.set(tx, 0.5, tz); leg.castShadow = true; g.add(leg);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.07, 40), mat(0xfbf7ef, 0.4)); top.position.set(tx, 1.03, tz); top.castShadow = true; top.receiveShadow = true; g.add(top);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.04, 24), mat(0x4a5060, 0.4)); base.position.set(tx, 0.02, tz); g.add(base);
    for (const s of [-1, 1]) {
      const sx = tx + s * 1.0;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24), mat(0xe08a5c, 0.5)); st.position.set(sx, 0.72, tz); st.castShadow = true; g.add(st);
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10), mat(0x9aa0aa, 0.4)); sl.position.set(sx, 0.35, tz); g.add(sl);
    }
    const w = pantryToWorld(tx, tz);
    nav.block({ x0: w.x - 0.65, x1: w.x + 0.65, z0: w.z - 0.65, z1: w.z + 0.65 });
  }
  // 걷기 격자 막기(월드)
  nav.block({ x0: 13.85, x1: 15.6, z0: -0.6, z1: 6.95 }); // 조리대
  nav.block({ x0: 13.85, x1: 15.6, z0: 6.3, z1: 7.7 }); // 냉장고
  nav.block({ x0: 13.7, x1: 15.6, z0: 9.2, z1: 10.6 }); // 화분
  nav.block({ x0: 14.65, x1: 15.6, z0: -1, z1: 11 });
  nav.block({ x0: 8.6, x1: 15.6, z0: PANTRY.Z1 - 0.35, z1: 11.5 });
  // 사람이 설 곳(월드)
  const spots = {
    coffee: pantryToWorld(-4.2, -3.0),
    water: pantryToWorld(-2.9, -3.0),
    snack: pantryToWorld(-1.6, -3.0),
    table: pantryToWorld(-0.6, -0.2),
    entry: pantryToWorld(3.4, 0.9),
  };
  g.updateMatrixWorld(true);
  const W = (lx: number, y: number, lz: number): THREE.Vector3 => { const p = pantryToWorld(lx, lz); p.y = y; return p; };
  tops.coffee = W(-4.2, 2.3, -4); tops.water = W(-2.9, 2.6, -4); tops.snack = W(-1.6, 1.6, -3.95);
  const cupSpot = W(-4.2, 1.0, -3.72);
  return { group: g, tops, spots, lamp, cupSpot };
}
