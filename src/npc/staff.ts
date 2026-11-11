// NPC 사원: 타자 치기(대부분), 기지개, 전화받기, 옆자리와 고개 돌려 이야기, 탕비실 다녀오기(5~8분), 가끔 게시판 앞.
// 사람이 오면 문으로 나가고(외근·회의·은행), 사람이 나가면 문으로 들어와 빈자리에 앉는다.
import { Actor, type Seat } from '../world/actor';
import { randomLook } from './looks';
import type { Look } from '../character/worker';
import type { NavGrid } from '../world/nav';
import type { Stage } from '../core/stage';
import { between, pick } from '../shared/rand';
import { STAFF_OUT, STAFF_IN } from './lines';
import { OFFICE } from '../world/office';
import type { PantryBuilt } from '../office/types';

export type StaffState = 'seated' | 'toPantry' | 'inPantry' | 'back' | 'leaving' | 'entering' | 'follow' | 'board' | 'gone';
export class StaffNpc {
  a: Actor;
  state: StaffState = 'seated';
  t = between(5, 25);
  pantryT = between(300, 480);
  /** 따라가는 사람(탕비실 같이 가기) */
  followTarget: Actor | null = null;
  constructor(public seat: Seat, look: Look = randomLook(), public stage: Stage, public nav: NavGrid, private pantry: PantryBuilt, public speedK = 1) {
    this.a = new Actor(look, 'staff');
    this.a.data.npc = this;
    this.a.place(seat.x, seat.z, seat.ry);
    this.a.sitAt(seat);
    this.a.w.anim.sitW = 1;
  }
  sitDown(seat: Seat): void { this.seat = seat; this.a.sitAt(seat); this.state = 'seated'; this.t = between(8, 30); }
  /** 문으로 나가서 사라짐 */
  leave(line = pick(STAFF_OUT), done?: () => void): void {
    if (this.a.sitting) this.a.standUp();
    this.a.say(this.stage, line, 2.6);
    this.state = 'leaving';
    this.a.w.setProp(null); this.a.w.anim.carry = false;
    this.a.goTo(this.nav, OFFICE.DOOR.x + between(-1, 1), OFFICE.DOOR.z + 0.3, () => { this.state = 'gone'; this.a.w.root.visible = false; done?.(); });
  }
  /** 문으로 들어와 seat에 앉음 */
  enter(seat: Seat): void {
    this.seat = seat;
    this.state = 'entering';
    this.a.w.root.visible = true;
    this.a.sitting = false; this.a.w.anim.sitW = 0; this.a.w.setPose('stand');
    this.a.place(OFFICE.DOOR.x + between(-1, 1), OFFICE.DOOR.z, Math.PI);
    if (Math.random() < 0.6) this.a.say(this.stage, pick(STAFF_IN), 2.2);
    this.a.goTo(this.nav, seat.x, seat.z, () => this.sitDown(seat));
  }
  /** 자리를 옮김(사람이 내 자리를 골랐을 때) */
  moveTo(seat: Seat, line: string): void {
    if (this.a.sitting) this.a.standUp();
    this.a.say(this.stage, line, 2.4);
    this.seat = seat;
    this.state = 'entering';
    this.a.goTo(this.nav, seat.x, seat.z, () => this.sitDown(seat));
  }
  goPantry(withActor: Actor | null = null): void {
    if (this.a.sitting) this.a.standUp();
    this.followTarget = withActor;
    this.state = withActor ? 'follow' : 'toPantry';
    if (!withActor) this.a.goTo(this.nav, this.pantry.spots.water.x + between(-1, 0.3), this.pantry.spots.water.z + between(-0.5, 2.5), () => { this.state = 'inPantry'; this.t = between(8, 16); this.a.faceYaw(Math.PI / 2); this.a.w.setProp('cup'); this.a.w.anim.carry = true; });
  }
  returnToSeat(): void {
    this.state = 'back';
    this.followTarget = null;
    this.a.goTo(this.nav, this.seat.x, this.seat.z, () => { this.a.w.setProp(null); this.a.w.anim.carry = false; this.sitDown(this.seat); });
  }
  update(dt: number): void {
    const a = this.a;
    if (this.state === 'gone') return;
    this.t -= dt;
    if (this.state === 'seated') {
      this.pantryT -= dt;
      if (this.pantryT <= 0) { this.pantryT = between(300, 480); this.goPantry(); }
      else if (this.t <= 0) {
        this.t = between(12, 40);
        const r = Math.random();
        if (r < 0.25) a.w.play('stretch');
        else if (r < 0.4) { a.w.setProp('phone'); a.w.play('phone', 5); setTimeout(() => a.w.setProp(null), 5300); }
        else if (r < 0.7) { a.w.anim.lookYaw = (Math.random() < 0.5 ? -1 : 1) * 0.9; setTimeout(() => (a.w.anim.lookYaw = 0), 3000); }
        else if (r < 0.75) {
          // 가끔 게시판 앞
          a.standUp(); this.state = 'board';
          a.goTo(this.nav, OFFICE.BOARD.x + 0.4, OFFICE.BOARD.z + between(-0.8, 0.8), () => { a.faceYaw(-Math.PI / 2); this.t = between(6, 12); });
        }
      }
    } else if (this.state === 'board') {
      if (!a.walking && this.t <= 0) this.returnToSeat();
    } else if (this.state === 'inPantry') {
      if (this.t <= 0) this.returnToSeat();
    } else if (this.state === 'follow' && this.followTarget) {
      const f = this.followTarget;
      // 옆에 붙어 걷기(같이 뛰기처럼)
      const side = 0.9, rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
      const tx = f.pos.x + rx * side, tz = f.pos.z + rz * side;
      if (a.dist(tx, tz) > 0.5 && (!a.walking || this.t <= 0)) { this.t = 0.4; a.goTo(this.nav, tx, tz); }
      if (!f.walking && a.dist(tx, tz) < 0.6 && !a.walking) a.faceTo(f.pos.x + Math.sin(f.yaw) * 2, f.pos.z + Math.cos(f.yaw) * 2);
    }
    a.speed = 1.3 * this.speedK;
    a.update(dt);
  }
  dispose(): void { this.a.dispose(); }
}
