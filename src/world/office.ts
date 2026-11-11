// 부서 사무실 — scenes4.js office()를 옮김(숫자 그대로) + 걷기 격자 + 자리표 + 오른쪽 벽 너머 탕비실.
// 자리 20개(1팀 7 · 2팀 7 · 3팀 6). 팀마다 칸막이를 사이에 두고 등을 맞댄 두 줄. 맨 안쪽 가운데 부장, 2팀 오른쪽 끝 과장(팀장).
import * as THREE from 'three';
import { box, plane, floor, floorTex, ceiling, sign, ring, plant, chair, monitor, cubicle, printer, CUB, instancify, mat, basic, canvasTex, FONT } from './kit';
import { NavGrid, type Rect } from './nav';
import type { Seat } from './actor';
import { buildPantry, PANTRY } from './pantry';
import { windowTex } from './sky';

export const OFFICE = { RW: 18, ZB: -19, ZF: 11, H: 3.1, DOOR: new THREE.Vector3(0, 0, 10.2), BOARD: new THREE.Vector3(-8.0, 0, 6.4), PANTRY_DOOR: new THREE.Vector3(9, 0, 8.4) };

export interface OfficeBuilt {
  scene: THREE.Scene;
  seats: Seat[];
  bossSeat: Seat;
  mgrSeat: Seat;
  nav: NavGrid;
  occluders: THREE.Object3D[];
  rings: THREE.Group[];
  tops: Record<string, THREE.Vector3>;
  /** 자리별 모니터 가운데(카메라가 다가갈 곳) */
  monitorAt: (s: Seat) => THREE.Vector3;
  pantry: ReturnType<typeof buildPantry>;
  rightWall: THREE.Mesh[];
}

/** 부서마다 다른 분위기 소품 */
function deptProps(scene: THREE.Scene, dept: number): void {
  const wallZ = OFFICE.ZB + 0.06;
  if (dept === 0) { // 기획부: 화이트보드 + 포스트잇
    box(scene, 2.4, 1.2, 0.06, 0xffffff, -5.6, 1.0, wallZ + 0.05, 0.03, { cast: false, inst: false });
    [[0xfff59a, -6.3, 1.8], [0xffd1dc, -5.9, 1.6], [0xc9f2d4, -5.4, 1.85], [0xcfe6ff, -5.0, 1.5]].forEach(([c, x, y]) => plane(scene, 0.22, 0.22, c, x, y, wallZ + 0.1));
  } else if (dept === 1) { // 영업부: 실적 그래프 액자(전부 상승)
    const t = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a2f3d'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); const bars = [30, 52, 70, 96, 124]; bars.forEach((b, i) => { c.fillStyle = ['#8fd3ff', '#3d8bd9', '#3aa76d', '#f0b63c', '#e5484d'][i]; c.fillRect(28 + i * 44, h - 20 - b, 30, b); }); c.strokeStyle = '#e5484d'; c.lineWidth = 5; c.beginPath(); c.moveTo(30, 120); c.lineTo(220, 22); c.stroke(); });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.12), new THREE.MeshBasicMaterial({ map: t })); p.position.set(-5.6, 1.9, wallZ + 0.04); scene.add(p);
  } else if (dept === 2) { // 재무부: 계산기·서류철
    box(scene, 2.4, 1.6, 0.4, 0xe9ebef, -5.6, 0, wallZ + 0.3, 0.03, { inst: false });
    for (let i = 0; i < 10; i++) box(scene, 0.16, 0.34, 0.3, [0x3d8bd9, 0x3aa76d, 0xe5484d, 0xf0b63c, 0x8f99c6][i % 5], -6.6 + i * 0.22, 1.2, wallZ + 0.3, 0.02);
    box(scene, 0.3, 0.06, 0.38, 0x3b4252, -4.6, 1.6, wallZ + 0.3, 0.02);
  } else if (dept === 3) { // 디자인부: 색 견본 + 큰 모니터
    ['#e5484d', '#f0b63c', '#3aa76d', '#3d8bd9', '#8f99c6', '#e9a9b4'].forEach((c, i) => plane(scene, 0.3, 0.5, parseInt(c.slice(1), 16), -6.6 + i * 0.4, 1.8, wallZ + 0.04));
    monitor(scene, -3.8, 0.9, wallZ + 0.4, 0, 1.2);
    box(scene, 1.6, 0.9, 0.6, 0xdcb47c, -3.8, 0, wallZ + 0.4, 0.03);
  } else { // 인사부: 화분이 유난히 많음
    for (const [x, z, s] of [[-7.6, -17.8, 1.2], [-5.6, -18.2, 1.0], [5.6, -18.2, 1.0], [7.6, -17.8, 1.3], [-8.2, 0, 1.1], [-8.2, -6, 1.0], [7.6, 9.8, 1.0], [-6.0, 9.8, 1.1]] as const) plant(scene, x, z, s);
  }
}

