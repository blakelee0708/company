// 부서 사무실에서 일어나는 모든 일: 걷기, 앉기, PC 창, 부장·과장(말 걸기·결재·칭찬), NPC 사원, 탕비실, 게시판, 같이 출근하는 사람들.
import * as THREE from 'three';
import type { Game } from '../game';
import type { World, CamPreset } from '../core/stage';
import { buildOffice, OFFICE, type OfficeBuilt } from '../world/office';
import { Actor, type Seat } from '../world/actor';
import { Superior } from '../npc/boss';
import { StaffNpc } from '../npc/staff';
import { BOSS, MGR_F, MGR_M } from '../character/presets';
import { DEPTS, NPC_BASE, NPC_LEAVE_SEC } from '../shared/consts';
import { npcSwapStep } from '../shared/npcRule';
import { mulberry32, pick, between, shuffle } from '../shared/rand';
import { h, $ui, toast, wait } from '../ui/dom';
import { bigBtn, rowBtns } from '../ui/hud';
import { PcWindow } from '../ui/pc';
import { openDialog, dialogOpen, closeDialog, type DlgChoice } from '../ui/dialog';
import { portrait } from '../character/portrait';
import { openBoard, LocalBoard, renderNotes, type BoardSource } from '../ui/board';
import { sfx } from '../core/sound';
import { randomLook } from '../npc/looks';
import {
  GREET, NUDGE, NO_TODO, PRAISE, PRAISE_ALL, APPROVE_MGR, APPROVE_BOSS, COMFORT, STANDUP, WALK, IGNORED, BYE, LUNCH, EVENING,
  STAFF_YIELD, STAFF_OUT, STAFF_DECLINE, STAFF_ACCEPT, DEFAULT_CHOICES, BOARD_SEED, pickLine, fillLine, type Line, type Choice,
} from '../npc/lines';
import type { Look } from '../character/worker';
import type { PeerPub, EvKind } from '../shared/protocol';
import type { SuitKey } from '../shared/consts';

const FAST = new URLSearchParams(location.search).has('fast') ? 12 : 1;
type Mode = 'walk' | 'sit' | 'pc' | 'busy';
export interface PeerInfo { id: string; name: string; look: Look }

const SEATED_CAM: { phone: CamPreset; pc: CamPreset } = { phone: { fov: 54, up: 2.9, back: 3.3, ahead: 1.8, tgtY: 0.8 }, pc: { fov: 46, up: 4.6, back: 5.6, ahead: 2.2, tgtY: 0.6 } };
const WALK_CAM: { phone: CamPreset; pc: CamPreset } = { phone: { fov: 54, up: 8.2, back: 9.1, ahead: 5.2, tgtY: 0 }, pc: { fov: 46, up: 15, back: 11.6, ahead: 11.9, tgtY: 0 } };
const PANTRY_CAM: { phone: CamPreset; pc: CamPreset } = { phone: { fov: 50, up: 7.6, back: 7.0, ahead: 0.3, tgtY: 0.5 }, pc: { fov: 44, up: 8.5, back: 8.5, ahead: 0.3, tgtY: 0.5 } };
const COFFEES: Array<[string, string]> = [['아메리카노', '따뜻한 아메리카노 한 잔. 잠깐 쉬어 가요'], ['믹스커피', '달달한 믹스커피 한 잔. 당 충전 완료'], ['라떼', '부드러운 라떼 한 잔. 잠깐 쉬어 가요'], ['녹차', '따뜻한 녹차 한 잔. 마음도 차분히']];

export class OfficeCtl {
  B: OfficeBuilt;
  me: Actor;
  boss: Superior;
  mgr: Superior;
  staff: StaffNpc[] = [];
  /** 자리 주인: null | 'me' | 'npc' | 사람 id */
  occ: Array<string | null>;
  mode: Mode = 'walk';
  pc: PcWindow;
  world: World;
  board: BoardSource;
  peers = new Map<string, Actor>();
  private rnd: () => number;
  private visitQ: Array<() => void> = [];
  private visiting: Superior | null = null;
  private nudgeT: number;
  private sitSince = 0;
  private comfortDone = false;
  private timeLineDone = { lunch: false, evening: false };
  private dockKey = '';
  private boardClose: (() => void) | null = null;
  private pbtn: { el: HTMLElement; off: () => void; who: Actor } | null = null;
  private keyIdle = 0;
  private cupOnDesk: THREE.Object3D | null = null;
  private swap = { wait: NPC_LEAVE_SEC / FAST };
  private recommended = -1;
  private ringT = 0;
  carry = false;
  inPantry = false;
  disposed = false;
  private pantryFocus = new THREE.Vector3();
  private menuOpen = false;
  private labelOffs: Array<() => void> = [];

