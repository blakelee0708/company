// 캐릭터 worker() — reference-code/toon.js의 worker()를 TypeScript로 옮기고, 움직일 수 있게 뼈대를 나눔.
// 몸통은 회전체 하나(셔츠 V·넥타이·라펠·단추는 셰이더), 팔·다리는 이음매 없이 휘는 관, 손은 공.
// 앞이 +z, 발바닥 y=0, 키 약 1.5. 캐릭터는 그림자를 드리우기만 하고 받지 않는다.
import { THREE, RoundedBoxGeometry, OL, SUITS, TIES, SKIN, HAIR_M, HAIR_F, HAIR_G, toon, flat, part, ellipsoid, merge, mergeVC, VC_FLAT, VC_LIT, Limb, skinMat, type SuitName } from './parts';
import { Animator, type BasePose, type Action } from '../anim/animator';

export interface Look {
  sex?: 'm' | 'f';
  suit?: SuitName | number;
  tie?: number;
  hairC?: number;
  glasses?: boolean;
  bald?: boolean;
  card?: boolean;
}

/* ---------------- 몸통(재킷) ---------------- */
interface TorsoU { uSuit: { value: THREE.Color }; uDark: { value: THREE.Color }; uTie: { value: THREE.Color }; uFem: { value: number }; uOL: { value: THREE.Color } }
function torsoMat(suit: number, o: Look): { mat: THREE.MeshStandardMaterial; u: TorsoU } {
  const base = new THREE.Color(suit), dark = base.clone().multiplyScalar(0.78), tie = new THREE.Color(o.tie ?? TIES[0]);
  const u: TorsoU = { uSuit: { value: base }, uDark: { value: dark }, uTie: { value: tie }, uFem: { value: o.sex === 'f' ? 1 : 0 }, uOL: { value: new THREE.Color(OL) } };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66, envMapIntensity: 0.4 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = 'varying vec3 vOP;\nuniform vec3 uSuit,uDark,uTie,uOL;uniform float uFem;\n' + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      vec3 col = uSuit; float x = vOP.x, y = vOP.y, ax = abs(x);
      if (vOP.z > 0.0) {
        float top = 0.675, tip = uFem > .5 ? 0.47 : 0.44;
        float vHalf = (y - tip) / (top - tip) * 0.105;
        bool inV = y > tip && ax < vHalf;
        bool lapel = y > tip - 0.03 && ax >= vHalf && ax < vHalf + 0.05 && y > 0.5;
        if (lapel) col = uDark;
        if (inV) {
          col = vec3(1.0);
          if (uFem < .5) {
            float knot = 0.645, tw = y > knot ? 0.026 : mix(0.04, 0.018, (y - tip) / (knot - tip));
            if (y > tip + 0.012 && ax < tw && y < 0.672) col = uTie;
            if (abs(y - knot) < 0.0025 && ax < 0.03) col = uOL;
          } else {
            if (length(vec2(x, y - 0.5)) < 0.011) col = vec3(0.95, 0.77, 0.42);
          }
        }
        if (!inV && y < tip && y > 0.26 && ax < 0.0035) col = uOL;
        if (length(vec2(x + 0.035, y - 0.39)) < 0.009 || length(vec2(x + 0.035, y - 0.33)) < 0.009) col = uOL;
        if (abs(y - 0.262) < 0.004) col = uDark;
      } else {
        if (ax < 0.003 && y < 0.5) col = uDark;
        if (y > 0.655 && ax < 0.1) col = vec3(1.0);
      }
      vec4 diffuseColor = vec4( col, opacity );`);
  };
  m.customProgramCacheKey = () => 'torso';
  return { mat: m, u };
}
let TORSO: THREE.BufferGeometry | null = null;
function torsoGeo(): THREE.BufferGeometry {
  if (TORSO) return TORSO;
  const prof: Array<[number, number]> = [[0, 0.25], [0.2, 0.255], [0.235, 0.28], [0.245, 0.4], [0.255, 0.54], [0.245, 0.62], [0.2, 0.665], [0.12, 0.685], [0, 0.69]];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(36).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, 44);
  g.scale(1, 1, 0.72);
  g.computeVertexNormals();
  TORSO = g;
  return g;
}

/* ---------------- 머리 ---------------- */
export const HC = 1.0, HX = 0.43, HY = 0.39, HZ = 0.4;
type Region = (az: number, y: number) => number;
/** 머리카락: 머리보다 조금 큰 공을, 머리선 아래에서는 안쪽으로 밀어 넣는다(닫힌 면) */
function hairGeo(region: Region, k = 1.06, flare = 0, inner = 0.97, ws = 128, hs = 96): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), az = Math.atan2(x, z);
    const t = THREE.MathUtils.smoothstep(region(az, y), -0.015, 0.015);
    const kk = inner + (k - inner) * t;
    const fl = 1 + flare * Math.max(0, -y) * t;
    p.setXYZ(i, x * HX * kk * fl, y * HY * kk, z * HZ * kk * fl);
  }
  g.computeVertexNormals();
  return g;
}
const mixA = (front: number, side: number, back: number, az: number): number => { const c = Math.cos(az); return c >= 0 ? side + (front - side) * c : side + (back - side) * -c; };

type HairKind = 'm' | 'f' | 'bald';
const HAIR = new Map<string, THREE.BufferGeometry>();
/** 머리카락 도형(가까이 = 촘촘, 멀리 = 성김) */
function hairFor(kind: HairKind, lo = false): THREE.BufferGeometry {
  const key = kind + (lo ? ':lo' : '');
  let g = HAIR.get(key);
  if (g) return g;
  const ws = lo ? 56 : 128, hs = lo ? 42 : 96;
  if (kind === 'bald') {
    g = hairGeo((az, y) => Math.min((Math.abs(az) - 1.25) * 0.5, (2.6 - Math.abs(az)) * 0.5, 0.42 - y, y + 0.2), 1.05, 0, 0.97, ws, hs);
  } else if (kind === 'f') {
    // 단발: 정수리에서 턱선까지, 앞은 일자 앞머리(눈썹 위), 얼굴 부분만 비움
    g = hairGeo((az, y) => Math.min(Math.max(y - 0.31, (Math.abs(az) - 1.1) * 0.55), y + 0.64), 1.09, 0.12, 0.97, ws, hs);
  } else {
    // 옆으로 넘긴 짧은 머리 + 정수리 삐침
    const fr = (az: number): number => 0.34 + 0.13 * Math.tanh(az * 2.2) - 0.06 * Math.exp(-((az + 0.35) ** 2) / 0.03);
    const base = hairGeo((az, y) => y - mixA(fr(az), 0.14, -0.42, az), 1.05, 0, 0.97, ws, hs);
    const tuft = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.4, 0.02), new THREE.Vector3(0.03, 0.5, 0.03), new THREE.Vector3(0.1, 0.53, 0.05)]);
    const tg = new THREE.TubeGeometry(tuft, lo ? 8 : 16, 0.016, lo ? 6 : 10, false);
    g = merge([[base, new THREE.Matrix4()], [tg, new THREE.Matrix4()]]);
  }
  HAIR.set(key, g);
  return g;
}
/** 카메라 위치(멀리 있는 사람은 성긴 머리) */
export const LOD = { cam: new THREE.Vector3(), far: Infinity };

const onFace = (x: number, y: number): number => HZ * Math.sqrt(Math.max(0, 1 - (x / HX) ** 2 - (y / HY) ** 2));
const M4 = (o: THREE.Object3D): THREE.Matrix4 => { o.updateMatrix(); return o.matrix.clone(); };

interface FaceGeo { skin: THREE.BufferGeometry; eyesOpen: THREE.BufferGeometry; closed: THREE.BufferGeometry; deco: THREE.BufferGeometry; smile: THREE.BufferGeometry; open: THREE.BufferGeometry; brows: THREE.BufferGeometry }
const FACE = new Map<string, FaceGeo>();
/** 얼굴 조각을 재질별로 하나씩 합친 도형(모든 캐릭터가 같이 씀) */
function faceFor(ears: boolean, glasses: boolean): FaceGeo {
  const key = (ears ? 'e' : '') + (glasses ? 'g' : '');
  const hit = FACE.get(key);
  if (hit) return hit;
  const O = new THREE.Object3D();
  const at = (x: number, y: number, z: number): THREE.Matrix4 => { O.position.set(x, y, z); O.rotation.set(0, 0, 0); O.scale.set(1, 1, 1); return M4(O); };
  const skin: Array<[THREE.BufferGeometry, THREE.Matrix4]> = [[ellipsoid(HX, HY, HZ, 48, 36), new THREE.Matrix4()]];
  if (ears) for (const s of [-1, 1]) skin.push([ellipsoid(0.06, 0.085, 0.05, 20, 14), at(s * 0.42, 0.02, 0)]);
  const eyes: Array<[THREE.BufferGeometry, THREE.Matrix4]> = [], whites: typeof eyes = [], closed: typeof eyes = [], blush: typeof eyes = [], brows: typeof eyes = [];
  for (const s of [-1, 1]) {
    const ex = s * 0.15, ey = 0.06, ez = onFace(ex, ey);
    O.position.set(ex, ey - 0.01, ez); O.rotation.set(0, 0, 0); closed.push([new THREE.TorusGeometry(0.04, 0.009, 8, 20, Math.PI), M4(O)]);
    O.position.set(ex, ey, ez - 0.004); O.lookAt(O.position.clone().multiplyScalar(2)); eyes.push([ellipsoid(0.045, 0.058, 0.02, 24, 16), M4(O)]);
    whites.push([new THREE.SphereGeometry(0.017, 12, 8), at(ex + 0.015, ey + 0.022, ez + 0.012)]);
    whites.push([new THREE.SphereGeometry(0.008, 10, 6), at(ex - 0.014, ey - 0.02, ez + 0.012)]);
    const bx = s * 0.25, by = -0.11, bz = onFace(bx, by), nrm = new THREE.Vector3(bx / HX ** 2, by / HY ** 2, bz / HZ ** 2).normalize();
    O.position.set(bx, by, bz).addScaledVector(nrm, -0.042); O.rotation.set(0, 0, 0); O.lookAt(O.position.clone().add(nrm)); blush.push([ellipsoid(0.08, 0.05, 0.05, 24, 16), M4(O)]);
    O.position.set(s * 0.15, 0.17, onFace(s * 0.15, 0.17) + 0.004); O.rotation.set(0, 0, Math.PI / 2 + s * -0.12); brows.push([new THREE.CapsuleGeometry(0.009, 0.055, 4, 10), M4(O)]);
  }
  O.position.set(0, -0.15, onFace(0, -0.15) - 0.006); O.rotation.set(0, 0, 0); O.scale.set(1.15, 0.9, 0.35);
  const open = merge([[new THREE.SphereGeometry(0.05, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M4(O)]]);
  O.scale.set(1, 1, 1); O.position.set(0, -0.13, onFace(0, -0.13) + 0.004); O.rotation.set(0, 0, Math.PI + Math.PI * 0.1);
  const smile = merge([[new THREE.TorusGeometry(0.04, 0.009, 8, 24, Math.PI * 0.8), M4(O)]]);
  const deco: Array<[THREE.BufferGeometry, THREE.Matrix4, number]> = blush.map(([g, m]) => [g, m, 0xffa79c]);
  if (glasses) {
    for (const s of [-1, 1]) deco.push([new THREE.TorusGeometry(0.085, 0.011, 8, 32), at(s * 0.15, 0.06, onFace(s * 0.15, 0.06) + 0.03), OL]);
    O.position.set(0, 0.07, onFace(0, 0.07) + 0.03); O.rotation.set(0, 0, Math.PI / 2); deco.push([new THREE.CapsuleGeometry(0.008, 0.06, 4, 8), M4(O), OL]);
  }
  const eyesOpen = mergeVC([...eyes.map(([g, m]) => [g, m, OL] as [THREE.BufferGeometry, THREE.Matrix4, number]), ...whites.map(([g, m]) => [g, m, 0xffffff] as [THREE.BufferGeometry, THREE.Matrix4, number])]);
  const f: FaceGeo = { skin: merge(skin), eyesOpen, closed: merge(closed), deco: mergeVC(deco), smile, open, brows: merge(brows) };
  FACE.set(key, f);
  return f;
}

/* ---------------- 사람 ---------------- */
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
let CARD_G: THREE.BufferGeometry | null = null, SHOE_G: THREE.BufferGeometry | null = null, HAND_G: THREE.BufferGeometry | null = null;
let CUP: THREE.Group | null = null, IDCARD_G: THREE.BufferGeometry | null = null, BAG: THREE.Group | null = null, PHONE_G: THREE.BufferGeometry | null = null, BAR_G: THREE.BufferGeometry | null = null;

function cupProto(): THREE.Group {
  if (CUP) return CUP;
  const c = new THREE.Group();
  part(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 24), toon(0xffffff), c);
  const cof = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.005, 20), flat(0x8a5a35)); cof.position.y = 0.058; c.add(cof);
  const sl = part(new THREE.CylinderGeometry(0.051, 0.046, 0.045, 24), toon(0xc98b55), c); sl.position.y = -0.005;
  CUP = c;
  return c;
}
function bagProto(): THREE.Group {
  if (BAG) return BAG;
  const g = new THREE.Group();
  part(new RoundedBoxGeometry(0.3, 0.22, 0.08, 2, 0.03), toon(0x5a4636), g, 0, -0.14, 0);
  const h = part(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), toon(0x3d3130), g, 0, -0.03, 0);
  h.rotation.z = 0;
  BAG = g;
  return g;
}

export type Prop = 'cup' | 'card' | 'bag' | 'phone' | 'bar' | null;

export class Worker {
  readonly root = new THREE.Group();
  /** 엉덩이(y=.3)를 축으로 숙이는 윗몸 */
  readonly body = new THREE.Group();
  readonly head = new THREE.Group();
  readonly anim: Animator;
  readonly look: Required<Pick<Look, 'sex'>> & Look;
  private torsoU: TorsoU;
  private suitM: THREE.MeshStandardMaterial;
  private pantsM: THREE.MeshStandardMaterial;
  private arms: { L: Limb; R: Limb };
  private legs: { L: Limb; R: Limb };
  readonly hands: { L: THREE.Mesh; R: THREE.Mesh };
  private shoes: { L: THREE.Mesh; R: THREE.Mesh };
  private eyesOpen: THREE.Mesh[];
  private eyesClosed: THREE.Mesh;
  private mouthSmile: THREE.Mesh;
  private mouthOpen: THREE.Mesh;
  private propObj: THREE.Object3D | null = null;
  prop: Prop = null;
  /** 말하는 중(입 열고 닫기) */
  talking = 0;
  /** 평소 입 모양(true=벌림) */
  mouthDefault = false;
  private blinkT = 2 + Math.random() * 3;
  private hairHi!: THREE.Mesh;
  private hairLo!: THREE.Mesh;
  private far = false;
  /** 늘 촘촘한 머리(얼굴 그림·선택 화면) */
  hiRes = false;
  private talkT = 0;

  constructor(o: Look = {}) {
    this.look = { sex: 'm', suit: 'navy', ...o };
    const L = this.look;
    const suitC = typeof L.suit === 'number' ? L.suit : SUITS[L.suit ?? 'navy'];
    const shoeM = toon(0x3d3130), skin = skinMat();
    this.suitM = toon(suitC);
    this.pantsM = toon(new THREE.Color(suitC).multiplyScalar(0.82).getHex());
    const g = this.root;
    this.body.position.y = 0.3;
    g.add(this.body);
    const B = new THREE.Group(); B.position.y = -0.3; this.body.add(B);
    // 다리 + 구두
    if (!SHOE_G) SHOE_G = ellipsoid(0.088, 0.058, 0.125, 18, 12);
    this.legs = { L: new Limb(0.078, this.pantsM, g, 10, 12, true), R: new Limb(0.078, this.pantsM, g, 10, 12, true) };
    for (const k of ['L', 'R'] as const) if (this.legs[k].capB) this.legs[k].capB!.castShadow = false;
    this.shoes = { L: part(SHOE_G, shoeM, g, 0, 0, 0, false), R: part(SHOE_G, shoeM, g, 0, 0, 0, false) };
    // 몸통
    const t = torsoMat(suitC, L);
    this.torsoU = t.u;
    part(torsoGeo(), t.mat, B);
    // 사원증과 목줄
    if (L.card !== false) {
      if (!CARD_G) {
        const O = new THREE.Object3D(); O.position.set(-0.13, 0.4, 0.17); O.rotation.set(-0.08, -0.25, 0.05); O.updateMatrix();
        const cm = O.matrix.clone(), at = (x: number, y: number, z: number): THREE.Matrix4 => cm.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
        const lan = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.1, 0.66, 0.1), V(-0.13, 0.56, 0.155), V(-0.135, 0.46, 0.175)]), 12, 0.008, 6, false);
        // 사원증 + 파란 목줄을 하나로(띠·사진은 셰이딩이 거의 없어 보이게 밝은 색)
        CARD_G = mergeVC([[new RoundedBoxGeometry(0.085, 0.11, 0.012, 2, 0.012), cm, 0xffffff], [new THREE.PlaneGeometry(0.085, 0.025), at(0, 0.04, 0.0075), 0x1d2b4f], [new THREE.CircleGeometry(0.016, 16), at(0, 0.002, 0.0075), 0xf5c9b3], [lan, new THREE.Matrix4(), 0x4c8fe0]]);
      }
      part(CARD_G, VC_LIT, B, 0, 0, 0, false);
    }
    // 팔(이음매 없는 관) + 손(공)
    this.arms = { L: new Limb(0.066, this.suitM, B, 18, 14), R: new Limb(0.066, this.suitM, B, 18, 14) };
    if (!HAND_G) HAND_G = new THREE.SphereGeometry(0.068, 18, 12);
    this.hands = { L: part(HAND_G, skin, B), R: part(HAND_G, skin, B) };
    // 머리
    this.head.position.y = HC;
    B.add(this.head);
    const bald = !!L.bald, fem = L.sex === 'f';
    const face = faceFor(!fem, !!L.glasses);
    const H = this.head;
    part(face.skin, skin, H);
    const hairC = L.hairC ?? (fem ? HAIR_F : HAIR_M);
    part(face.brows, toon(hairC === HAIR_G ? 0x6d6a68 : hairC), H, 0, 0, 0, false);
    this.eyesOpen = [part(face.eyesOpen, VC_FLAT, H, 0, 0, 0, false)];
    this.eyesClosed = part(face.closed, flat(OL), H, 0, 0, 0, false);
    this.eyesClosed.visible = false;
    part(face.deco, VC_FLAT, H, 0, 0, 0, false);
    this.mouthSmile = part(face.smile, flat(0xb2524b), H, 0, 0, 0, false);
    this.mouthOpen = part(face.open, flat(0xc4574f), H, 0, 0, 0, false);
    this.mouthOpen.visible = false;
    const hk: HairKind = bald ? 'bald' : fem ? 'f' : 'm';
    this.hairHi = part(hairFor(hk), toon(hairC), H);
    this.hairLo = part(hairFor(hk, true), toon(hairC), H);
    this.hairLo.visible = false;
    this.anim = new Animator();
    this.root.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).receiveShadow = false; });
    this.update(0);
  }

  /** 정장 색 바꾸기(캐릭터 선택 화면) */
  setSuit(s: SuitName | number): void {
    const c = typeof s === 'number' ? s : SUITS[s];
    this.look.suit = s;
    this.torsoU.uSuit.value.set(c);
    this.torsoU.uDark.value.set(c).multiplyScalar(0.78);
    const sm = toon(c), pm = toon(new THREE.Color(c).multiplyScalar(0.82).getHex());
    this.suitM = sm; this.pantsM = pm;
    for (const k of ['L', 'R'] as const) {
      this.arms[k].mesh.material = sm;
      this.legs[k].mesh.material = pm; if (this.legs[k].capB) this.legs[k].capB!.material = pm;
    }
  }

  setOpacity(a: number): void {
    this.root.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const key = '__op';
      if (a >= 1) {
        const orig = mesh.userData[key] as THREE.Material | undefined;
        if (orig) { mesh.material = orig; delete mesh.userData[key]; }
        return;
      }
      if (!mesh.userData[key]) {
        mesh.userData[key] = mesh.material;
        const c = mats[0].clone(); c.transparent = true; c.depthWrite = true;
        // 몸통 셰이더도 그대로 쓰기
        (c as THREE.Material).onBeforeCompile = mats[0].onBeforeCompile;
        (c as THREE.Material).customProgramCacheKey = mats[0].customProgramCacheKey;
        mesh.material = c;
      }
      (mesh.material as THREE.Material).opacity = a;
    });
  }

  setPose(p: BasePose): void { this.anim.setBase(p); }
  play(a: Action, dur?: number): void { this.anim.play(a, dur); }
  setProp(p: Prop): void {
    if (this.prop === p) return;
    this.prop = p;
    if (this.propObj) { this.propObj.parent?.remove(this.propObj); this.propObj = null; }
    if (!p) return;
    let o: THREE.Object3D;
    if (p === 'cup') { o = cupProto().clone(); o.position.set(0, 0.055, 0.05); }
    else if (p === 'card') { if (!IDCARD_G) IDCARD_G = new RoundedBoxGeometry(0.11, 0.075, 0.012, 2, 0.012); o = part(IDCARD_G, toon(0xffffff), null); o.position.set(0.02, 0.04, 0.03); o.rotation.set(-0.3, 0.2, 0.3); }
    else if (p === 'bag') { o = bagProto().clone(); o.position.set(0, -0.02, 0); }
    else if (p === 'phone') { if (!PHONE_G) PHONE_G = new RoundedBoxGeometry(0.07, 0.13, 0.015, 2, 0.01); o = part(PHONE_G, toon(0x2b2e35), null); o.position.set(-0.01, 0.05, -0.02); o.rotation.set(0, 0.4, 0); }
    else { if (!BAR_G) BAR_G = new RoundedBoxGeometry(0.11, 0.035, 0.03, 2, 0.01); o = part(BAR_G, toon(0x6b3f2a), null); o.position.set(0, 0.03, 0.04); o.rotation.set(0, 0, 0.5); }
    this.propObj = o;
    (p === 'phone' ? this.hands.L : this.hands.R).add(o);
  }
  setMouth(open: boolean): void { this.mouthOpen.visible = open; this.mouthSmile.visible = !open; }
  setEyesClosed(c: boolean): void { this.eyesClosed.visible = c; for (const e of this.eyesOpen) e.visible = !c; }
  /** 말하는 동안(초) 입을 열고 닫음 */
  talk(sec: number): void { this.talking = sec; }

  update(dt: number): void {
    const far = !this.hiRes && this.root.position.distanceToSquared(LOD.cam) > LOD.far * LOD.far;
    if (far !== this.far) { this.far = far; this.hairHi.visible = !far; this.hairLo.visible = far; }
    const st = this.anim.update(dt);
    // 몸 숙이기, 위아래
    this.body.rotation.x = st.bow;
    this.body.rotation.z = st.lean;
    this.body.position.y = 0.3 + st.bob;
    this.head.rotation.set(st.headX, st.headY, st.headZ);
    for (const k of ['L', 'R'] as const) {
      const s = k === 'L' ? -1 : 1, a = st.arms[k];
      const sh = _v1.set(s * 0.1, 0.56, 0), el = a.el, wr = a.wr;
      const dir = _v2.subVectors(wr, el).normalize();
      const cuff = _v3.copy(wr).addScaledVector(dir, -0.045);
      const mid = _v4.set(s * 0.23, 0.57, 0).lerp(el, 0.25);
      this.arms[k].update([sh, mid, el, cuff]);
      this.hands[k].position.copy(wr);
      const l = st.legs[k];
      this.legs[k].update(l.pts);
      this.shoes[k].position.copy(l.shoe);
      this.shoes[k].rotation.x = l.shoeRot;
    }
    // 눈 깜빡임, 말하기
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkT = 2.5 + Math.random() * 3; }
    const blink = this.blinkT < 0.12 || st.eyesClosed;
    this.setEyesClosed(blink);
    if (this.talking > 0) {
      this.talking -= dt; this.talkT += dt;
      this.setMouth(this.talking > 0 && Math.sin(this.talkT * 16) > -0.2);
    } else this.setMouth(st.mouthOpen ?? this.mouthDefault);
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
export { SKIN };
