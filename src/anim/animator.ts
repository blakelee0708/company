// 동작 엔진: 기본 자세(서기·걷기·앉기·타자) + 윗몸 동작(손 흔들기·손짓·카드 찍기·박수·인사·마시기·건배·기지개·통화).
// 자세는 toon.js의 정지 자세(팔꿈치·손목 위치)를 기준점으로 쓰고, 그 사이를 부드럽게 섞는다.
import * as THREE from 'three';

export type BasePose = 'stand' | 'walk' | 'sit' | 'sitType';
export type Action = 'wave' | 'beckon' | 'card' | 'clap' | 'point' | 'cheers' | 'drink' | 'bow' | 'nod' | 'stretch' | 'phone' | 'shrug';

interface ArmT { el: THREE.Vector3; wr: THREE.Vector3 }
interface LegT { pts: THREE.Vector3[]; shoe: THREE.Vector3; shoeRot: number }
export interface AnimState {
  arms: { L: ArmT; R: ArmT };
  legs: { L: LegT; R: LegT };
  bow: number; lean: number; bob: number;
  headX: number; headY: number; headZ: number;
  eyesClosed: boolean;
  mouthOpen: boolean | null;
}

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const mk = (): ArmT => ({ el: V(0, 0, 0), wr: V(0, 0, 0) });
const lerp = THREE.MathUtils.lerp;
const ease = (t: number): number => t * t * (3 - 2 * t);

/** 한 동작이 정하는 것 */
interface ActDef {
  dur: number; // 초(Infinity면 멈출 때까지)
  L?: (t: number, a: ArmT) => void;
  R?: (t: number, a: ArmT) => void;
  body?: (t: number, s: AnimState) => void;
  eyes?: boolean;
  mouth?: boolean;
}
const set = (a: ArmT, ex: number, ey: number, ez: number, wx: number, wy: number, wz: number): void => { a.el.set(ex, ey, ez); a.wr.set(wx, wy, wz); };

export const ACTIONS: Record<Action, ActDef> = {
  // 손 흔들기: 오른손을 얼굴 옆으로 들어 좌우로
  wave: { dur: 1.6, mouth: true, R: (t, a) => set(a, 0.38, 0.66, 0.03, 0.44 + 0.05 * Math.sin(t * 11), 0.88, 0.05), body: (_t, s) => { s.headZ = -0.06; } },
  // 손짓(이리 와): 손을 앞으로 내밀었다 몸 쪽으로 당김
  beckon: { dur: Infinity, mouth: true, R: (t, a) => { const k = 0.5 + 0.5 * Math.sin(t * 8); set(a, 0.36, 0.5, 0.14, 0.36, 0.72 - 0.04 * k, 0.2 + 0.08 * (1 - k)); } },
  // 카드 찍기: 오른손을 앞으로 뻗어 리더기에 댐
  card: { dur: 1.1, R: (_t, a) => set(a, 0.32, 0.5, 0.16, 0.36, 0.53, 0.36) },
  // 박수: 두 손이 가운데에서 만남
  clap: { dur: 2.0, eyes: true, mouth: true,
    L: (t, a) => { const d = 0.05 * (0.5 + 0.5 * Math.sin(t * 15)); set(a, -0.24, 0.42, 0.17, -0.04 - d, 0.5, 0.26); },
    R: (t, a) => { const d = 0.05 * (0.5 + 0.5 * Math.sin(t * 15)); set(a, 0.24, 0.42, 0.17, 0.04 + d, 0.5, 0.26); } },
  // 말하며 가리키기
  point: { dur: 2.2, mouth: true, R: (t, a) => set(a, 0.36, 0.53, 0.12, 0.52, 0.58 + 0.02 * Math.sin(t * 5), 0.22) },
  // 건배: 컵을 높이 들어 앞으로
  cheers: { dur: 1.6, mouth: true, R: (t, a) => { const k = Math.min(1, t / 0.5); set(a, 0.36, 0.58, 0.1, 0.4 - 0.08 * Math.sin(Math.min(1, Math.max(0, (t - 0.5) / 0.4)) * Math.PI), 0.78, 0.16 + 0.08 * k); }, body: (_t, s) => { s.headZ = -0.06; } },
  // 마시기: 컵을 입으로(손이 얼굴을 뚫지 않게 앞에서 멈춤)
  drink: { dur: 2.2, eyes: true, R: (_t, a) => set(a, 0.3, 0.5, 0.2, 0.09, 0.69, 0.4), body: (t, s) => { s.headX = -0.12 * Math.sin(Math.min(1, t / 0.6) * Math.PI / 2); } },
  // 인사(고개 숙이기)
  bow: { dur: 1.3, body: (t, s) => { const k = Math.sin(Math.min(1, t / 1.3) * Math.PI); s.bow = 0.42 * k; s.headX = 0.12 * k; } },
  // 고개 끄덕이기
  nod: { dur: 0.9, body: (t, s) => { s.headX = 0.16 * Math.max(0, Math.sin(t * 7)); } },
  // 기지개: 두 팔을 옆으로 쭉
  stretch: { dur: 2.2, eyes: true, mouth: true,
    L: (_t, a) => set(a, -0.38, 0.66, 0, -0.5, 0.84, 0), R: (_t, a) => set(a, 0.38, 0.66, 0, 0.5, 0.84, 0),
    body: (t, s) => { s.bow = -0.12 * Math.sin(Math.min(1, t / 2.2) * Math.PI); } },
  // 통화: 왼손을 귀 옆에(머리를 뚫지 않게 바깥쪽)
  phone: { dur: Infinity, mouth: false, L: (_t, a) => set(a, -0.36, 0.6, 0.06, -0.47, 0.82, 0.1), body: (t, s) => { s.headZ = 0.08; s.headY = 0.15 * Math.sin(t * 0.7); } },
  // 어깨 으쓱(가벼운 몸짓)
  shrug: { dur: 1.0, L: (_t, a) => set(a, -0.32, 0.47, 0.08, -0.3, 0.42, 0.22), R: (_t, a) => set(a, 0.32, 0.47, 0.08, 0.3, 0.42, 0.22) },
};