  constructor(private g: Game) {
    const s = g.s;
    const dept = DEPTS[s.dept];
    this.B = buildOffice(s.dept, dept.floor);
    const scene = this.B.scene;
    this.rnd = mulberry32(1000 + s.dept * 97 + s.building * 13);
    // 부장·과장
    const bossName = pick(['최부장', '한부장'] as const);
    const fem = Math.random() < 0.5;
    const mgrName = pick(['박과장', '윤과장'] as const);
    this.boss = new Superior('boss', bossName, BOSS, this.B.bossSeat, this.B.nav);
    this.mgr = new Superior('mgr', mgrName, fem ? MGR_F : MGR_M, this.B.mgrSeat, this.B.nav);
    this.boss.a.addTo(scene); this.mgr.a.addTo(scene);
    this.boss.a.tag(g.stage, bossName); this.mgr.a.tag(g.stage, mgrName);
    // NPC 사원 10명(부서마다 같은 자리: 각 기기가 같은 규칙으로 그림)
    this.occ = new Array(this.B.seats.length).fill(null);
    const npcSeats = shuffle([...this.B.seats.keys()], this.rnd).slice(0, NPC_BASE);
    for (const i of npcSeats) this.addStaff(this.B.seats[i]);
    // 나
    this.me = new Actor({ sex: s.sex, suit: s.suit, tie: s.tie }, 'me', s.name).place(OFFICE.DOOR.x, OFFICE.DOOR.z - 0.6, Math.PI).addTo(scene);
    this.board = g.net?.board ?? new LocalBoard(shuffle([...BOARD_SEED]).slice(0, 8));
    this.pc = new PcWindow(s, {
      onSubmit: (i) => this.onSubmit(i),
      onDone: (i) => this.onDone(i),
      onClose: () => this.pcOff(),
      board: () => { const c = h('div', { class: 'cork' }); renderNotes(c, this.board, true); return h('div', {}, c, h('div', { class: 'pc-btns' }, h('button', { class: 'pc-b on', onclick: () => this.openBoard() }, '크게 보기 · 한 줄 남기기'))); },
      bossNames: () => ({ boss: this.boss.name, mgr: this.mgr.name }),
      lowPower: (on) => { this.g.stage.lowPower = on; document.body.classList.toggle('pc-open', on); },
    });
    this.nudgeT = between(120, 240) / FAST;
    this.world = {
      scene, light: { sun: [-7, 16, 10], box: 20 },
      cam: WALK_CAM,
      focus: () => (this.inPantry && this.mode !== 'sit' && this.mode !== 'pc' ? this.pantryFocus.set(12.4, 0, THREE.MathUtils.clamp(this.me.pos.z, 1.5, 7.5)) : this.me.pos),
      occluders: this.B.occluders,
      update: (dt) => this.update(dt),
      onTap: (ray) => this.onTap(ray),
      onKey: (d, dt) => this.onKey(d, dt),
      minZoom: 0.35, maxZoom: 1.5,
    };
    g.stage.setWorld(this.world);
    // 시안처럼 팀 이름표, 탕비실·게시판 글자
    for (const t of ['1팀', '2팀', '3팀']) { const v = this.B.tops['team' + t]; this.labelOffs.push(g.stage.anchor(h('div', { class: 'team3' }, t), () => v, 12)); }
    this.labelOffs.push(g.stage.anchor(h('div', { class: 'lab3' }, '탕비실 →'), () => (this.inPantry ? null : this.B.tops.pantry), 0));
    this.labelOffs.push(g.stage.anchor(h('div', { class: 'lab3' }, '사내 게시판'), () => (this.inPantry ? null : this.B.tops.board), 0));
    g.net?.attach(this);
    this.refreshRings();
    void this.intro();
  }

  private addStaff(seat: Seat, look?: Look): StaffNpc {
    const n = new StaffNpc(seat, look ?? randomLook(this.rnd), this.g.stage, this.B.nav, this.B.pantry, 1);
    n.a.addTo(this.B.scene);
    this.staff.push(n);
    this.npcSeen++;
    this.occ[seat.idx] = 'npc';
    return n;
  }

