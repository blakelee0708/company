// 렌더러 하나 + 현재 장면 + 따라다니는 카메라 + 3D 위 글자(HTML) + 입력.
import * as THREE from 'three';
import { renderer, lightUp, type LightOpts } from './render';
import { isPC } from '../ui/dom';
import { LOD } from '../character/worker';

export interface CamPreset { fov: number; up: number; back: number; ahead: number; tgtY: number }
export interface World {
  scene: THREE.Scene;
  light: LightOpts;
  cam: { phone: CamPreset; pc: CamPreset } | null;
  /** 카메라가 따라갈 점 */
  focus?(): THREE.Vector3;
  /** 카메라를 가리면 반투명하게 할 것들 */
  occluders?: THREE.Object3D[];
  /** 카메라 기본 방향(라디안, 0 = -z를 봄) */
  yaw?: number;
  update(dt: number, t: number): void;
  onTap?(ray: THREE.Raycaster, ev: { x: number; y: number }): void;
  onKey?(dir: THREE.Vector2, dt: number): void;
  minZoom?: number; maxZoom?: number;
}

interface Anchor { el: HTMLElement; get: () => THREE.Vector3 | null; dy: number; hideBehind?: boolean }

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly r: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 300);
  readonly labels: HTMLElement;
  world: World | null = null;
  W = 1; H = 1;
  pc = false;
  /** 사용자가 돌린 양 */
  yawOff = 0; pitchOff = 0; zoom = 1;
  /** 장면 기본 방향(부드럽게 바뀜) */
  private baseYaw = 0;
  private targetBaseYaw = 0;
  private camPos = new THREE.Vector3();
  private camTgt = new THREE.Vector3();
  private snap = true;
  /** 고정 카메라/연출용 */
  override: { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number } | null = null;
  private tween: { from: { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number }; to: () => { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number }; t: number; dur: number; done?: () => void } | null = null;
  private anchors = new Set<Anchor>();
  private faded = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private ray = new THREE.Raycaster();
  private last = performance.now();
  private t = 0;
  keys = new Set<string>();
  onFrame: ((dt: number) => void) | null = null;
  inputEnabled = true;
  /** 3D가 뒤에 흐릿하게만 보일 때(PC 창·게시판·퇴근 카드) 그리기를 줄임 */
  lowPower = false;
  private mobile = false;
  private shadowTick = 0;
  private skip = 0;
  fps = 60;
  private fpsAcc = 0; private fpsN = 0;

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'gl';
    host.prepend(this.canvas);
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    this.r = renderer(this.canvas, 1, 1, { pixelRatio: Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2) });
    // 폰: 그림자는 두 프레임에 한 번만 다시 그림(움직임은 그대로 부드럽게)
    this.mobile = mobile;
    if (mobile) this.r.shadowMap.autoUpdate = false;
    this.labels = document.createElement('div');
    this.labels.className = 'labels';
    host.append(this.labels);
    this.resize();
    LOD.far = 11;
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize(): void {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.r.setSize(this.W, this.H, false);
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
    const pc = isPC();
    if (pc !== this.pc) { this.pc = pc; document.body.classList.toggle('pc-mode', pc); this.snap = true; }
  }

  setWorld(w: World, opts: { keepView?: boolean } = {}): void {
    if (this.world && this.world.scene !== w.scene) this.restoreFaded();
    this.world = w;
    if (!w.scene.userData.lit) { lightUp(this.r, w.scene, { shadowSize: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 1024 : 2048, ...w.light }); w.scene.userData.lit = true; }
    if (!opts.keepView) { this.yawOff = 0; this.pitchOff = 0; this.zoom = 1; }
    this.baseYaw = this.targetBaseYaw = w.yaw ?? 0;
    this.snap = true;
    this.override = null;
    this.tween = null;
  }
  setBaseYaw(y: number): void { this.targetBaseYaw = y; }
  resetView(): void { this.yawOff = 0; this.pitchOff = 0; this.zoom = 1; }

  /** 가로 화면(PC·눕힌 폰)이면 넓게 보는 카메라 */
  preset(): CamPreset | null { const c = this.world?.cam; return c ? (this.W > this.H * 1.05 ? c.pc : c.phone) : null; }

  /** 따라가는 카메라 위치 계산 */
  followView(out: { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number }): boolean {
    const p = this.preset(), w = this.world;
    if (!p || !w?.focus) return false;
    const f = w.focus();
    const yaw = this.baseYaw + this.yawOff;
    const dist = Math.hypot(p.up, p.back) * this.zoom;
    const el = THREE.MathUtils.clamp(Math.atan2(p.up, p.back) + this.pitchOff, 0.12, 1.45);
    const up = Math.sin(el) * dist, back = Math.cos(el) * dist;
    const sx = Math.sin(yaw), cz = Math.cos(yaw);
    out.pos.set(f.x + sx * back, f.y + up, f.z + cz * back);
    const ah = p.ahead * Math.min(1.15, this.zoom);
    out.tgt.set(f.x - sx * ah, f.y + p.tgtY, f.z - cz * ah);
    out.fov = p.fov;
    return true;
  }

  /** from(지금 카메라) → to()로 dur초 동안 이동 */
  tweenTo(to: () => { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number }, dur: number): Promise<void> {
    return new Promise((res) => {
      this.tween = { from: { pos: this.camPos.clone(), tgt: this.camTgt.clone(), fov: this.camera.fov }, to, t: 0, dur, done: res };
    });
  }
  setFixed(pos: THREE.Vector3, tgt: THREE.Vector3, fov: number): void { this.override = { pos, tgt, fov }; this.snap = true; }
  clearFixed(): void { this.override = null; }

  private frame(dt: number): void {
    const w = this.world;
    if (!w) return;
    // 키보드 이동
    if (w.onKey && this.inputEnabled) {
      const d = new THREE.Vector2((this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0), (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0));
      if (d.lengthSq() > 0) { d.normalize().rotateAround(new THREE.Vector2(), -(this.baseYaw + this.yawOff)); w.onKey(d, dt); }
    }
    LOD.cam.copy(this.camera.position);
    w.update(dt, this.t);
    this.onFrame?.(dt);
    this.baseYaw += (this.targetBaseYaw - this.baseYaw) * Math.min(1, dt * 3);
    // 카메라
    const v = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: this.camera.fov };
    let have = false;
    if (this.override) { v.pos.copy(this.override.pos); v.tgt.copy(this.override.tgt); v.fov = this.override.fov; have = true; }
    else have = this.followView(v);
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur), e = k * k * (3 - 2 * k), to = tw.to();
      v.pos.copy(tw.from.pos).lerp(to.pos, e); v.tgt.copy(tw.from.tgt).lerp(to.tgt, e); v.fov = THREE.MathUtils.lerp(tw.from.fov, to.fov, e);
      this.camPos.copy(v.pos); this.camTgt.copy(v.tgt);
      have = true;
      if (k >= 1) { this.tween = null; tw.done?.(); }
    } else if (have) {
      if (this.snap) { this.camPos.copy(v.pos); this.camTgt.copy(v.tgt); this.snap = false; }
      else { const a = 1 - Math.exp(-dt * 8); this.camPos.lerp(v.pos, a); this.camTgt.lerp(v.tgt, a); }
    }
    if (have) {
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camTgt);
      if (Math.abs(this.camera.fov - v.fov) > 0.01) { this.camera.fov = v.fov; this.camera.updateProjectionMatrix(); }
    }
    this.camera.updateMatrixWorld();
    if (this.lowPower && (this.skip = (this.skip + 1) % 3) !== 0) { this.updateLabels(); return; }
    this.fadeOccluders();
    if (this.mobile) { this.shadowTick ^= 1; if (this.shadowTick) this.r.shadowMap.needsUpdate = true; }
    this.r.render(w.scene, this.camera);
    this.updateLabels();
  }

  /** 카메라와 나 사이를 가리는 칸막이·벽을 반투명(0.25)하게 */
  private fadeOccluders(): void {
    const w = this.world!;
    if (!w.occluders || !w.focus) return;
    const f = w.focus().clone(); f.y += 0.9;
    const from = this.camera.position, dir = f.clone().sub(from), len = dir.length();
    this.ray.set(from, dir.normalize()); this.ray.far = len;
    const hits = new Set<THREE.Mesh>();
    for (const o of this.ray.intersectObjects(w.occluders, false)) hits.add(o.object as THREE.Mesh);
    // 발밑도 확인(키 작은 몸이 칸막이에 가려질 때)
    const f2 = w.focus().clone(); f2.y += 0.3;
    const d2 = f2.clone().sub(from), l2 = d2.length();
    this.ray.set(from, d2.normalize()); this.ray.far = l2;
    for (const o of this.ray.intersectObjects(w.occluders, false)) hits.add(o.object as THREE.Mesh);
    for (const [m, orig] of this.faded) if (!hits.has(m)) { m.material = orig; this.faded.delete(m); }
    for (const m of hits) {
      if (this.faded.has(m)) continue;
      this.faded.set(m, m.material);
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      const c = src.clone(); c.transparent = true; c.opacity = 0.25; c.depthWrite = false;
      m.material = c;
    }
  }
  private restoreFaded(): void { for (const [m, orig] of this.faded) m.material = orig; this.faded.clear(); }

  /* ---------- 3D 위 글자 ---------- */
  anchor(el: HTMLElement, get: () => THREE.Vector3 | null, dy = 0): () => void {
    const a: Anchor = { el, get, dy };
    this.labels.append(el);
    this.anchors.add(a);
    el.style.visibility = 'hidden';
    return () => { this.anchors.delete(a); el.remove(); };
  }
  private updateLabels(): void {
    const v = new THREE.Vector3();
    for (const a of this.anchors) {
      const p = a.get();
      if (!p) { a.el.style.visibility = 'hidden'; continue; }
      v.copy(p).project(this.camera);
      if (v.z > 1 || v.z < -1) { a.el.style.visibility = 'hidden'; continue; }
      const x = ((v.x + 1) / 2) * this.W, y = ((1 - v.y) / 2) * this.H;
      a.el.style.visibility = 'visible';
      a.el.style.transform = `translate(${x}px,${y + a.dy}px) translate(-50%,-100%)`;
    }
  }
  project(p: THREE.Vector3): { x: number; y: number; vis: boolean } {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.W, y: ((1 - v.y) / 2) * this.H, vis: v.z < 1 };
  }

  /* ---------- 입력 ---------- */
  private bindInput(): void {
    const c = this.canvas;
    const pts = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
    let pinch0 = 0, zoom0 = 1, moved = false;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (pts.size === 1) moved = false;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = this.zoom; moved = true; }
    });
    c.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) moved = true;
      if (!this.preset() || this.override) return;
      if (pts.size === 1 && moved) {
        this.yawOff -= dx * 0.006;
        this.pitchOff = THREE.MathUtils.clamp(this.pitchOff + dy * 0.004, -0.7, 0.6);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) this.zoom = THREE.MathUtils.clamp(zoom0 * (pinch0 / d), this.world?.minZoom ?? 0.45, this.world?.maxZoom ?? 1.7);
      }
    });
    const up = (e: PointerEvent): void => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (!p || moved || pts.size) return;
      if (performance.now() - p.t > 600) return;
      this.tap(e.clientX, e.clientY);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
    c.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.preset()) return; this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.1), this.world?.minZoom ?? 0.45, this.world?.maxZoom ?? 1.7); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  tap(x: number, y: number): void {
    if (!this.inputEnabled || !this.world?.onTap) return;
    const ndc = new THREE.Vector2((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    this.ray.far = Infinity;
    this.world.onTap(this.ray, { x, y });
  }
}
