// 장면 도구 — reference-code/scenes4.js의 기본 도형(box, plane, floor, ceiling, sign, ring, plant, chair, monitor, cubicle, printer)을 옮김.
// 숫자(크기·위치·색)는 그대로. 다 만든 뒤 instancify()로 같은 모양을 InstancedMesh 하나로 묶는다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureIndex } from '../character/parts';
THREE.ColorManagement.legacyMode = false;

export const FONT = 'P, Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

const M = (c: number, rough = 0.7, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, envMapIntensity: 0.4, ...extra });
const MC = new Map<string, THREE.MeshStandardMaterial>();
export function mat(c: number, r = 0.7, e?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const k = c + '|' + r + JSON.stringify(e || {});
  let m = MC.get(k);
  if (!m) { m = M(c, r, e); MC.set(k, m); }
  return m;
}
const BC = new Map<number, THREE.MeshBasicMaterial>();
export function basic(c: number): THREE.MeshBasicMaterial {
  let m = BC.get(c);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); BC.set(c, m); }
  return m;
}
const GC = new Map<string, THREE.BufferGeometry>();
export function rbGeo(w: number, h: number, d: number, rad: number): THREE.BufferGeometry {
  const r = Math.min(rad, w / 2.01, h / 2.01, d / 2.01);
  const k = [w, h, d, r].map((v) => v.toFixed(4)).join(',');
  let g = GC.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 2, r); GC.set(k, g); }
  return g;
}
const PC = new Map<string, THREE.PlaneGeometry>();
export function planeGeo(w: number, h: number): THREE.PlaneGeometry {
  const k = w.toFixed(4) + ',' + h.toFixed(4);
  let g = PC.get(k);
  if (!g) { g = new THREE.PlaneGeometry(w, h); PC.set(k, g); }
  return g;
}
export function cachedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = GC.get(key) as T | undefined;
  if (!g) { g = make(); GC.set(key, g); }
  return g;
}