  /** 처음 들어설 때: 문 위에서 사무실 전체 1.5초 → 내 등 뒤로 */
  private async intro(): Promise<void> {
    const st = this.g.stage;
    this.mode = 'busy';
    st.setFixed(new THREE.Vector3(0, 13, 15), new THREE.Vector3(0, 0, -5), 54);
    const dept = DEPTS[this.g.s.dept];
    this.g.hud.title(`${dept.name} · ${dept.floor}층`, '');
    this.tickHud();
    this.me.walkStraight([{ x: 0, z: OFFICE.DOOR.z - 1.8 }]);
    await wait(700);
    // 부장이 고개를 들어 인사
    this.boss.a.w.anim.lookYaw = 0;
    const l = pickLine(GREET, this.g.s.usedLines, { who: 'boss', hasTodo: false });
    if (l) { this.boss.a.say(st, fillLine(l.text, this.g.s.name, null), 3.6); this.boss.a.w.play('nod'); }
    await wait(800);
    const to = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 54 };
    st.clearFixed();
    await st.tweenTo(() => { st.followView(to); return to; }, 1.0);
    this.mode = 'walk';
    this.dockKey = '';
    toast('하늘색 동그라미가 빈자리예요', 3500);
  }

  /* ---------------- 매 프레임 ---------------- */
  private update(dt: number): void {
    if (this.disposed) return;
    const st = this.g.stage;
    this.me.update(dt);
    if (!st.keys.size && !this.me.walking && !this.me.sitting && this.me.w.anim.base === 'walk') { this.keyIdle += dt; if (this.keyIdle > 0.06) this.me.w.setPose('stand'); } else this.keyIdle = 0;
    this.boss.update(dt); this.mgr.update(dt);
    for (const n of this.staff) n.update(dt);
    for (const p of this.peers.values()) p.update(dt);
    // 빈자리 동그라미 깜빡임
    this.ringT += dt;
    this.B.rings.forEach((r, i) => { if (!r.visible) return; const k = i === this.recommended ? 0.55 + 0.45 * Math.sin(this.ringT * 6) : 0.75 + 0.25 * Math.sin(this.ringT * 3); ((r.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = k; });
    // 탕비실 안/밖
    const inP = this.me.pos.x > OFFICE.RW / 2 - 0.2;
    if (inP !== this.inPantry) {
      this.inPantry = inP;
      st.setBaseYaw(inP ? -Math.PI / 2 : this.mode === 'sit' || this.mode === 'pc' ? this.seatYaw() : 0);
      if (this.mode !== 'sit' && this.mode !== 'pc') this.world.cam = inP ? PANTRY_CAM : WALK_CAM;
      // 탕비실 안에서는 사무실 오른쪽 벽을 걷어 내고 봄
      for (const w of this.B.rightWall) w.visible = !inP;
      this.tickHud();
    }
    // 상사 일정
    if (this.mode === 'sit' || this.mode === 'pc') {
      this.nudgeT -= dt;
      if (this.nudgeT <= 0) { this.nudgeT = between(120, 240) / FAST; this.queueNudge(); }
      if (!this.comfortDone && performance.now() - this.sitSince > (20 * 60 * 1000) / FAST) { this.comfortDone = true; this.queue(() => this.talkLine(pick([this.boss, this.mgr]), COMFORT)); }
      const hr = new Date().getHours();
      if (!this.timeLineDone.lunch && hr === 12 && performance.now() - this.sitSince > 30000 / FAST) { this.timeLineDone.lunch = true; this.queue(() => this.talk(this.boss, LUNCH)); }
      if (!this.timeLineDone.evening && hr >= 18 && performance.now() - this.sitSince > 60000 / FAST) { this.timeLineDone.evening = true; this.queue(() => this.talk(this.boss, EVENING)); }
    }
    if (!this.visiting && this.visitQ.length && !dialogOpen()) this.visitQ.shift()!();
    this.npcSwap(dt);
    this.follow(dt);
    this.g.net?.sendState(false);
    this.updateDock();
    this.updatePeerBtns();
  }

  /** 지금 근무 중 n명, 근무 시간 */
  tickHud(): void {
    if (this.disposed) return;
    const humans = 1 + this.peers.size;
    const npc = this.staff.filter((n) => n.state !== 'gone').length;
    const dept = DEPTS[this.g.s.dept];
    if (this.inPantry) this.g.hud.title('탕비실', `잠깐 쉬어 가요 · ${this.g.clock()}`);
    else this.g.hud.title(`${dept.name} · ${dept.floor}층`, `지금 근무 중 ${humans + npc + 2}명 · ${this.g.clock()}`);
  }
  /** 같이 일한 사람 = 같은 부서 실제 사람 + NPC 사원(오늘 본 사람 모두) + 부장·과장 */
  coworkers(): number { return this.g.s.coworkers.size + Math.max(this.npcSeen, this.staff.length) + 2; }
  private npcSeen = 0;

  /* ---------------- 입력 ---------------- */
  private onTap(ray: THREE.Raycaster): void {
    if (this.mode === 'busy') return;
    // 사람
    const people: Actor[] = [this.boss.a, this.mgr.a, ...this.staff.filter((n) => n.state !== 'gone').map((n) => n.a), ...this.peers.values()];
    let best: { a: Actor; d: number } | null = null;
    for (const a of people) {
      const c = a.pos.clone(); c.y += 0.9 * a.scale;
      const d = ray.ray.distanceSqToPoint(c);
      const along = c.clone().sub(ray.ray.origin).dot(ray.ray.direction);
      if (d < 0.45 * 0.45 * a.scale * a.scale * 2 && along > 0 && (!best || along < best.d)) best = { a, d: along };
    }
    if (best) { this.showPersonBtns(best.a); return; }
    this.closePersonBtns();
    // 앉아 있을 때: 모니터 탭 → PC 창
    if (this.mode === 'sit' && this.me.seat) {
      const m = this.B.monitorAt(this.me.seat);
      if (ray.ray.distanceSqToPoint(m) < 0.6 * 0.6) { this.pcOn(); return; }
      return;
    }
    if (this.mode !== 'walk') return;
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!p) return;
    // 게시판 쪽을 누르면 게시판 앞으로
    const bt = this.B.tops.board;
    if (ray.ray.distanceSqToPoint(new THREE.Vector3(bt.x, 1.4, bt.z)) < 1.4) { this.me.goTo(this.B.nav, OFFICE.BOARD.x + 0.3, OFFICE.BOARD.z); return; }
    // 빈자리 동그라미
    for (const s of this.B.seats) if (Math.hypot(p.x - s.x, p.z - s.z) < 0.7 && this.occ[s.idx] !== 'me') { this.me.goTo(this.B.nav, s.x, s.z); return; }
    this.me.goTo(this.B.nav, p.x, p.z);
  }
  private onKey(d: THREE.Vector2, dt: number): void {
    if (this.mode !== 'walk' || dialogOpen()) return;
    this.me.stopWalk();
    const nx = this.me.pos.x + d.x * 1.4 * dt, nz = this.me.pos.z + d.y * 1.4 * dt;
    if (this.B.nav.free(nx, nz)) { this.me.pos.x = nx; this.me.pos.z = nz; }
    else if (this.B.nav.free(nx, this.me.pos.z)) this.me.pos.x = nx;
    else if (this.B.nav.free(this.me.pos.x, nz)) this.me.pos.z = nz;
    this.me.faceYaw(Math.atan2(d.x, d.y));
    this.me.w.setPose('walk'); this.me.w.anim.speed = 1.2;
  }
  key(k: string, e: KeyboardEvent): void {
    if (k === 'e') { e.preventDefault(); if (this.mode === 'walk') { const s = this.nearSeat(); if (s) this.sit(s); } else if (this.mode === 'sit' || this.mode === 'pc') this.standUp(); }
    if (k === 'escape') { if (this.boardClose) this.boardClose(); else if (this.pc.isOpen) this.pcOff(); }
  }

  /* ---------------- 아래 버튼 묶음 ---------------- */
  private nearSeat(): Seat | null {
    let best: Seat | null = null, bd = 1.2;
    const anyEmpty = this.occ.some((o) => o === null);
    for (const s of this.B.seats) {
      const o = this.occ[s.idx];
      if (o !== null && !(o === 'npc' && !anyEmpty)) continue;
      const d = this.me.dist(s.x, s.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  private near(p: THREE.Vector3, r: number): boolean { return this.me.dist(p.x, p.z) < r; }
  private updateDock(): void {
    const hud = this.g.hud;
    let key = this.mode;
    const P = this.B.pantry.spots;
    let seat: Seat | null = null;
    if (this.mode === 'walk' && !this.me.walking) {
      seat = this.nearSeat();
      if (seat) key += ':seat';
      else if (this.near(OFFICE.BOARD, 1.6)) key += ':board';
      else if (this.near(P.coffee, 1.1)) key += ':coffee';
      else if (this.near(P.snack, 1.1)) key += ':snack';
      if (this.inPantry && this.carry && this.pantryMates().length) key += ':cheers';
    }
    if (this.mode === 'pc') key += this.pc.isOpen ? ':on' : ':off';
    if (this.menuOpen) { if (key.includes(':coffee') || this.mode === 'busy') return; this.menuOpen = false; }
    if (key === this.dockKey) return;
    this.dockKey = key;
    if (this.mode === 'busy') { hud.setDock(); return; }
    if (this.mode === 'sit' || this.mode === 'pc') {
      hud.setDock(rowBtns([[this.pc.isOpen ? '화면 끄기' : '화면 켜기', () => (this.pc.isOpen ? this.pcOff() : this.pcOn())], ['일어나기', () => this.standUp()], ['퇴근하기', () => void this.g.leave(), 'dk']]));
      return;
    }
    const btns: Array<Node | null> = [];
    if (key.includes(':cheers')) btns.push(bigBtn('🥂 건배', () => void this.cheers(), ''));
    if (seat) { const s = seat; btns.push(bigBtn('자리에 앉기', () => this.sit(s), 'on', 'E')); }
    else if (key.includes(':board')) btns.push(bigBtn('게시판 보기', () => this.openBoard(), 'on'));
    else if (key.includes(':coffee')) btns.push(bigBtn('☕ 커피 마시기', () => this.coffeeMenu(), 'on'));
    else if (key.includes(':snack')) btns.push(bigBtn('간식 집기', () => void this.snack(), 'on'));
    hud.setDock(...btns);
  }

  /* ---------------- 앉기·PC ---------------- */
  sit(seat: Seat): void {
    if (this.mode !== 'walk') return;
    const o = this.occ[seat.idx];
    if (o !== null && o !== 'npc' && o !== 'me') { toast('다른 분이 앉은 자리예요'); return; }
    if (this.g.net && !this.g.net.claimSeat(seat.idx)) return;
    this.takeSeat(seat);
  }
  /** 자리를 실제로 차지(서버가 허락한 뒤) */
  takeSeat(seat: Seat): void {
    const o = this.occ[seat.idx];
    if (o === 'npc') this.npcYield(seat);
    this.occ[seat.idx] = 'me';
    this.refreshRings();
    this.mode = 'busy';
    this.closePersonBtns();
    this.me.goTo(this.B.nav, seat.x, seat.z, () => {
      this.me.sitAt(seat);
      if (this.carry) this.putCupOnDesk(seat);
      this.sitSince = performance.now();
      this.mode = 'sit';
      this.g.net?.sendState();
      this.g.stage.setBaseYaw(this.seatYaw());
      this.world.cam = SEATED_CAM;
      setTimeout(() => { if (this.mode === 'sit') this.pcOn(); }, 500);
    });
  }
  private seatYaw(): number { return this.me.seat ? this.me.seat.ry + Math.PI : 0; }
  /** NPC가 자리를 비켜 줌: 다른 빈자리로, 없으면 외근 */
  private npcYield(seat: Seat): void {
    const n = this.staff.find((x) => x.seat.idx === seat.idx && x.state !== 'gone');
    if (!n) return;
    const empty = this.B.seats.filter((s) => this.occ[s.idx] === null && s.idx !== seat.idx);
    if (empty.length) { const t = empty[Math.floor(Math.random() * empty.length)]; this.occ[t.idx] = 'npc'; n.moveTo(t, STAFF_YIELD); }
    else { n.leave('외근 다녀올게요', () => this.removeStaff(n)); }
  }
  private removeStaff(n: StaffNpc): void { this.staff = this.staff.filter((x) => x !== n); n.dispose(); this.refreshRings(); }
  pcOn(): void {
    if (!this.me.seat) return;
    this.mode = 'pc';
    const st = this.g.stage, s = this.me.seat;
    const m = this.B.monitorAt(s);
    const back = new THREE.Vector3(-Math.sin(s.ry), 0, -Math.cos(s.ry));
    const pos = new THREE.Vector3(s.x, 2.7, s.z).addScaledVector(back, 1.7);
    st.tweenTo(() => ({ pos, tgt: m, fov: 50 }), 0.6).then(() => { if (this.mode === 'pc') { st.setFixed(pos, m, 50); this.pc.open(); this.dockKey = ''; } });
  }
  pcOff(): void {
    if (!this.pc.isOpen && this.mode !== 'pc') return;
    this.pc.close();
    this.mode = 'sit';
    const st = this.g.stage;
    st.clearFixed();
    const to = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 54 };
    void st.tweenTo(() => { st.followView(to); return to; }, 0.5);
    this.dockKey = '';
  }
  standUp(): void {
    if (this.mode !== 'sit' && this.mode !== 'pc') return;
    if (this.pc.isOpen) this.pcOff();
    const seat = this.me.seat!;
    this.me.standUp();
    this.me.leaveSeat();
    this.occ[seat.idx] = null;
    this.refreshRings();
    this.mode = 'walk';
    this.world.cam = this.inPantry ? PANTRY_CAM : WALK_CAM;
    this.g.stage.clearFixed();
    this.g.stage.setBaseYaw(this.inPantry ? -Math.PI / 2 : 0);
    if (this.cupOnDesk) { this.cupOnDesk.parent?.remove(this.cupOnDesk); this.cupOnDesk = null; this.carry = true; this.me.w.setProp('cup'); this.me.w.anim.carry = true; }
    this.g.net?.sendState();
    this.dockKey = '';
    // 30% 확률로 근처 상사가 말을 검
    if (Math.random() < 0.3 && !this.visiting) {
      const sup = [this.boss, this.mgr].filter((x) => x.free).sort((a, b) => a.a.dist(this.me.pos.x, this.me.pos.z) - b.a.dist(this.me.pos.x, this.me.pos.z))[0];
      if (sup) this.queue(() => this.standupTalk(sup), true);
    }
  }
  refreshRings(): void {
    const humans = new Set(this.occ.map((o, i) => (o && o !== 'npc' ? i : -1)).filter((i) => i >= 0));
    // 추천: 실제 사람 옆자리
    this.recommended = -1;
    let bd = Infinity;
    for (const s of this.B.seats) {
      if (this.occ[s.idx] !== null) continue;
      for (const hIdx of humans) { if (this.occ[hIdx] === 'me') continue; const o = this.B.seats[hIdx]; const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < bd) { bd = d; this.recommended = s.idx; } }
    }
    this.B.rings.forEach((r, i) => { r.visible = this.occ[i] === null; });
  }
  private putCupOnDesk(seat: Seat): void {
    this.carry = false; this.me.w.setProp(null); this.me.w.anim.carry = false;
    const c = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.05, 18), new THREE.MeshStandardMaterial({ color: 0xc98b55, roughness: 0.6 }));
    cup.position.y = 0.07; sl.position.y = 0.06; c.add(cup, sl);
    const fx = Math.sin(seat.ry), fz = Math.cos(seat.ry), rx = Math.cos(seat.ry), rz = -Math.sin(seat.ry);
    c.position.set(seat.x + fx * 0.9 + rx * 0.75, 0.765, seat.z + fz * 0.9 + rz * 0.75);
    this.B.scene.add(c);
    this.cupOnDesk = c;
  }

  /* ---------------- 할 일 · 결재 ---------------- */
  private hasTodo(): boolean { return this.g.s.written.length > 0; }
  private someTodo(prefer?: number): string | null {
    const w = this.g.s.todos;
    if (prefer !== undefined && w[prefer]?.text.trim()) return w[prefer].text.trim();
    const list = this.g.s.written;
    return list.length ? pick(list).text.trim() : null;
  }
  private onSubmit(i: number): void {
    // 10~25초 뒤 과장 → 다시 10~20초 뒤 부장
    setTimeout(() => this.queue(() => this.approvalVisit(this.mgr, i)), (between(10, 25) * 1000) / FAST);
  }
  private approvalVisit(sup: Superior, i: number): void {
    const t = this.g.s.todos[i];
    if (!t || t.state !== 'pending') { this.visiting = null; return; }
    const isBoss = sup.role === 'boss';
    // 과장 도장이 아직이면 조금 뒤에 다시
    if (isBoss && t.stamps < 1) { this.visiting = null; setTimeout(() => this.queue(() => this.approvalVisit(sup, i)), 5000 / FAST); return; }
    const pool = isBoss ? APPROVE_BOSS : APPROVE_MGR;
    const l = pickLine(pool, this.g.s.usedLines, { who: sup.role, hasTodo: true }) ?? pool[0];
    this.approach(sup, () => {
      this.stamp(i, isBoss ? 2 : 1);
      this.talk(sup, l, i);
    });
    if (!isBoss) setTimeout(() => this.queue(() => this.approvalVisit(this.boss, i)), (between(10, 20) * 1000 + 6000) / FAST);
  }
  /** 도장 찍기 */
  stamp(i: number, n: number): void {
    const t = this.g.s.todos[i];
    if (!t || t.state !== 'pending') return;
    t.stamps = Math.max(t.stamps, n);
    if (t.stamps >= 2) { t.state = 'approved'; this.g.s.praise++; toast(`'${t.text.slice(0, 12)}' 결재 승인! 도장 쾅`); }
    else toast(`${this.mgr.name}님이 확인했어요 · 부장님께 올라가요`);
    sfx.stamp();
    this.pc.refresh();
  }
  private onDone(i: number): void {
    this.g.net?.event('done');
    this.me.check(this.g.stage);
    const all = this.g.s.todos.filter((t) => t.text.trim()).length === 4 && this.g.s.todos.every((t) => t.done);
    setTimeout(() => this.queue(() => {
      if (all) { this.allDone(); return; }
      const sup = pick([this.boss, this.mgr]);
      const l = pickLine(PRAISE, this.g.s.usedLines, { who: sup.role, hasTodo: true });
      if (!l) { this.visiting = null; return; }
      this.g.s.praise++;
      this.talkLine(sup, [l], i);
    }), (between(3, 8) * 1000) / FAST);
  }
  /** 4개 다 완료: 부장이 일어나 박수 */
  private allDone(): void {
    const b = this.boss;
    this.visiting = b;
    if (b.a.sitting) b.a.standUp();
    b.state = 'stand';
    b.a.faceTo(this.me.pos.x, this.me.pos.z);
    b.a.w.play('clap', 2.4); sfx.clap();
    this.g.s.praise++;
    this.g.s.usedLines.add(PRAISE_ALL.id);
    setTimeout(() => this.talk(b, PRAISE_ALL, undefined, true), 900);
  }

  /* ---------------- 상사 말 걸기 ---------------- */
  queue(f: () => void, front = false): void { if (front) this.visitQ.unshift(f); else this.visitQ.push(f); }
  private queueNudge(): void {
    this.queue(() => {
      const inTeam2 = this.me.seat?.team === 2;
      const sup = Math.random() < (inTeam2 ? 0.6 : 0.5) ? this.mgr : this.boss;
      const has = this.hasTodo();
      let l = pickLine(NUDGE, this.g.s.usedLines, { who: sup.role, hasTodo: has });
      if (!has && Math.random() < 0.5) l = pickLine(NO_TODO, this.g.s.usedLines, { who: sup.role, hasTodo: false }) ?? l;
      if (!l) { this.visiting = null; return; }
      this.talkLine(sup, [l]);
    });
  }
  /** 상사가 걸어와서 대사 */
  private talkLine(sup: Superior, pool: Line[], todoIdx?: number): void {
    const l = pool.length === 1 ? pool[0] : pickLine(pool, this.g.s.usedLines, { who: sup.role, hasTodo: this.hasTodo() });
    if (!l) { this.visiting = null; return; }
    this.approach(sup, () => this.talk(sup, l, todoIdx));
  }
  private approach(sup: Superior, then: () => void): void {
    this.visiting = sup;
    if (this.pc.isOpen) this.pc.notify(`${sup.name}님이 다가와요`);
    if (this.me.dist(sup.a.pos.x, sup.a.pos.z) < 1.8 && !sup.a.sitting) { sup.a.faceTo(this.me.pos.x, this.me.pos.z); then(); return; }
    sup.visit(this.me, then);
  }
  /** 대화창 열기 */
  talk(sup: Superior, l: Line, todoIdx?: number, stay = false): void {
    this.visiting = sup;
    const s = this.g.s;
    const text = fillLine(l.text, s.name, l.text.includes('{할일}') ? this.someTodo(todoIdx) : null);
    const face = portrait(this.g.stage.r, sup.a.w.look, 116, 116, true);
    sup.a.w.play(Math.random() < 0.5 ? 'point' : 'nod');
    sup.a.w.talk(Math.min(4, text.length * 0.06));
    this.me.faceTo(sup.a.pos.x, sup.a.pos.z);
    const choices: Choice[] = l.choices ?? DEFAULT_CHOICES;
    const end = (): void => { this.visiting = null; if (!stay) sup.goHome(); else setTimeout(() => sup.goHome(), 1500); };
    const dlg = openDialog({
      face, name: sup.name, rank: `${DEPTS[s.dept].name} ${sup.rank}`, text,
      choices: choices.map((c): DlgChoice => ({ label: c.label, on: () => {
        const rep = c.reply && c.reply.length ? pick(c.reply) : '그래그래 ㅎㅎ';
        sup.a.w.talk(1.2);
        if (c.act === 'leave') { dlg.reply(rep, () => { end(); void this.g.leave(true); }); return; }
        if (c.act === 'pantry') { dlg.reply(rep, () => { end(); this.goPantryAlone(); }); return; }
        if (c.act === 'walkPantry') { dlg.reply(rep, () => { this.visiting = null; this.walkPantryWith(sup); }); return; }
        dlg.reply(rep, end);
      } })),
      timeout: 12,
      onTimeout: () => { dlg.close(); sup.a.say(this.g.stage, IGNORED, 2.5); end(); },
    });
  }
  /** 일어날 때(30%) */
  private standupTalk(sup: Superior): void {
    const l = pickLine(STANDUP, this.g.s.usedLines, { who: sup.role, hasTodo: false });
    if (!l) { this.visiting = null; return; }
    this.visiting = sup;
    if (sup.a.sitting) sup.a.standUp();
    sup.state = 'stand';
    sup.a.faceTo(this.me.pos.x, this.me.pos.z);
    this.talk(sup, l);
  }
  /** 혼자 탕비실로 걸어감 */
  goPantryAlone(): void {
    if (this.mode === 'sit' || this.mode === 'pc') this.standUp();
    const P = this.B.pantry.spots.coffee;
    setTimeout(() => this.me.goTo(this.B.nav, P.x - 0.2, P.z + 0.4), 300);
  }
  /** 상사와 같이 탕비실: 걷는 동안 말풍선 3~4줄 */
  private walkPantryWith(sup: Superior): void {
    if (this.mode === 'sit' || this.mode === 'pc') this.standUp();
    sup.escort(this.me);
    const lines = shuffle([...WALK]).slice(0, 3 + Math.floor(Math.random() * 2));
    lines.forEach((t, k) => setTimeout(() => { if (!this.disposed) sup.a.say(this.g.stage, t, 3.4); }, 600 + k * 3600));
    const P = this.B.pantry.spots.coffee;
    this.me.goTo(this.B.nav, P.x - 0.2, P.z + 0.4);
    setTimeout(() => { if (!this.disposed) { sup.state = 'pantry'; sup.a.w.setProp('cup'); sup.a.w.anim.carry = true; setTimeout(() => sup.goHome(), 25000); } }, 600 + lines.length * 3600 + 1500);
  }

  /* ---------------- 사람 머리 위 버튼 ---------------- */
  private showPersonBtns(a: Actor): void {
    this.closePersonBtns();
    const sup = a === this.boss.a ? this.boss : a === this.mgr.a ? this.mgr : null;
    const d = this.me.dist(a.pos.x, a.pos.z);
    const list: HTMLElement[] = [];
    const B = (l: string, f: () => void): HTMLElement => h('button', { class: 'btn', onclick: (e: Event) => { e.stopPropagation(); this.closePersonBtns(); f(); } }, l);
    if (sup) {
      if (d > 1.5 + 0.6) { toast(`${sup.name}님 가까이(1.5m) 가면 버튼이 떠요`); this.me.goTo(this.B.nav, a.pos.x, a.pos.z + 1.2); return; }
      list.push(B('인사하기', () => { this.me.w.play('bow'); this.queue(() => { const l = pickLine(GREET, this.g.s.usedLines, { who: sup.role, hasTodo: false }) ?? GREET[0]; this.talk(sup, l, undefined, true); }, true); }));
      const pend = this.g.s.todos.findIndex((t) => t.state === 'pending');
      if (pend >= 0) list.push(B('결재 부탁드립니다', () => { this.me.w.play('bow'); const i = pend; const t = this.g.s.todos[i]; this.stamp(i, sup.role === 'boss' ? 2 : 1); if (sup.role === 'boss' && t.state !== 'approved') this.stamp(i, 2); const l = pickLine(sup.role === 'boss' ? APPROVE_BOSS : APPROVE_MGR, this.g.s.usedLines, { who: sup.role, hasTodo: true }) ?? APPROVE_BOSS[0]; this.talk(sup, l, i, true); }));
      list.push(B('고민 상담', () => { const l = pickLine(COMFORT, this.g.s.usedLines, { hasTodo: false }); if (l) this.talk(sup, l, undefined, true); else toast('오늘은 이야기를 충분히 나눴어요'); }));
    } else {
      const peer = a.kind === 'peer';
      list.push(B('인사하기', () => this.bowTo(a)));
      if (d < 3 && !a.sitting && !this.me.sitting) list.push(B('탕비실 같이 가요', () => this.invite(a)));
      else if (d < 3 && (a.sitting || peer)) list.push(B('탕비실 같이 가요', () => this.invite(a)));
      list.push(B('👏 박수', () => this.clapTo(a)));
      if (this.inPantry && this.carry && a.w.prop === 'cup') list.push(B('🥂 건배', () => void this.cheers(a)));
    }
    const el = h('div', { class: 'pbtns' }, ...list);
    const off = this.g.stage.anchor(el, () => { const p = a.top(); p.y += 0.2; return p; }, -6);
    this.pbtn = { el, off, who: a };
    setTimeout(() => { if (this.pbtn?.el === el) this.closePersonBtns(); }, 6000);
  }
  private closePersonBtns(): void { if (this.pbtn) { this.pbtn.off(); this.pbtn = null; } }
  private updatePeerBtns(): void { if (this.pbtn && this.me.dist(this.pbtn.who.pos.x, this.pbtn.who.pos.z) > 6) this.closePersonBtns(); }
  private bowTo(a: Actor): void {
    if (this.me.dist(a.pos.x, a.pos.z) > 3) { toast('3m 안에서 인사할 수 있어요'); return; }
    this.me.faceTo(a.pos.x, a.pos.z);
    this.me.w.play('bow');
    if (a.kind === 'peer') { this.g.net?.event('bow', a.id); return; }
    setTimeout(() => { if (!a.sitting) a.faceTo(this.me.pos.x, this.me.pos.z); a.w.play(a.sitting ? 'nod' : 'bow'); }, 500);
  }
  private clapTo(a: Actor): void {
    this.me.faceTo(a.pos.x, a.pos.z);
    this.me.w.play('clap'); sfx.clap();
    if (a.kind === 'peer') this.g.net?.event('clap', a.id);
  }
  /** 탕비실 같이 가요 */
  private invite(a: Actor): void {
    if (a.kind === 'peer') { if (this.me.dist(a.pos.x, a.pos.z) > 3) { toast('3m 안에서 물어볼 수 있어요'); return; } this.g.net?.event('ask', a.id); toast(`${a.name.split('#')[0]}님에게 물어봤어요`); return; }
    const n = a.data.npc as StaffNpc | undefined;
    if (!n) return;
    if (Math.random() < 0.8) {
      n.a.say(this.g.stage, pick(STAFF_ACCEPT), 2);
      if (this.mode === 'sit' || this.mode === 'pc') this.standUp();
      n.goPantry(this.me);
      const P = this.B.pantry.spots.coffee;
      this.me.goTo(this.B.nav, P.x - 0.2, P.z + 0.4);
      setTimeout(() => { if (n.state === 'follow') { n.state = 'inPantry'; n.t = 30; n.a.w.setProp('cup'); n.a.w.anim.carry = true; } }, 16000);
    } else n.a.say(this.g.stage, STAFF_DECLINE, 2.4);
  }
  /** 같이 가기: 상대(실제 사람)를 내 옆에 붙임 */
  followPeer(): void { /* net이 다른 사람 위치를 보내 줌 */ }

  /* ---------------- 탕비실 ---------------- */
  private coffeeMenu(): void {
    this.g.hud.setDock(h('div', { class: 'lbl' }, '커피 마시기'), rowBtns(COFFEES.slice(0, 2).map(([n, msg], i) => [n, () => void this.brew(n, msg), i === 0 ? 'on' : ''] as [string, () => void, string])), rowBtns(COFFEES.slice(2).map(([n, msg]) => [n, () => void this.brew(n, msg)] as [string, () => void])));
    this.dockKey = 'menu';
    this.menuOpen = true;
  }
  private async brew(name: string, msg: string): Promise<void> {
    this.menuOpen = false;
    this.mode = 'busy'; this.g.hud.setDock(); this.dockKey = '';
    const P = this.B.pantry;
    this.me.faceYaw(Math.PI / 2);
    this.me.w.setProp(null); this.me.w.anim.carry = false;
    // 머신에 컵을 놓고 2초(김)
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 18), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    cup.position.copy(P.cupSpot).add(new THREE.Vector3(0, 0.07, 0));
    this.B.scene.add(cup);
    (P.lamp.material as THREE.MeshStandardMaterial).color?.set?.(0x34c77b);
    sfx.pour();
    const steam = this.steam(P.cupSpot.clone().add(new THREE.Vector3(0, 0.2, 0)));
    await wait(2000);
    this.B.scene.remove(cup); steam();
    (P.lamp.material as THREE.MeshStandardMaterial).color?.set?.(0x7fd0ff);
    this.me.w.setProp('cup'); this.me.w.anim.carry = true; this.carry = true;
    this.me.w.play('drink');
    this.g.net?.event('drink');
    await wait(2300);
    this.g.s.coffee++;
    toast(msg);
    void name;
    this.mode = 'walk'; this.dockKey = '';
  }
  private steam(at: THREE.Vector3): () => void {
    const g = new THREE.Group(); g.position.copy(at); this.B.scene.add(g);
    const ps: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); g.add(m); ps.push(m); }
    let alive = true; const t0 = performance.now();
    const step = (): void => { if (!alive) return; const t = (performance.now() - t0) / 1000; ps.forEach((m, i) => { const k = (t * 0.8 + i / 6) % 1; m.position.set(Math.sin(k * 9 + i) * 0.04, k * 0.5, 0); m.scale.setScalar(0.6 + k * 1.4); (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k); }); requestAnimationFrame(step); };
    step();
    return () => { alive = false; this.B.scene.remove(g); };
  }
  private async snack(): Promise<void> {
    this.mode = 'busy'; this.g.hud.setDock(); this.dockKey = '';
    this.me.faceYaw(Math.PI / 2);
    const had = this.carry;
    this.me.w.setProp('bar'); this.me.w.anim.carry = false;
    await wait(300);
    this.me.w.play('drink', 1.8);
    await wait(2000);
    this.me.w.setProp(had ? 'cup' : null); this.me.w.anim.carry = had;
    toast('초코바 하나 냠. 당 충전 완료!');
    this.mode = 'walk'; this.dockKey = '';
  }
  private pantryMates(): Actor[] {
    const list: Actor[] = [this.boss.a, this.mgr.a, ...this.staff.map((n) => n.a), ...this.peers.values()];
    return list.filter((a) => a.pos.x > OFFICE.RW / 2 && a.w.root.visible && a.dist(this.me.pos.x, this.me.pos.z) < 3.5);
  }
  async cheers(target?: Actor): Promise<void> {
    const mates = this.pantryMates();
    const t = target ?? mates.sort((a, b) => a.dist(this.me.pos.x, this.me.pos.z) - b.dist(this.me.pos.x, this.me.pos.z))[0];
    if (!t) return;
    this.me.faceTo(t.pos.x, t.pos.z);
    this.me.w.play('cheers');
    this.me.say(this.g.stage, '짠!', 1.8, true);
    sfx.cheers();
    if (t.kind === 'peer') { this.g.net?.event('cheers', t.id); return; }
    if (!t.sitting) t.faceTo(this.me.pos.x, this.me.pos.z);
    if (t.w.prop !== 'cup') { t.w.setProp('cup'); }
    t.w.play('cheers');
    setTimeout(() => t.say(this.g.stage, '짠!', 1.8, true), 150);
  }

  /* ---------------- 게시판 ---------------- */
  openBoard(): void {
    if (this.boardClose) return;
    this.g.stage.lowPower = true;
    this.boardClose = openBoard(this.board, () => { this.boardClose = null; this.g.stage.lowPower = this.pc.isOpen; });
  }

  /* ---------------- NPC 교체(5장) ---------------- */
  /** 실제 사람 수에 맞춰 30초에 한 명씩 빠지고, 15초에 한 명씩 들어옴 */
  private npcSwap(dt: number): void {
    const humans = 1 + this.peers.size;
    const live = this.staff.filter((n) => n.state !== 'gone' && n.state !== 'leaving');
    const act = npcSwapStep(this.swap, live.length, humans, this.occ.filter((o) => o === null).length, dt, FAST);
    if (act === 'leave') {
      const n = live.find((x) => x.state === 'seated') ?? live[0];
      this.occ[n.seat.idx] = this.occ[n.seat.idx] === 'npc' ? null : this.occ[n.seat.idx];
      n.leave(pick(STAFF_OUT), () => this.removeStaff(n));
      this.refreshRings();
    } else if (act === 'enter') {
      const empty = this.B.seats.filter((s) => this.occ[s.idx] === null);
      if (empty.length) {
        const seat = empty[Math.floor(this.rnd() * empty.length)];
        const n = new StaffNpc(seat, randomLook(), this.g.stage, this.B.nav, this.B.pantry);
        n.a.addTo(this.B.scene);
        this.occ[seat.idx] = 'npc';
        n.enter(seat);
        this.staff.push(n);
        this.npcSeen++;
        this.refreshRings();
      }
    }
  }

  /* ---------------- 같이 출근하는 사람들 ---------------- */
  addPeer(p: PeerPub): void {
    if (this.peers.has(p.id) || this.disposed) return;
    const a = new Actor({ sex: p.sex, suit: p.suit as SuitKey, tie: p.tie }, 'peer', p.name);
    a.id = p.id;
    a.place(p.x, p.z, p.y).addTo(this.B.scene);
    a.net = { x: p.x, z: p.z, yaw: p.y };
    this.peers.set(p.id, a);
    this.peerState(p);
    this.tickHud();
  }
  removePeer(id: string): void {
    const a = this.peers.get(id);
    if (!a) return;
    for (let i = 0; i < this.occ.length; i++) if (this.occ[i] === id) this.occ[i] = null;
    a.dispose(); this.peers.delete(id);
    if (this.followLead === a) this.followLead = null;
    this.refreshRings(); this.tickHud();
  }
  peerState(p: PeerPub): void {
    const a = this.peers.get(p.id);
    if (!a) return;
    a.net = { x: p.x, z: p.z, yaw: p.y };
    if (p.st === 2 && p.seat >= 0 && !a.sitting) { const s = this.B.seats[p.seat]; if (s) { a.place(s.x, s.z, s.ry); a.sitAt(s); a.net = { x: s.x, z: s.z, yaw: s.ry }; } }
    else if (p.st !== 2 && a.sitting) { a.standUp(); a.leaveSeat(); }
    const cup = !!p.cup;
    if (cup !== (a.w.prop === 'cup')) { a.w.setProp(cup ? 'cup' : null); a.w.anim.carry = cup; }
  }
  /** 자리표(자리마다 실제 사람 id 또는 비어 있음) */
  applySeats(seats: Array<string | null>): void {
    const myId = this.g.net?.id;
    seats.forEach((id, i) => {
      const cur = this.occ[i];
      if (id && id !== myId) {
        if (cur === 'npc') this.npcYield(this.B.seats[i]);
        if (cur === 'me') { this.seatDenied(i); }
        this.occ[i] = id;
      } else if (id === myId) {
        this.occ[i] = 'me';
      } else if (cur && cur !== 'npc' && cur !== 'me') this.occ[i] = null;
    });
    this.refreshRings();
  }
  /** 다른 사람이 먼저 앉음 */
  seatDenied(i: number): void {
    if (this.me.seat?.idx === i && this.me.sitting) return;
    if (this.mode === 'busy' && this.me.walking) { this.me.stopWalk(); this.mode = 'walk'; this.dockKey = ''; }
    if (this.occ[i] === 'me') this.occ[i] = null;
    toast('다른 분이 먼저 앉았어요. 다른 빈자리를 골라 주세요');
    this.refreshRings();
  }
  peerEvent(k: EvKind, from: string, toMe: boolean): void {
    const a = this.peers.get(from);
    if (!a) return;
    const nm = a.name.split('#')[0];
    const face = (): void => { if (!a.sitting) a.faceTo(this.me.pos.x, this.me.pos.z); };
    switch (k) {
      case 'bow': a.w.play(a.sitting ? 'nod' : 'bow'); if (toMe) { face(); toast(`${nm}님이 인사했어요`); this.g.s.cheers++; } break;
      case 'clap': a.w.play('clap'); sfx.clap(); if (toMe) { face(); toast(`${nm}님이 박수를 보냈어요 👏`); this.g.s.cheers++; } break;
      case 'cheers': a.w.play('cheers'); a.say(this.g.stage, '짠!', 1.8, true); if (toMe) { face(); this.me.faceTo(a.pos.x, a.pos.z); this.me.w.play('cheers'); this.me.say(this.g.stage, '짠!', 1.8, true); sfx.cheers(); this.g.s.cheers++; } break;
      case 'done': a.check(this.g.stage); toast(`${nm}님이 할 일을 하나 끝냈어요`); break;
      case 'drink': a.w.play('drink'); break;
      case 'ask': if (toMe) this.askCard(a); break;
      case 'yes': if (toMe) { toast(`${nm}님이 같이 가요!`); this.leadPantry(a); } break;
      case 'no': if (toMe) toast(`${nm}님은 다음에 같이 가요`); break;
      case 'apart': if (this.followLead === a) { this.followLead = null; } break;
    }
  }
  private askEl: HTMLElement | null = null;
  /** 상대 화면: "○○님이 탕비실 같이 가자고 해요" 10초 */
  private askCard(a: Actor): void {
    this.askEl?.remove();
    let done = false;
    const answer = (yes: boolean): void => {
      if (done) return; done = true; el.remove(); this.askEl = null;
      this.g.net?.event(yes ? 'yes' : 'no', a.id);
      if (yes) { if (this.mode === 'sit' || this.mode === 'pc') this.standUp(); this.followLead = a; }
    };
    const el = h('div', { class: 'card ask' }, h('div', { class: 'ask-q' }, `${a.name.split('#')[0]}님이 탕비실 같이 가자고 해요`),
      h('div', { class: 'row' }, h('button', { class: 'btn on', onclick: () => answer(true) }, '같이 가요'), h('button', { class: 'btn', onclick: () => answer(false) }, '다음에요')));
    $ui().append(el);
    this.askEl = el;
    setTimeout(() => answer(false), (window as unknown as { __askMs?: number }).__askMs ?? 10000);
  }
  /** 먼저 제안한 사람이 앞장섬 */
  private leadPantry(partner: Actor): void {
    if (this.mode === 'sit' || this.mode === 'pc') this.standUp();
    const P = this.B.pantry.spots.coffee;
    setTimeout(() => this.me.goTo(this.B.nav, P.x - 0.2, P.z + 0.4, () => this.g.net?.event('apart', partner.id)), 300);
  }
  followLead: Actor | null = null;
  private followT = 0;
  /** 같이 걷기: 앞장선 사람 옆에 붙음 */
  private follow(dt: number): void {
    const L = this.followLead;
    if (!L || this.mode !== 'walk') return;
    this.followT -= dt;
    if (this.followT > 0) return;
    this.followT = 0.3;
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const tx = L.pos.x - rx * 0.95, tz = L.pos.z - rz * 0.95;
    if (this.me.dist(tx, tz) > 0.5) this.me.goTo(this.B.nav, tx, tz);
    if (L.pos.x > OFFICE.RW / 2 + 1.5 && !L.walking && this.me.dist(L.pos.x, L.pos.z) < 2) this.followLead = null;
  }

  /* ---------------- 퇴근 ---------------- */
  async farewell(): Promise<void> {
    closeDialog();
    this.pc.close();
    this.boardClose?.();
    this.mode = 'busy';
    this.g.hud.setDock();
    if (this.me.sitting) { this.me.standUp(); await wait(500); }
    this.g.stage.clearFixed();
    this.world.cam = WALK_CAM;
    this.me.w.setProp('bag');
    this.me.w.play('wave');
    const sup = [this.boss, this.mgr].sort((a, b) => a.a.dist(this.me.pos.x, this.me.pos.z) - b.a.dist(this.me.pos.x, this.me.pos.z))[0];
    sup.a.say(this.g.stage, pick(BYE), 2.5);
    sup.a.w.play('wave');
    await wait(1100);
  }
  dispose(): void {
    this.disposed = true;
    closeDialog(); this.pc.close(); this.boardClose?.(); this.closePersonBtns(); this.askEl?.remove();
    document.body.classList.remove('pc-open');
    for (const a of [this.me, this.boss.a, this.mgr.a, ...this.staff.map((n) => n.a), ...this.peers.values()]) a.dispose();
    $ui().querySelectorAll('.pbtns').forEach((e) => e.remove());
    for (const f of this.labelOffs) f();
  }
}
