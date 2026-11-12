// 장면 속 사람 하나: 캐릭터 + 걷기(길 따라) + 앉기 + 말풍선.
import * as THREE from 'three';
import { Worker, type Look } from '../character/worker';
import { SC } from '../character/presets';
import type { NavGrid, Pt } from './nav';
import type { Stage } from '../core/stage';
import { h } from '../ui/dom';
import { WALK_SPEED } from '../shared/consts';

export interface Seat { idx: number; x: number; z: number; ry: number; chair: THREE.Group | null; team: number; kind: 'staff' | 'boss' | 'mgr' }
export type Kind = 'me' | 'peer' | 'boss' | 'mgr' | 'staff' | 'extra';

let uid = 0;
export class Actor {
  readonly w: Worker;
  id: string;
  name: string;
  kind: Kind;
  speed = WALK_SPEED;
  path: Pt[] = [];
  private onArrive: (() => void) | null = null;
  seat: Seat | null = null;
  sitting = false;
  /** 바라볼 방향(라디안) */
  yaw = 0;
  private yawT = 0;
  private bubble: { el: HTMLElement; off: () => void; t: number } | null = null;
  private tagOff: (() => void) | null = null;
  private extraOff: Array<() => void> = [];
  busy = false;
  data: Record<string, unknown> = {};
  /** 다른 사람 동기화용 목표 위치 */
  net: { x: number; z: number; yaw: number } | null = null;
  constructor(look: Look, kind: Kind, name = '', public scale = SC) {
    this.w = new Worker(look);
    this.w.root.scale.setScalar(scale);
    this.w.root.traverse((m) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = false; } });
    this.w.root.userData.actor = this;
    this.kind = kind;
    this.name = name;
    this.id = kind + ':' + uid++;
  }
  get pos(): THREE.Vector3 { return this.w.root.position; }
  setScale(s: number): this { this.scale = s; this.w.root.scale.setScalar(s); return this; }
  place(x: number, z: number, yaw = this.yaw): this { this.pos.set(x, 0, z); this.yaw = this.yawT = yaw; this.w.root.rotation.y = yaw; return this; }
  addTo(scene: THREE.Object3D): this { scene.add(this.w.root); return this; }
  /** 머리 위 점 */
  top(): THREE.Vector3 { const p = this.pos; return new THREE.Vector3(p.x, p.y + 1.45 * this.scale + 0.12, p.z); }
  faceTo(x: number, z: number): void { this.yawT = Math.atan2(x - this.pos.x, z - this.pos.z); }
  faceYaw(y: number): void { this.yawT = y; }
  dist(x: number, z: number): number { return Math.hypot(x - this.pos.x, z - this.pos.z); }

  /** nav 위에서 (x,z)까지 걸어감 */
  goTo(nav: NavGrid | null, x: number, z: number, onArrive?: () => void): boolean {
    if (this.sitting) return false;
    const p = nav ? nav.path({ x: this.pos.x, z: this.pos.z }, { x, z }) : [{ x, z }];
    if (!p || !p.length) return false;
    this.path = p;
    this.onArrive = onArrive ?? null;
    this.w.setPose('walk');
    return true;
  }
  /** 길 없이 곧장 걸어감(연출) */
  walkStraight(pts: Pt[], onArrive?: () => void): void { this.path = pts.slice(); this.onArrive = onArrive ?? null; this.w.setPose('walk'); }
  stopWalk(): void { this.path = []; this.onArrive = null; if (!this.sitting) this.w.setPose('stand'); }
  get walking(): boolean { return this.path.length > 0; }

  /** 자리에 앉기(이미 자리 앞에 있다고 가정) */
  sitAt(seat: Seat, typing = true): void {
    this.seat = seat;
    this.sitting = true;
    this.path = [];
    this.pos.x = seat.x; this.pos.z = seat.z;
    this.yawT = seat.ry;
    this.w.setPose(typing ? 'sitType' : 'sit');
    if (seat.chair) pullChair(seat);
  }
  standUp(): void {
    if (!this.sitting) return;
    this.sitting = false;
    const s = this.seat!;
    // 의자 앞쪽으로 반 걸음 비켜 섬
    this.pos.x = s.x + Math.sin(s.ry) * -0.15;
    this.pos.z = s.z + Math.cos(s.ry) * -0.15;
    this.w.setPose('stand');
    if (s.chair) pullChair(s);
  }
  leaveSeat(): void { this.seat = null; }

  update(dt: number): void {
    // 걷기
    if (this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) {
        this.pos.x = t.x; this.pos.z = t.z; this.path.shift();
        if (!this.path.length) { this.w.setPose('stand'); const f = this.onArrive; this.onArrive = null; f?.(); }
      } else {
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        this.yawT = Math.atan2(dx, dz);
      }
      this.w.anim.speed = Math.min(2.2, (this.speed / this.scale) * 0.85);
    } else if (this.net) {
      // 다른 사람: 받은 위치로 부드럽게
      const dx = this.net.x - this.pos.x, dz = this.net.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 4) { this.pos.x = this.net.x; this.pos.z = this.net.z; }
      else if (d > 0.04 && !this.sitting) {
        const step = Math.min(d, Math.max(WALK_SPEED, d * 3) * dt);
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        this.yawT = Math.atan2(dx, dz);
        if (this.w.anim.base !== 'walk') this.w.setPose('walk');
        this.w.anim.speed = Math.min(2.2, (WALK_SPEED / this.scale) * 0.85);
      } else if (!this.sitting) {
        if (this.w.anim.base === 'walk') this.w.setPose('stand');
        this.yawT = this.net.yaw;
      }
    }
    // 방향
    let dy = this.yawT - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 10);
    this.w.root.rotation.y = this.yaw;
    // 앉은 높이
    this.pos.y = this.w.anim.sitW * (0.5 - 0.3 * this.scale);
    this.w.update(dt);
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) { this.bubble.off(); this.bubble = null; } }
  }

  /** 말풍선 */
  say(stage: Stage, text: string, sec = 3, big = false): void {
    if (this.bubble) this.bubble.off();
    const el = h('div', { class: 'bub3' + (big ? ' big' : '') + (text.length > 18 ? ' wrap' : '') }, text);
    const off = stage.anchor(el, () => this.top(), -8);
    this.bubble = { el, off, t: sec };
    this.w.talk(Math.min(sec, 0.12 * text.length + 0.4));
  }
  hush(): void { if (this.bubble) { this.bubble.off(); this.bubble = null; } }
  tag(stage: Stage, text: string): void {
    this.tagOff?.();
    const el = h('div', { class: 'tag3' }, text);
    this.tagOff = stage.anchor(el, () => (this.bubble ? null : this.top()), -4);
  }
  untag(): void { this.tagOff?.(); this.tagOff = null; }
  /** 머리 위 체크(2초) */
  check(stage: Stage): void {
    const el = h('div', { class: 'check3' }, '✓');
    const off = stage.anchor(el, () => { const p = this.top(); p.y += 0.25; return p; }, -4);
    this.extraOff.push(off);
    setTimeout(off, 2000);
  }
  dispose(): void { this.hush(); this.untag(); for (const f of this.extraOff) f(); this.w.root.parent?.remove(this.w.root); }
}

/** 의자를 살짝 뺐다가 넣음 */
function pullChair(seat: Seat): void {
  const c = seat.chair!;
  const base = c.userData.base as THREE.Vector3 | undefined ?? (c.userData.base = c.position.clone());
  const back = new THREE.Vector3(Math.sin(seat.ry), 0, Math.cos(seat.ry)).multiplyScalar(-0.3);
  const t0 = performance.now();
  const step = (): void => {
    const k = Math.min(1, (performance.now() - t0) / 700);
    const e = Math.sin(k * Math.PI);
    c.position.copy(base).addScaledVector(back, e);
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}