export function buildOffice(dept: number, floorNo: number): OfficeBuilt {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf1ede6);
  const tops: Record<string, THREE.Vector3> = {};
  const carpet = floorTex((c, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 128 + ((i * 7 + j * 3) % 5) * 4; c.fillStyle = `rgb(${v},${v + 3},${v + 8})`; c.fillRect(i * 128, j * 128, 128, 128); } c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.stroke(); } }, [9, 12]);
  const { RW, ZB, ZF, H: H3 } = OFFICE, RD = ZF - ZB, ZC = (ZB + ZF) / 2;
  floor(scene, RW, RD, carpet, 0, ZC);
  const occluders: THREE.Object3D[] = [];
  const wall = (w: number, hh: number, c: number, x: number, y: number, z: number, ry: number): THREE.Mesh => { const m = plane(scene, w, hh, c, x, y, z, ry); m.userData.inst = false; m.material = mat(c, 0.9).clone(); occluders.push(m); return m; };
  wall(RW, H3, 0xf6f4f0, 0, H3 / 2, ZB, 0);
  wall(RD, H3, 0xf3f1ec, -RW / 2, H3 / 2, ZC, Math.PI / 2);
  // 오른쪽 벽: 탕비실 문(가운데 z=8.4, 폭 1.4) 자리를 비움
  const dz = OFFICE.PANTRY_DOOR.z, a0 = ZB, a1 = dz - 0.7, b0 = dz + 0.7, b1 = ZF;
  const rightWall = [wall(a1 - a0, H3, 0xf3f1ec, RW / 2, H3 / 2, (a0 + a1) / 2, -Math.PI / 2), wall(b1 - b0, H3, 0xf3f1ec, RW / 2, H3 / 2, (b0 + b1) / 2, -Math.PI / 2), wall(1.4, H3 - 2.3, 0xf3f1ec, RW / 2, 2.3 + (H3 - 2.3) / 2, dz, -Math.PI / 2)];
  // 앞벽(문 쪽): 유리문 양옆
  const fw = (RW - 3.6) / 2;
  wall(fw, H3, 0xf3f1ec, -RW / 2 + fw / 2, H3 / 2, ZF, Math.PI).userData.front = true;
  wall(fw, H3, 0xf3f1ec, RW / 2 - fw / 2, H3 / 2, ZF, Math.PI).userData.front = true;
  ceiling(scene, RW, RD, H3, 0, ZC, [-5.5, 0, 5.5].flatMap((x) => [-17, -12.5, -8, -3.5, 1, 5.5].map((z) => [x, z, 1.4, 0.7] as [number, number, number, number])));
  const winMat = new THREE.MeshBasicMaterial({ map: windowTex() });
  for (const x of [-6.6, -2.2, 2.2, 6.6]) { box(scene, 3.8, 1.9, 0.06, 0xdfe3ea, x, 0.75, ZB + 0.03, 0.02, { cast: false }); const w = plane(scene, 3.64, 1.74, 0xbfe3ff, x, 1.7, ZB + 0.08, 0, true); w.material = winMat; w.userData.inst = false; plane(scene, 0.04, 1.74, 0x9aa3b2, x, 1.7, ZB + 0.09, 0, true); }
  for (let i = 0; i < 9; i++) { box(scene, 0.5, 2.0, 1.1, 0xf4f5f7, RW / 2 - 0.26, 0, -16.5 + i * 1.12, 0.02, { rough: 0.5 }); box(scene, 0.02, 0.3, 0.04, 0xaab3c2, RW / 2 - 0.52, 1.0, -16.5 + i * 1.12 + 0.35, 0.01); }
  // 층 표시
  sign(scene, `${floorNo}F`, 0.9, 0.4, -RW / 2 + 0.02, 2.5, 9.6, { bg: '#1d2b4f', ry: Math.PI / 2 });
  // 부장 자리(맨 안쪽 가운데)
  const bossChair = chair(scene, 0, -17.3, 0);
  box(scene, 3.2, 0.76, 1.3, 0x8a6142, 0, 0, -16.2, 0.04, { rough: 0.5 });
  monitor(scene, -0.45, 0.76, -16.55, 0, 0.62).rotation.y = Math.PI + 0.15; monitor(scene, 0.45, 0.76, -16.55, 0, 0.62).rotation.y = Math.PI - 0.15;
  box(scene, 0.8, 0.18, 0.08, 0x2f3a5c, 0.9, 0.76, -15.6, 0.02); sign(scene, '부장', 0.7, 0.14, 0.9, 0.85, -15.555, { bg: '#2f3a5c' });
  box(scene, 4.0, 0.9, 0.55, 0xe8e4dc, 0, 0, -18.55, 0.03);
  plant(scene, -2.6, -18.2, 1.3); plant(scene, 2.6, -18.2, 1.1);
  const bossSeat: Seat = { idx: -1, x: 0, z: -17.25, ry: 0, chair: bossChair, team: 0, kind: 'boss' };
  tops.boss = new THREE.Vector3(0, 2.0, -17.25);
  // 팀: 3팀(부장 쪽) → 2팀 → 1팀(문 쪽)
  const teams: Array<[number, number, string, number]> = [[-9.0, 6, '3팀', 3], [-2.4, 7, '2팀', 2], [4.2, 7, '1팀', 1]];
  const seats: Seat[] = [], X4 = [-4.5, -1.5, 1.5, 4.5];
  const partitions: THREE.Mesh[] = [];
  const nav = new NavGrid(-9.5, ZB - 0.5, PANTRY.X1 + 0.5, ZF + 0.5, 0.5);
  const blocks: Array<[Rect, number]> = [];
  // 사각형(로컬) → 월드
  const rectOf = (cx: number, cz: number, ang: number, x0: number, x1: number, z0: number, z1: number): Rect => {
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([lx, lz]) => [cx + lx * Math.cos(ang) + lz * Math.sin(ang), cz - lx * Math.sin(ang) + lz * Math.cos(ang)]);
    return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])) };
  };
  let mgrSeat: Seat | null = null;
  teams.forEach(([zc, n, name, team], t) => {
    const far = n === 7 ? X4 : X4.slice(0, 3), near = X4.slice(0, 3);
    far.forEach((x, i) => { const c = cubicle(scene, x, zc - 0.7, -1, { side: i > 0, memo: (i + t) % 2 === 0, plant: i === 1, files: i === 2 }); partitions.push(c.partition); seats.push({ idx: seats.length, x, z: zc - 0.7 - CUB.SEAT, ry: 0, chair: c.chair, team, kind: 'staff' }); blocks.push([rectOf(x, zc - 0.7, Math.PI, -1.5, 1.5, -0.7, 0.62), 0.15]); });
    near.forEach((x, i) => { const c = cubicle(scene, x, zc + 0.7, +1, { side: i > 0, memo: (i + t) % 2 === 1, mugC: 0xffe08a, files: i === 0 }); partitions.push(c.partition); seats.push({ idx: seats.length, x, z: zc + 0.7 + CUB.SEAT, ry: Math.PI, chair: c.chair, team, kind: 'staff' }); blocks.push([rectOf(x, zc + 0.7, 0, -1.5, 1.5, -0.7, 0.62), 0.15]); });
    if (name === '2팀') {
      const c = cubicle(scene, 6.95, zc, 0, { ang: Math.PI / 2, files: true, memo: true, plant: true }); partitions.push(c.partition);
      mgrSeat = { idx: -2, x: 6.95 + CUB.SEAT, z: zc, ry: -Math.PI / 2, chair: c.chair, team: 2, kind: 'mgr' };
      blocks.push([rectOf(6.95, zc, Math.PI / 2, -1.5, 1.5, -0.7, 0.62), 0.15]);
      tops.mgr = new THREE.Vector3(6.95 + CUB.SEAT, 2.0, zc);
      plant(scene, 4.5, zc + 1.2, 1.1); blocks.push([{ x0: 4.2, x1: 4.8, z0: zc + 0.9, z1: zc + 1.5 }, 0.1]);
    } else { printer(scene, 4.5, zc + 0.9); blocks.push([{ x0: 4.0, x1: 5.0, z0: zc + 0.55, z1: zc + 1.25 }, 0.1]); }
    if (n === 6) { plant(scene, 4.5, zc - 1.2, 1.2); blocks.push([{ x0: 4.2, x1: 4.8, z0: zc - 1.5, z1: zc - 0.9 }, 0.1]); }
    tops['team' + name] = new THREE.Vector3(-6.6, 1.5, zc);
  });
  // 자리 순서: 시안과 같은 번호(팀 3 먼 줄 → 가까운 줄 → 팀 2 → 팀 1)
  // 바닥 막기
  for (const [r, p] of blocks) nav.block(r, p);
  nav.block({ x0: -1.7, x1: 1.7, z0: -16.95, z1: -15.5 }, 0.1); // 부장 책상
  nav.block({ x0: -2.1, x1: 2.1, z0: -19, z1: -18.2 }, 0.1); // 뒤 수납장
  nav.block({ x0: -3, x1: -2.2, z0: -18.7, z1: -17.7 }); nav.block({ x0: 2.2, x1: 3, z0: -18.7, z1: -17.7 });
  nav.block({ x0: 8.45, x1: 9.2, z0: -17.2, z1: -7.3 }); // 사물함
  // 벽 바깥
  nav.block({ x0: -10, x1: -RW / 2 + 0.35, z0: ZB - 1, z1: ZF + 1 });
  nav.block({ x0: -10, x1: PANTRY.X1 + 1, z0: ZB - 1, z1: ZB + 0.4 });
  nav.block({ x0: -10, x1: PANTRY.X1 + 1, z0: ZF - 0.35, z1: ZF + 1 });
  nav.block({ x0: RW / 2 - 0.35, x1: PANTRY.X1 + 1, z0: ZB - 1, z1: PANTRY.Z0 + 0.3 });
  nav.block({ x0: RW / 2 - 0.35, x1: RW / 2 + 0.35, z0: ZB, z1: dz - 0.55 });
  nav.block({ x0: RW / 2 - 0.35, x1: RW / 2 + 0.35, z0: dz + 0.55, z1: ZF });
  // 탕비실
  const pantry = buildPantry(scene, nav);
  // 사내 게시판(왼쪽 벽), 탕비실 문, 유리문
  box(scene, 0.08, 1.3, 2.4, 0xa87a52, -RW / 2 + 0.1, 0.7, 6.4, 0.03);
  ([[0xfff59a, 5.7, 1.6], [0xffd1dc, 6.2, 1.7], [0xc9f2d4, 6.9, 1.5], [0xcfe6ff, 5.9, 1.2], [0xffe2b8, 6.7, 1.15]] as const).forEach(([c, zz, yy]) => { const n = plane(scene, 0.34, 0.3, c, -RW / 2 + 0.16, yy, zz, Math.PI / 2); n.rotation.x = (((zz * 13) % 1) - 0.5) * 0.2; });
  sign(scene, '사내 게시판', 1.2, 0.22, -RW / 2 + 0.16, 2.2, 6.4, { bg: '#7a5434', ry: Math.PI / 2 });
  tops.board = new THREE.Vector3(-RW / 2 + 0.2, 2.2, 6.4);
  nav.block({ x0: -9.2, x1: -8.6, z0: 5.1, z1: 7.7 });
  // 탕비실 문(열려 있는 문틀 + 표지)
  box(scene, 0.12, 0.2, 1.6, 0x8fc7ea, RW / 2 - 0.02, 2.3, dz, 0.03, { inst: false });
  for (const s of [-1, 1]) box(scene, 0.14, 2.3, 0.1, 0x8fc7ea, RW / 2 - 0.02, 0, dz + s * 0.75, 0.03, { inst: false });
  sign(scene, '탕비실', 0.9, 0.22, RW / 2 - 0.13, 2.7, dz + 1.4, { bg: '#1d2b4f', ry: -Math.PI / 2 });
  tops.pantry = new THREE.Vector3(RW / 2 - 0.3, 2.5, dz);
  { const gd = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.25), basic(0x9fd4f5)); gd.rotation.x = -Math.PI / 2; gd.position.set(0, 0.02, ZF - 0.15); scene.add(gd); tops.door = new THREE.Vector3(0, 0, ZF - 0.4); }
  // 유리문 자리(시안처럼 바닥에 하늘색 띠만: 카메라를 가리지 않게)
  deptProps(scene, dept);
  // 빈자리 동그라미(나중에 자리표에 따라 보이고 숨김)
  const rings = seats.map((s) => ring(scene, s.x, s.z, 0.42));
  for (const p of partitions) occluders.push(p);
  instancify(scene);
  const monitorAt = (s: Seat): THREE.Vector3 => new THREE.Vector3(s.x + Math.sin(s.ry) * 1.35, 1.15, s.z + Math.cos(s.ry) * 1.35);
  // 자리 칸은 꼭 열어 둠
  for (const s of [...seats, bossSeat, mgrSeat!]) nav.open({ x0: s.x - 0.25, x1: s.x + 0.25, z0: s.z - 0.25, z1: s.z + 0.25 });
  return { scene, seats, bossSeat, mgrSeat: mgrSeat!, nav, occluders, rings, tops, monitorAt, pantry, rightWall };
}
export { FONT };
