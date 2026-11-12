// 화면 흐름: 타이틀 → 캐릭터 선택 → 로비(카드 찍기) → 엘리베이터 → 사무실(→ 탕비실·게시판) → 퇴근 카드 → 다시 출근
import * as THREE from 'three';
import './ui/style.css';
import { Stage, type World } from './core/stage';
import { Session } from './core/session';
import { Hud, bigBtn } from './ui/hud';
import { h, $ui, toast, fadeThrough, wait, confirmBox, isPC } from './ui/dom';
import { buildLobby, LOBBY } from './world/lobby';
import { buildElevator, buildTitle, buildSelect } from './world/scenes';
import { Actor } from './world/actor';
import { Worker } from './character/worker';
import { SUITS } from './character/parts';
import { LobbyCrowd } from './npc/lobbyNpc';
import { ELEV_CALL, ELEV_IN } from './npc/lines';
import { DEPTS, SUIT_KEYS, WALK_SPEED, type SuitKey } from './shared/consts';
import { fmtClock } from './shared/pay';
import { sfx, sound } from './core/sound';
import { portrait } from './character/portrait';
import { OfficeCtl } from './office/officeCtl';
import { showPayslip, slipData } from './ui/payslip';
import { saveResultImage } from './ui/share';
import { openGuide } from './ui/guide';
import { pick } from './shared/rand';
import { Net } from './net/room';

export class Game {
  readonly stage: Stage;
  readonly hud = new Hud();
  s = new Session();
  office: OfficeCtl | null = null;
  net: Net | null = null;
  private clockT = 0;
  private lobbyB: ReturnType<typeof buildLobby> | null = null;

  constructor(host: HTMLElement) {
    this.stage = new Stage(host);
    this.stage.onFrame = (dt) => this.frame(dt);
    window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
    window.addEventListener('keydown', (e) => this.key(e));
    (window as unknown as { __game: Game }).__game = this;
  }

  /** 기본 칩: [퇴근하기] [조작법] [소리] */
  chips(withLeave: boolean): void {
    const list = [];
    if (withLeave) list.push({ label: '퇴근하기', white: true, on: () => void this.leave() });
    list.push({ label: '조작법', on: () => openGuide() });
    list.push({ label: sound.on ? '소리 끔' : '소리 켬', on: () => { sound.on = !sound.on; this.chips(withLeave); } });
    if (this.stage.yawOff || this.stage.pitchOff || this.stage.zoom !== 1) list.push({ label: '원래 시점', on: () => { this.stage.resetView(); this.chips(withLeave); } });
    this.hud.setChips(list);
  }

  private frame(dt: number): void {
    this.clockT -= dt;
    if (this.clockT <= 0) {
      this.clockT = 0.5;
      this.office?.tickHud();
      const moved = !!(this.stage.yawOff || this.stage.pitchOff || this.stage.zoom !== 1);
      if (moved !== this.viewMoved) { this.viewMoved = moved; this.chips(this.inOffice || this.inLobby); }
    }
  }
  private viewMoved = false;
  private inOffice = false;
  private inLobby = false;

