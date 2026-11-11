// 캐릭터 조각과 재질 — reference-code/toon.js에서 옮김(숫자는 그대로).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export { THREE, RoundedBoxGeometry };
THREE.ColorManagement.legacyMode = false;

export const OL = 0x3a2f3d;
export const SUITS = { navy: 0x33467a, charcoal: 0x4a4e58, gray: 0x8a91a0, black: 0x2c2e35, beige: 0xdcc29b, pink: 0xe9a9b4 } as const;
export type SuitName = keyof typeof SUITS;
export const SUIT_NAMES = Object.keys(SUITS) as SuitName[];
export const TIES = [0xe5484d, 0x3d8bd9, 0x3aa76d, 0xf0b63c] as const;
export const SKIN = 0xffe1cf, HAIR_M = 0x3b2b27, HAIR_F = 0x5b3a2d, HAIR_G = 0x8d8a88;

/* ---------------- 재질 ---------------- */
const SKIN_C = new THREE.MeshStandardMaterial({ color: 0xffdcc6, roughness: 0.55, envMapIntensity: 0.35 });
export const skinMat = (): THREE.Material => SKIN_C;
const cache = new Map<string, THREE.MeshStandardMaterial>();
/** 점토 재질(거칠기 .62, 금속 0) */
export function toon(c: number, rough = 0.62): THREE.MeshStandardMaterial {
  const key = c + '|' + rough;
  let m = cache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, envMapIntensity: 0.4 }); cache.set(key, m); }
  return m;
}
const flatCache = new Map<number, THREE.MeshBasicMaterial>();
export function flat(c: number): THREE.MeshBasicMaterial {
  let m = flatCache.get(c);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); flatCache.set(c, m); }
  return m;
}

/** 조각 하나: 그림자는 드리우기만, 받지 않음 */
export function part(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D | null, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = false;
  if (parent) parent.add(m);
  return m;
}

/** 타원체(크기를 도형에 구워 넣음) */
export function ellipsoid(rx: number, ry: number, rz: number, ws = 48, hs = 32): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  g.computeVertexNormals();
  return g;
}

/** 여러 조각을 재질별로 하나로 합침(그리기 횟수 줄이기). parts: [geometry, matrix] */
export function merge(list: Array<[THREE.BufferGeometry, THREE.Matrix4]>): THREE.BufferGeometry {
  const gs = list.map(([g, m]) => {
    const c = g.clone();
    c.applyMatrix4(m);
    for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') c.deleteAttribute(k);
    return ensureIndex(c);
  });
  const out = mergeBufferGeometries(gs, false);
  if (!out) throw new Error('merge failed');
  return out;
}

/** 합치기 전에 모두 index가 있게 맞춤 */
export function ensureIndex(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.index) { const n = g.attributes.position.count, a: number[] = new Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(a); }
  return g;
}

/* ---------------- 이음매 없이 휘는 관(팔·다리) ----------------
 * 점 몇 개를 지나는 곡선을 따라 관을 만들고, 매 프레임 꼭짓점만 다시 계산한다(새 도형을 만들지 않음). */
const _c = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
export class Limb {
  readonly geo: THREE.BufferGeometry;
  readonly mesh: THREE.Mesh;
  readonly capA: THREE.Mesh;
  readonly capB: THREE.Mesh | null;
  private readonly T: number;
  private readonly R: number;
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly P: THREE.Vector3[] = [];
  private readonly Tn: THREE.Vector3[] = [];
  private readonly N: THREE.Vector3;
  constructor(public radius: number, mat: THREE.Material, parent: THREE.Object3D, T = 18, R = 14, capEnd = false) {
    this.T = T; this.R = R;
    const nv = (T + 1) * (R + 1);
    this.pos = new Float32Array(nv * 3);
    this.nor = new Float32Array(nv * 3);
    const idx: number[] = [];
    for (let i = 0; i < T; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = (i + 1) * (R + 1) + j, c = (i + 1) * (R + 1) + j + 1, d = i * (R + 1) + j + 1;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.geo = g;
    for (let i = 0; i <= T; i++) { this.P.push(new THREE.Vector3()); this.Tn.push(new THREE.Vector3()); }
    this.N = new THREE.Vector3();
    this.mesh = part(g, mat, parent);
    this.mesh.frustumCulled = false;
    const sg = sphereGeo(radius);
    this.capA = part(sg, mat, parent);
    this.capB = capEnd ? part(sg, mat, parent) : null;
  }
  /** pts: 곡선이 지나는 점들(2~5개) */
  update(pts: THREE.Vector3[]): void {
    _c.points = pts;
    const T = this.T, R = this.R, r = this.radius;
    for (let i = 0; i <= T; i++) { _c.getPoint(i / T, this.P[i]); }
    for (let i = 0; i <= T; i++) {
      const a = this.P[Math.max(0, i - 1)], b = this.P[Math.min(T, i + 1)];
      this.Tn[i].subVectors(b, a).normalize();
    }
    // 첫 법선: 첫 접선과 수직인 아무 방향
    const t0 = this.Tn[0];
    const ref = Math.abs(t0.y) < 0.9 ? _up : _x;
    const N = this.N.crossVectors(t0, ref).normalize();
    const B = _b;
    let k = 0;
    for (let i = 0; i <= T; i++) {
      const t = this.Tn[i];
      if (i > 0) { // 평행 이동: N을 새 접선에 수직으로 다시 맞춤
        N.addScaledVector(t, -N.dot(t)).normalize();
      }
      B.crossVectors(t, N);
      const p = this.P[i];
      for (let j = 0; j <= R; j++) {
        const v = (j / R) * Math.PI * 2, cs = Math.cos(v), sn = Math.sin(v);
        const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
        this.nor[k] = nx; this.nor[k + 1] = ny; this.nor[k + 2] = nz;
        this.pos[k] = p.x + r * nx; this.pos[k + 1] = p.y + r * ny; this.pos[k + 2] = p.z + r * nz;
        k += 3;
      }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    this.capA.position.copy(pts[0]);
    if (this.capB) this.capB.position.copy(pts[pts.length - 1]);
  }
}
const _up = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(1, 0, 0), _b = new THREE.Vector3();

const sphereCache = new Map<string, THREE.SphereGeometry>();
export function sphereGeo(r: number, w = 20, h = 14): THREE.SphereGeometry {
  const k = r + '|' + w + '|' + h;
  let g = sphereCache.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, w, h); sphereCache.set(k, g); }
  return g;
}