export class Animator {
  base: BasePose = 'stand';
  /** 0=서 있음, 1=앉음 */
  sitW = 0;
  /** 걷는 속도(m/s, 캐릭터 크기 기준) */
  speed = 0;
  /** 컵 들고 있음 */
  carry = false;
  /** 고개 돌리기(라디안) */
  lookYaw = 0;
  private yaw = 0;
  private phase = Math.random() * 10;
  private t = Math.random() * 10;
  private act: Action | null = null;
  private actT = 0;
  private actDur = 0;
  private actW = 0;
  private stopping = false;
  private readonly st: AnimState = {
    arms: { L: mk(), R: mk() },
    legs: { L: { pts: [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)], shoe: V(0, 0, 0), shoeRot: 0 }, R: { pts: [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)], shoe: V(0, 0, 0), shoeRot: 0 } },
    bow: 0, lean: 0, bob: 0, headX: 0, headY: 0, headZ: 0, eyesClosed: false, mouthOpen: null,
  };
  private readonly tmpA = mk();
  private readonly tmpB = mk();

  setBase(p: BasePose): void { this.base = p; }
  get action(): Action | null { return this.act; }
  play(a: Action, dur?: number): void {
    this.act = a; this.actT = 0; this.actDur = dur ?? ACTIONS[a].dur; this.stopping = false;
    if (this.actW > 0.6) this.actW = 0.6;
  }
  stop(): void { if (this.act) this.stopping = true; }

  update(dt: number): AnimState {
    const s = this.st;
    this.t += dt;
    const sitting = this.base === 'sit' || this.base === 'sitType';
    this.sitW = THREE.MathUtils.clamp(this.sitW + (sitting ? dt : -dt) / 0.45, 0, 1);
    const sw = ease(this.sitW);
    const moving = this.base === 'walk' && this.sitW === 0;
    const sp = moving ? Math.max(0.6, this.speed) : 0;
    this.phase += dt * sp * 7.5;
    const ph = this.phase;
    const wk = moving ? 1 : 0;
    // 다리
    for (const k of ['L', 'R'] as const) {
      const sg = k === 'L' ? -1 : 1, L = s.legs[k];
      const swing = wk * Math.sin(ph + (sg > 0 ? 0 : Math.PI));
      const fz = 0.1 * swing, lift = wk * 0.045 * Math.max(0, Math.cos(ph + (sg > 0 ? 0 : Math.PI)));
      // 서기/걷기
      const hipS = _a.set(sg * 0.09, 0.3, 0), ankS = _b.set(sg * 0.09, 0.13 + lift, fz);
      const midS = _c.copy(hipS).lerp(ankS, 0.5);
      // 앉기
      const hipT = _d.set(sg * 0.09, 0.3, 0), kneeT = _e.set(sg * 0.09, 0.3, 0.3), ankT = _f.set(sg * 0.09, 0.08, 0.32);
      L.pts[0].copy(hipS).lerp(hipT, sw);
      L.pts[1].copy(midS).lerp(kneeT, sw);
      L.pts[2].copy(ankS).lerp(ankT, sw);
      L.shoe.set(sg * 0.09, lerp(0.078 + lift, 0.07, sw), lerp(fz + 0.04, 0.37, sw));
      L.shoeRot = -0.35 * wk * Math.max(0, Math.cos(ph + (sg > 0 ? 0 : Math.PI))) * (1 - sw);
    }
    // 기본 팔
    const typing = this.base === 'sitType';
    for (const k of ['L', 'R'] as const) {
      const sg = k === 'L' ? -1 : 1, a = s.arms[k];
      const sw2 = wk * Math.sin(ph + (sg > 0 ? Math.PI : 0));
      a.el.set(sg * 0.3, 0.45, 0.02 + 0.06 * sw2);
      a.wr.set(sg * (0.33 - 0.02 * wk), 0.3 + 0.015 * wk, 0.03 + 0.11 * sw2);
      if (sw > 0) {
        const tp = typing ? 0.016 * Math.max(0, Math.sin(this.t * 17 + (sg > 0 ? 0 : 1.7))) : 0;
        const ex = sg * 0.27, ey = 0.42, ez = 0.16, wx = sg * 0.17, wy = typing ? 0.42 + tp : 0.36, wz = typing ? 0.32 : 0.28;
        a.el.lerp(_a.set(ex, ey, ez), sw);
        a.wr.lerp(_b.set(wx, wy, wz), sw);
      }
      if (k === 'R' && this.carry && sw < 1) {
        a.el.lerp(_a.set(0.27, 0.42, 0.16), 1 - sw);
        a.wr.lerp(_b.set(0.14, 0.47, 0.27), 1 - sw);
      }
    }
    s.bow = 0; s.lean = 0; s.headX = 0; s.headZ = 0;
    s.bob = moving ? 0.018 * Math.abs(Math.sin(ph)) : 0;
    // 숨쉬기(아주 작게)
    s.bob += 0.004 * Math.sin(this.t * 2.2);
    if (typing) s.headX = 0.06;
    this.yaw += (this.lookYaw - this.yaw) * Math.min(1, dt * 6);
    s.headY = this.yaw;
    s.eyesClosed = false;
    s.mouthOpen = null;
    // 윗몸 동작
    if (this.act) {
      const d = ACTIONS[this.act];
      this.actT += dt;
      if (this.actT >= this.actDur) this.stopping = true;
      this.actW = THREE.MathUtils.clamp(this.actW + (this.stopping ? -dt / 0.25 : dt / 0.18), 0, 1);
      const w = ease(this.actW);
      if (d.L) { d.L(this.actT, this.tmpA); s.arms.L.el.lerp(this.tmpA.el, w); s.arms.L.wr.lerp(this.tmpA.wr, w); }
      if (d.R) { d.R(this.actT, this.tmpB); s.arms.R.el.lerp(this.tmpB.el, w); s.arms.R.wr.lerp(this.tmpB.wr, w); }
      if (d.body) {
        const keep = { bow: s.bow, headX: s.headX, headY: s.headY, headZ: s.headZ };
        d.body(this.actT, s);
        s.bow = lerp(keep.bow, s.bow, w); s.headX = lerp(keep.headX, s.headX, w); s.headY = lerp(keep.headY, s.headY, w); s.headZ = lerp(keep.headZ, s.headZ, w);
      }
      if (d.eyes && w > 0.5 && this.act !== 'drink') s.eyesClosed = true;
      if (this.act === 'drink' && this.actT > 0.6 && this.actT < 1.7) s.eyesClosed = true;
      if (d.mouth !== undefined && w > 0.5) s.mouthOpen = d.mouth;
      if (this.stopping && this.actW === 0) { this.act = null; this.stopping = false; }
    }
    return s;
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3();