  private key(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && this.inLobby && this.cardBtn) { e.preventDefault(); this.cardBtn.click(); }
    this.office?.key(k, e);
  }

  /* ================= 타이틀 ================= */
  async title(ready: () => void): Promise<void> {
    const t = buildTitle();
    const me = new Worker({ suit: 'navy' }); me.root.position.set(0, 0, 1.4); me.play('wave', Infinity); me.mouthDefault = true;
    const walkers = [new Worker({ sex: 'f', suit: 'navy' }), new Worker({ suit: 'charcoal', tie: 0x3d8bd9 })];
    walkers[0].root.position.set(-1.4, 0, -0.8); walkers[1].root.position.set(1.6, 0, -0.5);
    for (const w of walkers) { w.root.scale.setScalar(0.9); w.root.rotation.y = Math.PI; w.setPose('walk'); }
    for (const w of [me, ...walkers]) { w.root.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; }); t.scene.add(w.root); }
    const world: World = { scene: t.scene, light: { sun: [-6, 14, 10], box: 12 }, cam: null, update: (dt) => { me.update(dt); for (const w of walkers) w.update(dt); } };
    this.stage.setWorld(world);
    this.stage.setFixed(t.cam.pos, t.cam.tgt, t.cam.fov);
    // 다음 장면을 미리 만들어 둠(입장 속도)
    await wait(30);
    this.lobbyB = buildLobby();
    this.stage.r.compile(this.lobbyB.scene, this.stage.camera);
    ready();
  }

  /* ================= 캐릭터 선택 ================= */
  select(): void {
    this.inOffice = false; this.inLobby = false;
    this.hud.hide();
    const sel = buildSelect();
    const m = new Worker({ sex: 'm', suit: this.s.suit, tie: this.s.tie });
    const f = new Worker({ sex: 'f', suit: this.s.suit });
    const ws = [m, f];
    const base = [new THREE.Vector3(-0.85, 0.16, 0), new THREE.Vector3(0.85, 0.16, 0)];
    ws.forEach((w, i) => { w.root.position.copy(base[i]); w.root.rotation.y = i ? -0.12 : 0.12; w.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; }); sel.scene.add(w.root); w.play('wave', Infinity); w.mouthDefault = true; });
    let chosen = -1;
    const fwd = [0, 0];
    const world: World = {
      scene: sel.scene, light: { sun: [-3, 7, 6], box: 4 }, cam: null,
      update: (dt) => {
        ws.forEach((w, i) => {
          const tgt = chosen === i ? 0.35 : 0; fwd[i] += (tgt - fwd[i]) * Math.min(1, dt * 8);
          w.root.position.z = base[i].z + fwd[i];
          w.update(dt);
        });
      },
      onTap: (ray) => {
        for (let i = 0; i < 2; i++) { if (ray.intersectObject(ws[i].root, true).length) { choose(i); return; } }
        const hits = ray.intersectObjects(sel.pads, false); if (hits.length) choose(sel.pads.findIndex((x) => x === hits[0].object));
      },
    };
    this.stage.setWorld(world);
    const camPos = new THREE.Vector3(0, 1.75, 11), camTgt = new THREE.Vector3(0, 0.82, 0);
    this.stage.setFixed(camPos, camTgt, sel.cam.fov);
    const pills = [0, 1].map((i) => h('button', { class: 'sel-pill', onclick: () => choose(i) }, i ? '여사원' : '남사원'));
    const area = h('div', { class: 'sel-stage' });
    const dots = h('div', { class: 'sel-dots' });
    const drawDots = (): void => { dots.replaceChildren(...SUIT_KEYS.map((k) => h('button', { class: 'sel-dot' + (k === this.s.suit ? ' on' : ''), style: `background:#${SUITS[k].toString(16).padStart(6, '0')}`, 'aria-label': k, onclick: () => { this.s.suit = k as SuitKey; for (const w of ws) w.setSuit(k); drawDots(); } }))); };
    drawDots();
    const go = bigBtn('출근하기', () => void start(), 'on');
    go.disabled = true;
    // 위에서 아래로 차례로 쌓음: 제목 → 캐릭터 칸 → 남사원·여사원 → 정장 색 → 출근하기(어떤 화면 높이에서도 가려지지 않게)
    const ui = h('div', { class: 'sel' },
      h('div', { class: 'sel-top' }, h('div', { class: 'sel-k' }, '(주)무한채용 신입사원 등록'), h('div', { class: 'sel-q' }, '누구로 출근할까요?')),
      area,
      h('div', { class: 'sel-pills' }, ...pills),
      h('div', { class: 'card sel-card' }, h('div', { class: 'sel-l' }, '정장 색'), dots, h('div', { class: 'sel-name' }, '오늘의 이름 ', h('b', {}, this.s.name), ' · 매일 새로 정해져요')),
      h('div', { class: 'sel-go' }, go));
    $ui().append(ui);
    // 캐릭터를 빈 칸(area) 가운데에, 칸 높이에 맞춰 그림
    const fit = (): void => {
      const r = area.getBoundingClientRect(), W = this.stage.W, H = this.stage.H;
      if (r.height < 40) return;
      const d = camPos.distanceTo(camTgt);
      const tV = (2.1 / 2 / d / 0.86) * (H / r.height); // 높이 2.1이 칸의 86%
      const Wa = Math.min(W, 520), tHx = (3.6 / 2 / d / 0.94) * (W / Wa); // 폭 3.6이 가운데 520px의 94%
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(tV, tHx * (H / W))));
      this.stage.setFixed(camPos, camTgt, Math.min(80, fov));
      // 발판이 이름 버튼 바로 위에 오게(칸 아래쪽에 붙임)
      const pad = this.stage.project(new THREE.Vector3(0, 0, 0.66));
      this.stage.viewShift += r.bottom - 4 - pad.y;
    };
    const choose = (i: number): void => {
      if (i < 0) return;
      chosen = i;
      this.s.sex = i ? 'f' : 'm';
      ws[i].play('nod'); ws[i].setOpacity(1); ws[1 - i].setOpacity(0.45);
      (sel.pads[i].material as THREE.MeshStandardMaterial).color.set(0x8fd3ff); (sel.pads[1 - i].material as THREE.MeshStandardMaterial).color.set(0xffffff);
      pills.forEach((p, k) => p.classList.toggle('on', k === i));
      go.disabled = false;
      sfx.pop();
    };
    // 라벨 위치: 캐릭터 발밑
    const place = (): void => {
      fit();
      ws.forEach((_w, i) => { const p = this.stage.project(new THREE.Vector3(base[i].x, 0.1, base[i].z)); pills[i].style.left = p.x + 'px'; });
    };
    const ro = (): void => { if (ui.isConnected) { place(); requestAnimationFrame(ro); } else this.stage.viewShift = 0; };
    requestAnimationFrame(ro);
    const start = async (): Promise<void> => {
      if (chosen < 0) return;
      await fadeThrough(() => { ui.remove(); this.lobby(); });
    };
  }

  /* ================= 로비 ================= */
  private cardBtn: HTMLButtonElement | null = null;
  lobby(): void {
    this.inLobby = true;
    const L = this.lobbyB ?? buildLobby();
    this.lobbyB = null;
    const me = new Actor({ sex: this.s.sex, suit: this.s.suit, tie: this.s.tie }, 'me', this.s.name).place(LOBBY.START.x, LOBBY.START.z, Math.PI).addTo(L.scene);
    const crowd = new LobbyCrowd(L.scene, L.nav, L.lanes);
    let carded = false, busy = false;
    const world: World = {
      scene: L.scene, light: { sun: [-8, 16, 10], box: 18 },
      cam: { phone: { fov: 64, up: 3.3, back: 9.9, ahead: 4.5, tgtY: 3.0 }, pc: { fov: 50, up: 3.6, back: 12.5, ahead: 4.5, tgtY: 3.6 } },
      focus: () => me.pos,
      update: (dt) => {
        me.update(dt); crowd.update(dt, me, this.stage.W > this.stage.H ? 6.5 : 2.4); L.update(dt);
        L.meRing.position.set(me.pos.x, 0, me.pos.z);
        const near = Math.abs(me.pos.z - LOBBY.GZ) < 1.5 + 0.75 && me.pos.z > LOBBY.GZ && Math.abs(me.pos.x) < 5.6;
        if (!carded && !busy) { if (near && !this.cardBtn) this.showCardBtn(() => void tapCard()); else if (!near && this.cardBtn) { this.cardBtn = null; this.hud.setDock(); } }
      },
      onTap: (ray) => {
        if (busy) return;
        const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        if (p) me.goTo(L.nav, p.x, p.z);
      },
      onKey: (d, dt) => { if (busy) return; me.stopWalk(); const nx = me.pos.x + d.x * WALK_SPEED * dt, nz = me.pos.z + d.y * WALK_SPEED * dt; if (L.nav.free(nx, nz)) { me.pos.x = nx; me.pos.z = nz; me.faceYaw(Math.atan2(d.x, d.y)); me.w.setPose('walk'); me.w.anim.speed = 1.8; } },
    };
    let keyIdle = 0;
    const baseUpd = world.update;
    world.update = (dt, t) => { baseUpd(dt, t); if (!this.stage.keys.size && !me.walking && me.w.anim.base === 'walk') { keyIdle += dt; if (keyIdle > 0.05) me.w.setPose('stand'); } else keyIdle = 0; };
    this.stage.setWorld(world);
    me.tag(this.stage, this.s.name);
    this.hud.show();
    this.hud.title('1층 로비', this.stage.pc ? '사원증을 찍고 들어가요 · 클릭한 곳으로 걸어가요' : '사원증을 찍고 들어가요');
    this.chips(false);
    this.hud.setDock();
    // 위에: 지금 회사에 함께 있는 사람(로비 NPC 포함)
    let bldg = 0;
    const showCount = (): void => this.hud.count(crowd.list.length + 1 + bldg, '지금 회사에 함께');
    showCount();
    void fetch('/api/count', { cache: 'no-store' }).then((r) => (r.headers.get('content-type') || '').includes('json') ? r.json() : null).then((j: { total?: number } | null) => { if (j?.total) { bldg = j.total; if (this.inLobby) showCount(); } }).catch(() => undefined);
    const tapCard = async (): Promise<void> => {
      if (carded || busy) return;
      busy = true;
      this.cardBtn = null; this.hud.setDock();
      // 가장 가까운 줄
      const lane = L.lanes.reduce((a, b) => (Math.abs(b.x - me.pos.x) < Math.abs(a.x - me.pos.x) ? b : a));
      await new Promise<void>((res) => { me.walkStraight([{ x: lane.x + 0.15, z: LOBBY.GZ + 0.95 }], res); });
      me.faceYaw(Math.PI);
      me.w.setProp('card'); me.w.play('card');
      await wait(600);
      // 부서 배정(같이 출근: 서버가 정함)
      const as = await this.assign();
      this.s.dept = as.dept; this.s.building = as.building;
      // 같이 출근: 부서 방에 연결(안 되면 혼자 출근)
      if (as.live) this.joinRoom(as.building, as.dept, true);
      this.s.startAt = Date.now();
      sfx.beep();
      (lane.reader.material as THREE.MeshStandardMaterial).color.set(0x34c77b);
      lane.target = 1; L.openLane(lane, true);
      carded = true;
      this.idCard();
      this.hud.title('1층 로비', '삑! 출입이 확인됐어요');
      await wait(500);
      me.w.setProp(null);
      toast(`${DEPTS[this.s.dept].name}로 배정됐어요 · 엘리베이터로 가요`, 2600);
      await wait(1000);
      await new Promise<void>((res) => me.walkStraight([{ x: lane.x, z: LOBBY.GZ - 1.2 }, { x: lane.x * 0.4 - 1.5, z: LOBBY.HALL_Z }], res));
      me.untag();
      await fadeThrough(() => { crowd.dispose(); me.dispose(); this.inLobby = false; this.elevator(); });
    };
  }
  private showCardBtn(on: () => void): void {
    this.cardBtn = bigBtn('🪪 카드 찍기', on, 'on', 'Space');
    this.hud.setDock(this.cardBtn);
  }
  /** 사원증 카드(1.5초) */
  private idCard(): void {
    const face = portrait(this.stage.r, { sex: this.s.sex, suit: this.s.suit, tie: this.s.tie }, 68, 80);
    const d = new Date(this.s.startAt);
    const c = h('div', { class: 'card idcard', html: `<div class="id-top"><span class="id-inf">∞</span><span>(주)무한채용</span><span class="id-k">사원증</span></div>
      <div class="id-body"><img src="${face}" alt=""><div><div class="id-d">${DEPTS[this.s.dept].name} · ${DEPTS[this.s.dept].floor}층</div><div class="id-n">${this.s.name.split('#')[0]}</div><div class="id-no">#${this.s.name.split('#')[1]}</div><div class="id-t">● 오늘 출근 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</div></div></div>` });
    $ui().append(c);
    setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 300); }, 1500);
  }
  /** 부서 방 연결. 그 사이 꽉 찼으면 한 번 더 배정받음(부서가 바뀌기 전, 사무실에 들어가기 전일 때만) */
  private joinRoom(b: number, d: number, retry: boolean): void {
    const net = new Net(this, b, d);
    this.net = net;
    net.onFull = () => {
      if (this.net !== net) return;
      this.net = null;
      if (retry && !this.office) void this.assign().then((a) => { if (a.live && !this.office) { this.s.dept = a.dept; this.s.building = a.building; this.joinRoom(a.building, a.dept, false); } else toast('오늘은 자리가 꽉 찼어요. 혼자 출근으로 이어 가요'); });
      else toast('부서 자리가 꽉 차서 혼자 출근으로 이어 가요');
    };
    net.connect();
  }
  /** 부서 배정: 서버에 물어보고, 안 되면 혼자 출근(무작위) */
  private async assign(): Promise<{ dept: number; building: number; live: boolean }> {
    try {
      const r = await fetch('/api/assign', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const j = (await r.json()) as { dept: number; building: number; full?: boolean }; if (!j.full) return { ...j, live: true }; }
    } catch { /* 혼자 출근 */ }
    return { dept: Math.floor(Math.random() * DEPTS.length), building: 0, live: false };
  }

  /* ================= 엘리베이터 ================= */
  elevator(): void {
    const E = buildElevator();
    const floorNo = DEPTS[this.s.dept].floor;
    const me = new Actor({ sex: this.s.sex, suit: this.s.suit, tie: this.s.tie }, 'me', this.s.name, 1).place(-0.55, 2.3, Math.PI + 0.15).addTo(E.scene);
    me.w.setPose('walk'); me.w.anim.speed = 0;
    const n1 = new Actor({ sex: 'f', suit: 'navy' }, 'extra', '', 1).place(-0.6, -3.2, 0.15).addTo(E.scene);
    const n2 = new Actor({ suit: 'gray', tie: 0x3aa76d }, 'extra', '', 1).place(0.55, -3.0, -0.15).addTo(E.scene);
    n2.w.play('beckon', Infinity); n2.w.mouthDefault = true;
    let inside = false;
    const world: World = {
      scene: E.scene, light: { sun: [-3, 8, 8], box: 8 }, cam: null,
      update: (dt) => { me.update(dt); n1.update(dt); n2.update(dt); E.update(dt); E.meRing.position.set(me.pos.x, 0, me.pos.z); E.meRing.visible = !inside; },
      onTap: (ray) => { const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()); if (p && p.z < 0.5 && Math.abs(p.x) < 2.5) void ride(); },
    };
    this.stage.setWorld(world);
    this.stage.setFixed(E.cam.pos, E.cam.tgt, E.cam.fov);
    this.hud.title('엘리베이터 홀', `${floorNo}층 ${DEPTS[this.s.dept].name}로`);
    this.chips(true);
    n2.say(this.stage, pick(ELEV_CALL), 30, true);
    me.tag(this.stage, this.s.name);
    const rideBtn = bigBtn('엘리베이터 타기', () => void ride(), 'on', 'Space');
    this.hud.setDock(rideBtn);
    const keyRide = (e: KeyboardEvent): void => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void ride(); } };
    window.addEventListener('keydown', keyRide);
    const ride = async (): Promise<void> => {
      if (inside) return;
      inside = true;
      window.removeEventListener('keydown', keyRide);
      this.hud.setDock();
      n2.hush(); n2.w.anim.stop(); n2.w.mouthDefault = false;
      me.untag();
      me.speed = 3;
      await new Promise<void>((res) => me.walkStraight([{ x: -0.1, z: -1.4 }, { x: 0.0, z: -2.5 }], res));
      me.faceYaw(0); n2.faceYaw(0.1);
      E.setDoors(false);
      await wait(400);
      n1.say(this.stage, ELEV_IN[0], 2);
      // 층 표시 1 → 내 층(2초)
      for (let f = 1; f <= floorNo; f++) { E.drawFloor(f, f < floorNo); await wait(2000 / floorNo); }
      sfx.ding();
      E.setDoors(true);
      await wait(700);
      await fadeThrough(() => { me.dispose(); n1.dispose(); n2.dispose(); this.enterOffice(); });
    };
  }

  /* ================= 사무실 ================= */
  enterOffice(): void {
    this.inOffice = true;
    this.hud.show();
    this.office = new OfficeCtl(this);
    this.chips(true);
  }

  /** 시험용: 로비·엘리베이터를 건너뛰고 바로 부서 사무실로(배정·연결 포함) */
  async debugEnter(sex: 'm' | 'f' = 'm'): Promise<void> {
    $ui().querySelector('.sel')?.remove();
    this.s.sex = sex;
    const as = await this.assign();
    this.s.dept = as.dept; this.s.building = as.building; this.s.startAt = Date.now();
    if (as.live) this.joinRoom(as.building, as.dept, true);
    await wait(800);
    this.enterOffice();
  }
  /** 시험용: 월드 좌표를 눌러 봄 */
  debugTapWorld(x: number, z: number, y = 0): void { const p = this.stage.project(new THREE.Vector3(x, y, z)); this.stage.tap(p.x, p.y); }
  /** 지금 근무 중 시계 */
  clock(): string { return fmtClock(this.s.workedMs()); }

  /* ================= 퇴근 ================= */
  private leaving = false;
  async leave(skipConfirm = false): Promise<void> {
    if (this.leaving || !this.s.startAt) return;
    if (!skipConfirm) {
      const ok = await confirmBox('오늘 업무를 마치고 퇴근할까요?', '퇴근하기', '조금 더 일할게요');
      if (!ok) return;
    }
    this.leaving = true;
    this.s.endAt = Date.now();
    await this.office?.farewell();
    const people = this.office?.coworkers() ?? 0;
    await fadeThrough(() => {
      this.office?.dispose(); this.office = null; this.inOffice = false;
      this.net?.close(); this.net = null;
      this.hud.hide();
      this.stage.lowPower = true;
      const d = slipData(this.s, people);
      const el = showPayslip(d, {
        save: () => void saveResultImage(d, this.stage.r, { sex: this.s.sex, suit: this.s.suit, tie: this.s.tie }),
        again: () => void fadeThrough(() => { el.remove(); this.restart(); }),
      });
    }, 300);
  }
  restart(): void {
    this.stage.lowPower = false;
    this.s = new Session();
    this.leaving = false;
    $ui().querySelectorAll('.veil,.dialog,.pc-win,.board-wrap').forEach((e) => e.remove());
    this.select();
  }
  get pc(): boolean { return isPC(); }
}