export interface BoxOpts { rough?: number; cast?: boolean; recv?: boolean; inst?: boolean }
/** 둥근 상자(바닥 기준 y) */
export function box(parent: THREE.Object3D, w: number, h: number, d: number, c: number | THREE.Material, x: number, y: number, z: number, rad = 0.03, o: BoxOpts = {}): THREE.Mesh {
  const m = new THREE.Mesh(rbGeo(w, h, d, rad), typeof c === 'number' ? mat(c, o.rough ?? 0.7) : c);
  m.position.set(x, y + h / 2, z);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.recv ?? true;
  if (o.inst !== false && typeof c === 'number') m.userData.inst = true;
  parent.add(m);
  return m;
}
export function plane(parent: THREE.Object3D, w: number, h: number, c: number | THREE.Material, x: number, y: number, z: number, ry = 0, emissive = false): THREE.Mesh {
  const m = new THREE.Mesh(planeGeo(w, h), typeof c === 'number' ? (emissive ? basic(c) : mat(c, 0.9)) : c);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.receiveShadow = !emissive;
  if (typeof c === 'number') m.userData.inst = true;
  parent.add(m);
  return m;
}
export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, rep?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
export function floorTex(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, rep: [number, number]): THREE.CanvasTexture { return canvasTex(512, 512, draw, rep); }
export function floor(scene: THREE.Object3D, w: number, d: number, tex: THREE.Texture | null, x = 0, z = 0, c = 0xffffff): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: c, map: tex, roughness: 0.85, envMapIntensity: 0.3 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true; m.name = 'floor';
  scene.add(m);
  return m;
}
export function ceiling(scene: THREE.Object3D, w: number, d: number, y: number, x = 0, z = 0, lights: Array<[number, number, number, number]> = []): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0xf4f2ee, 0.95)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.name = 'ceiling'; scene.add(m);
  lights.forEach(([lx, lz, lw, ld]) => { const l = new THREE.Mesh(planeGeo(lw, ld), basic(0xffffff)); l.rotation.x = Math.PI / 2; l.position.set(lx, y - 0.01, lz); l.userData.inst = true; l.userData.ceil = true; scene.add(l); });
  return m;
}
export interface TextOpts { bg?: string | null; fg?: string; size?: number; weight?: number; ry?: number }
export function textTex(text: string, w: number, h: number, { bg = '#1d2b4f', fg = '#fff', size = 64, weight = 800 }: TextOpts = {}): THREE.CanvasTexture {
  return canvasTex(w, h, (c) => { if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); } c.fillStyle = fg; c.font = `${weight} ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); });
}
export function sign(parent: THREE.Object3D, text: string, w: number, h: number, x: number, y: number, z: number, o: TextOpts = {}): THREE.Mesh {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(text, Math.round(w * 200), Math.round(h * 200), { size: Math.round(h * 120), ...o }), transparent: o.bg === null }));
  p.position.set(x, y, z);
  if (o.ry) p.rotation.y = o.ry;
  parent.add(p);
  return p;
}
/** 하늘색 동그라미(빈자리) */
export function ring(scene: THREE.Object3D, x: number, z: number, r = 0.5): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const m = new THREE.Mesh(cachedGeo('ring' + r, () => new THREE.RingGeometry(r - 0.06, r, 48)), new THREE.MeshBasicMaterial({ color: 0x57b8ff, transparent: true })); m.rotation.x = -Math.PI / 2; m.position.y = 0.015; g.add(m);
  const f = new THREE.Mesh(cachedGeo('disc' + r, () => new THREE.CircleGeometry(r - 0.06, 48)), new THREE.MeshBasicMaterial({ color: 0x57b8ff, transparent: true, opacity: 0.18, depthWrite: false })); f.rotation.x = -Math.PI / 2; f.position.y = 0.014; g.add(f);
  g.userData.ring = true;
  scene.add(g);
  return g;
}
export function plant(scene: THREE.Object3D, x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
  const pot = new THREE.Mesh(cachedGeo('pot', () => new THREE.CylinderGeometry(0.26, 0.2, 0.5, 28)), mat(0xf2efe8, 0.6)); pot.position.y = 0.25; pot.castShadow = true; pot.userData.inst = true; g.add(pot);
  for (const [px, py, pz, r] of [[-0.16, 0.75, 0, 0.24], [0.17, 0.78, 0.03, 0.24], [0, 1.02, 0, 0.28], [0, 0.8, 0.17, 0.22], [0.05, 1.25, -0.05, 0.2]]) {
    const b = new THREE.Mesh(cachedGeo('leaf' + r, () => new THREE.SphereGeometry(r, 24, 16)), mat(0x5fb86e, 0.75)); b.position.set(px, py, pz); b.castShadow = true; b.userData.inst = true; g.add(b);
  }
  return g;
}
/** 바퀴 의자. ry=0: 앉는 사람이 +z를 봄 */
export function chair(scene: THREE.Object3D, x: number, z: number, ry = 0): THREE.Group {
  const g = buildChair(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  return g;
}
export function buildChair(): THREE.Group {
  const g = new THREE.Group();
  const k = 0x2c2f36;
  box(g, 0.54, 0.09, 0.5, k, 0, 0.44, 0, 0.04);
  box(g, 0.5, 0.62, 0.08, k, 0, 0.55, -0.27, 0.05);
  const c = new THREE.Mesh(cachedGeo('chairpole', () => new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12)), mat(0x9aa0aa, 0.4)); c.position.y = 0.22; c.userData.inst = true; g.add(c);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, l = box(g, 0.05, 0.04, 0.3, k, Math.sin(a) * 0.14, 0.03, Math.cos(a) * 0.14, 0.015); l.rotation.y = a; }
  // 의자 하나 = 메시 하나(빼고 넣을 수 있게)
  const one = mergeColored(g);
  one.userData.occluder = false;
  const out = new THREE.Group(); out.add(one);
  out.userData.chair = true;
  return out;
}
/** 모니터. 화면이 +z */
export function monitor(parent: THREE.Object3D, x: number, y: number, z: number, ry = 0, w = 0.56): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(g, 0.16, 0.015, 0.12, 0x2b2e35, 0, 0, 0, 0.006); box(g, 0.04, 0.2, 0.03, 0x2b2e35, 0, 0, -0.02, 0.01);
  box(g, w, w * 0.6, 0.035, 0x24262c, 0, 0.15, 0, 0.012);
  const s = new THREE.Mesh(planeGeo(w - 0.04, w * 0.6 - 0.04), basic(0xcfe9ff)); s.position.set(0, 0.15 + w * 0.3, 0.019); s.userData.inst = true; g.add(s);
  for (const [lw, ly] of [[0.5, 0.8], [0.34, 0.62], [0.42, 0.44]]) { const l = new THREE.Mesh(planeGeo((w - 0.1) * lw, 0.022), basic(0x8fb6dd)); l.position.set((-(w - 0.1) * (1 - lw)) / 2, 0.15 + w * 0.6 * ly, 0.02); l.userData.inst = true; g.add(l); }
  return g;
}

export const PANEL = 0x8f99c6, FRAME = 0xd9dce2, WOOD = 0xdcb47c;
export const CUB = { W: 3.0, D: 1.2, SEAT: 1.05 };
export interface CubOpts { ang?: number; side?: boolean; memo?: boolean; plant?: boolean; files?: boolean; mug?: boolean; mugC?: number }
/** 칸막이 자리 하나(넓은 개인 자리). 칸막이 조각은 자리마다 하나로 합쳐서(반투명 처리용) 둔다. */
export function cubicle(scene: THREE.Object3D, x: number, z: number, facing: number, o: CubOpts = {}): { g: THREE.Group; chair: THREE.Group; partition: THREE.Mesh } {
  const ang = o.ang ?? (facing > 0 ? 0 : Math.PI);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ang; scene.add(g);
  const W = 2.8, D = 1.2, hw = CUB.W / 2, pz = -D / 2 - 0.05;
  box(g, W, 0.045, D, WOOD, 0, 0.72, 0, 0.02, { rough: 0.55 });
  box(g, 0.05, 0.72, D - 0.1, FRAME, -W / 2 + 0.03, 0, 0, 0.01);
  box(g, 0.5, 0.64, D - 0.15, WOOD, W / 2 - 0.3, 0, -0.02, 0.02, { rough: 0.6 });
  for (const yy of [0.15, 0.34, 0.53]) box(g, 0.46, 0.008, 0.01, 0xa88456, W / 2 - 0.3, yy, (D - 0.15) / 2 - 0.02, 0.003);
  // 칸막이(높이 1.4): 조각을 모아 하나로
  const ph = 1.4;
  const pg = new THREE.Group(); g.add(pg);
  box(pg, CUB.W, ph, 0.07, PANEL, 0, 0, pz, 0.015, { rough: 0.95 });
  box(pg, CUB.W + 0.04, 0.04, 0.1, FRAME, 0, ph, pz, 0.018); box(pg, 0.05, ph + 0.04, 0.1, FRAME, -hw, 0, pz, 0.014); box(pg, 0.05, ph + 0.04, 0.1, FRAME, hw, 0, pz, 0.014);
  if (o.side !== false) { box(pg, 0.07, ph, D + 0.2, PANEL, -hw, 0, 0.05, 0.015, { rough: 0.95 }); box(pg, 0.1, 0.04, D + 0.24, FRAME, -hw, ph, 0.05, 0.018); box(pg, 0.1, ph + 0.04, 0.05, FRAME, -hw, 0, 0.05 + (D + 0.2) / 2, 0.014); }
  const partition = mergeColored(pg);
  g.remove(pg); g.add(partition);
  monitor(g, -0.36, 0.765, -0.3, 0.14, 0.66); monitor(g, 0.36, 0.765, -0.3, -0.14, 0.66);
  box(g, 0.5, 0.02, 0.16, 0xf2f3f5, 0, 0.765, 0.2, 0.01); box(g, 0.08, 0.028, 0.11, 0xf2f3f5, 0.42, 0.765, 0.22, 0.02);
  box(g, 0.3, 0.015, 0.22, 0xffffff, -0.85, 0.765, 0.18, 0.005);
  if (o.mug !== false) { const m = new THREE.Mesh(cachedGeo('mug', () => new THREE.CylinderGeometry(0.05, 0.045, 0.11, 18)), mat(o.mugC ?? 0xffffff, 0.5)); m.position.set(-1.15, 0.82, 0.1); m.castShadow = true; m.userData.inst = true; g.add(m); }
  if (o.memo) { const n = plane(g, 0.14, 0.14, 0xfff59a, -1.0, 1.1, pz + 0.04); n.rotation.z = 0.08; const n2 = plane(g, 0.14, 0.14, 0xffd1dc, -0.8, 1.0, pz + 0.04); n2.rotation.z = -0.1; const n3 = plane(g, 0.14, 0.14, 0xc9f2d4, 1.0, 1.15, pz + 0.04); n3.rotation.z = 0.05; }
  if (o.plant) { const p = new THREE.Mesh(cachedGeo('minipot', () => new THREE.CylinderGeometry(0.06, 0.05, 0.1, 14)), mat(0xffffff, 0.5)); p.position.set(-1.2, 0.815, -0.35); p.userData.inst = true; g.add(p); const b = new THREE.Mesh(cachedGeo('minileaf', () => new THREE.SphereGeometry(0.1, 16, 12)), mat(0x5fb86e, 0.8)); b.position.set(-1.2, 0.94, -0.35); b.userData.inst = true; g.add(b); }
  if (o.files) for (let i = 0; i < 4; i++) box(g, 0.06, 0.26, 0.22, [0x3d8bd9, 0x3aa76d, 0xe5484d, 0xf0b63c][i], 0.95 + i * 0.07, 0.765, -0.38, 0.01);
  const ch = chair(scene, x + Math.sin(ang) * CUB.SEAT, z + Math.cos(ang) * CUB.SEAT, ang + Math.PI);
  return { g, chair: ch, partition };
}
export function printer(scene: THREE.Object3D, x: number, z: number): void { box(scene, 1.0, 0.9, 0.7, 0xe9ebef, x, 0, z, 0.05, { rough: 0.4 }); box(scene, 0.8, 0.06, 0.5, 0xcfd3da, x, 0.9, z, 0.02); }

/** 여러 상자를 하나의 메시로(색은 꼭짓점 색으로). 반투명하게 만들 수 있게 재질은 따로 */
const PART_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.4 });
export function mergeColored(g: THREE.Group): THREE.Mesh {
  g.updateMatrix();
  const list: THREE.BufferGeometry[] = [];
  g.children.forEach((ch) => {
    const m = ch as THREE.Mesh; m.updateMatrix();
    const geo = m.geometry.clone().applyMatrix4(m.matrix);
    const c = ((m.material as THREE.MeshStandardMaterial).color).clone();
    const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geo.deleteAttribute(k);
    list.push(ensureIndex(geo));
  });
  const merged = mergeBufferGeometries(list, false)!;
  const mesh = new THREE.Mesh(merged, PART_MAT);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.occluder = true;
  return mesh;
}

/** 같은 도형+재질 메시들을 InstancedMesh 하나로 바꾼다(모양은 그대로). */
export function instancify(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.userData.inst || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (Array.isArray(m.material)) return;
    const k = m.geometry.uuid + '|' + (m.material as THREE.Material).uuid + '|' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0);
    let l = groups.get(k);
    if (!l) { l = []; groups.set(k, l); }
    l.push(m);
  });
  let n = 0;
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const l of groups.values()) {
    if (l.length < 2) continue;
    const f = l[0];
    const im = new THREE.InstancedMesh(f.geometry, f.material as THREE.Material, l.length);
    im.castShadow = f.castShadow; im.receiveShadow = f.receiveShadow;
    const mm = new THREE.Matrix4();
    l.forEach((m, i) => { mm.multiplyMatrices(inv, m.matrixWorld); im.setMatrixAt(i, mm); m.parent?.remove(m); });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    root.add(im);
    n++;
  }
  return n;
}
