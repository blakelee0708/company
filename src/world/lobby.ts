// 1층 로비(천장 12m) — scenes4.js lobby()를 옮김. 유리 커튼월, 큰 기둥 4개, 스피드 게이트 6줄, 엘리베이터 코어, 2층 난간, 높은 로고.
import * as THREE from 'three';
import { box, plane, floor, floorTex, ceiling, sign, ring, plant, instancify, mat } from './kit';
import { NavGrid } from './nav';
import { windowTex } from './sky';

export const LOBBY = { GZ: -4.2, GX: [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4], START: new THREE.Vector3(-0.9, 0, 1.8), HALL_Z: -11.4 };

export interface Lane { idx: number; x: number; wings: THREE.Group[]; reader: THREE.Mesh; open: number; target: number }
export function buildLobby() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeae7e2);
  const tops: Record<string, THREE.Vector3> = {};
  const stone = floorTex((c, w, h) => { c.fillStyle = '#ece9e4'; c.fillRect(0, 0, w, h); c.fillStyle = '#e2ded7'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); c.strokeStyle = 'rgba(0,0,0,.05)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); }, [8, 10]);
  floor(scene, 28, 34, stone, 0, -3);
  const HT = 12;
  // 엘리베이터 코어(뒷벽, 돌) + 2층 난간
  plane(scene, 28, HT, 0xe3dcd0, 0, HT / 2, -14).userData.inst = false;
  for (const [i, x] of [-4.5, -1.5, 1.5, 4.5].entries()) {
    box(scene, 2.3, 2.9, 0.2, 0xb9c0cb, x, 0, -13.85, 0.05, { rough: 0.35 });
    box(scene, 1.02, 2.6, 0.06, 0xdfe3e9, x - 0.52, 0, -13.73, 0.01, { rough: 0.3 }); box(scene, 1.02, 2.6, 0.06, 0xdfe3e9, x + 0.52, 0, -13.73, 0.01, { rough: 0.3 });
    sign(scene, '▲ ' + [1, 3, 5, 8][i], 0.7, 0.24, x, 3.2, -13.88, { bg: '#262a35', fg: '#ffb347' });
  }
  box(scene, 28, 0.5, 2.2, 0xf3f1ec, 0, 5.2, -12.9, 0.05);
  const rail = new THREE.MeshStandardMaterial({ color: 0xcfe9f7, transparent: true, opacity: 0.45, roughness: 0.1 });
  box(scene, 28, 0.9, 0.05, rail, 0, 5.7, -11.82, 0.01, { cast: false });
  box(scene, 6.4, 1.5, 0.14, 0x1d2b4f, 0, 8.2, -13.9, 0.1); sign(scene, '∞ 무한채용', 6.0, 1.3, 0, 8.95, -13.82, { bg: '#1d2b4f' });
  // 왼쪽: 유리 커튼월
  { const g = plane(scene, 34, HT, 0xbfe3ff, -12, HT / 2, -3, Math.PI / 2, true); g.material = new THREE.MeshBasicMaterial({ map: windowTex() }); g.userData.inst = false; }
  for (let z = -19; z <= 14; z += 2.4) box(scene, 0.16, HT, 0.16, 0xe6e8ec, -11.9, 0, z, 0.02, { cast: false });
  for (const y of [3, 6, 9]) box(scene, 0.14, 0.12, 34, 0xe6e8ec, -11.9, y, -3, 0.02, { cast: false });
  // 오른쪽: 돌벽
  plane(scene, 34, HT, 0xe8e1d6, 12, HT / 2, -3, -Math.PI / 2).userData.inst = false;
  ceiling(scene, 28, 34, HT, 0, -3, [-7, -3.5, 0, 3.5, 7].flatMap((x) => [-11, -6.5, -2, 2.5, 7].map((z) => [x, z, 1.6, 1.6] as [number, number, number, number])));
  // 큰 기둥 4개(지름 1.1)
  const cols: Array<[number, number]> = [[-6.5, -8.5], [6.5, -8.5], [-6.5, 1.5], [6.5, 1.5]];
  for (const [x, z] of cols) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, HT, 40), mat(0xf6f4f0, 0.5)); c.position.set(x, HT / 2, z); c.castShadow = true; c.receiveShadow = true; scene.add(c); }
  plant(scene, -10.5, -12.5, 1.8); plant(scene, 10.5, -12.5, 1.8); plant(scene, -10.5, 4, 1.6); plant(scene, 10.6, 4.5, 1.6);
  // 스피드 게이트 6줄(기둥 7개)
  const gz = LOBBY.GZ, gx = LOBBY.GX;
  const lanes: Lane[] = [];
  const readers: THREE.Mesh[] = [];
  gx.forEach((x) => {
    box(scene, 0.3, 1.02, 1.5, 0xd4d9e0, x, 0, gz, 0.06, { rough: 0.3 });
    const r = box(scene, 0.22, 0.02, 0.36, 0x3b4252, x, 1.02, gz + 0.45, 0.01, { inst: false });
    r.material = mat(0x3b4252, 0.7).clone();
    readers.push(r);
  });
  for (let i = 0; i < gx.length - 1; i++) {
    const x = gx[i], L = gx[i + 1] - x - 0.3, half = L / 2;
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const wings: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const pv = new THREE.Group();
      pv.position.set(s < 0 ? x + 0.15 : gx[i + 1] - 0.15, 0, gz);
      const w = box(pv, half, 0.55, 0.04, glass, s < 0 ? half / 2 : -half / 2, 0.45, 0, 0.03, { cast: false });
      w.userData.inst = false;
      scene.add(pv);
      wings.push(pv);
    }
    lanes.push({ idx: i, x: x + 0.9, wings, reader: readers[i], open: 0, target: 0 });
  }
  // 게이트 옆 낮은 유리 칸막이(돌아서 못 지나가게)
  const bar = new THREE.MeshStandardMaterial({ color: 0xcfe9f7, transparent: true, opacity: 0.35, roughness: 0.1 });
  for (const s of [-1, 1]) { box(scene, 6.2, 1.0, 0.05, bar, s * 8.75, 0, gz, 0.01, { cast: false }); box(scene, 6.3, 0.05, 0.1, 0xd4d9e0, s * 8.75, 1.0, gz, 0.02); }
  // 안내 데스크(오른쪽 앞, 남색)
  box(scene, 3.6, 1.05, 0.9, 0x1d2b4f, 7.0, 0, 2.2, 0.06, { rough: 0.4 }); box(scene, 3.7, 0.06, 1.0, 0xf6f2ea, 7.0, 1.05, 2.2, 0.03);
  sign(scene, '안내', 1.0, 0.3, 7.0, 0.6, 2.66, { bg: '#1d2b4f' });
  tops.desk = new THREE.Vector3(7.0, 1.6, 2.2);
  const meRing = ring(scene, LOBBY.START.x, LOBBY.START.z, 0.6);
  instancify(scene);
  // 걷기 격자
  const nav = new NavGrid(-12, -14, 12, 14, 0.5);
  nav.block({ x0: -13, x1: -11.5, z0: -15, z1: 15 });
  nav.block({ x0: 11.6, x1: 13, z0: -15, z1: 15 });
  nav.block({ x0: -13, x1: 13, z0: -15, z1: -13.3 });
  for (const [x, z] of cols) nav.block({ x0: x - 0.55, x1: x + 0.55, z0: z - 0.55, z1: z + 0.55 }, 0.25);
  nav.block({ x0: 5.1, x1: 8.9, z0: 1.6, z1: 2.8 }, 0.2);
  for (const [x, z] of [[-10.5, -12.5], [10.5, -12.5], [-10.5, 4], [10.6, 4.5]]) nav.block({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 }, 0.1);
  nav.block({ x0: -12, x1: 12, z0: gz - 0.8, z1: gz + 0.8 });
  const openLane = (l: Lane, open: boolean): void => {
    if (open) nav.open({ x0: l.x - 0.4, x1: l.x + 0.4, z0: gz - 0.8, z1: gz + 0.8 });
    else nav.block({ x0: l.x - 0.6, x1: l.x + 0.6, z0: gz - 0.8, z1: gz + 0.8 });
  };
  const update = (dt: number): void => {
    for (const l of lanes) {
      l.open += Math.sign(l.target - l.open) * Math.min(Math.abs(l.target - l.open), dt * 3);
      l.wings[0].rotation.y = l.open * Math.PI / 2;
      l.wings[1].rotation.y = -l.open * Math.PI / 2;
    }
  };
  return { scene, nav, lanes, readers, tops, meRing, openLane, update };
}
