// 부장·과장(언제나 NPC): 자리 → 걸어오기 → 말하기 → 돌아가기. 같이 탕비실 가기(옆에 붙어 걸으며 말풍선).
import * as THREE from 'three';
import { Actor, type Seat } from '../world/actor';
import type { Look } from '../character/worker';
import type { NavGrid } from '../world/nav';
import { between } from '../shared/rand';

export type SupState = 'seated' | 'approach' | 'talk' | 'return' | 'escort' | 'pantry' | 'stand';
export class Superior {
  a: Actor;
  state: SupState = 'seated';
  private onReach: (() => void) | null = null;
  private target: Actor | null = null;
  private retarget = 0;
  idleT = between(10, 30);
  constructor(public role: 'boss' | 'mgr', public name: string, look: Look, public seat: Seat, private nav: NavGrid) {
    this.a = new Actor(look, role, name);
    this.a.place(seat.x, seat.z, seat.ry);
    this.a.sitAt(seat);
    this.a.w.anim.sitW = 1;
    this.a.speed = 1.3;
  }
  get rank(): string { return this.role === 'boss' ? '부장' : '과장'; }
  get free(): boolean { return this.state === 'seated'; }
  /** 사람 옆 설 자리 */
  spotNear(who: Actor): THREE.Vector3 {
    const y = who.sitting && who.seat ? who.seat.ry : who.yaw;
    const fx = Math.sin(y), fz = Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
    const side = this.role === 'boss' ? 1 : -1;
    const cand = [[rx * side * 1.0 - fx * 0.5, rz * side * 1.0 - fz * 0.5], [-rx * side * 1.0 - fx * 0.5, -rz * side * 1.0 - fz * 0.5], [-fx * 1.2, -fz * 1.2], [fx * 1.1, fz * 1.1]];
    for (const [dx, dz] of cand) { const x = who.pos.x + dx, z = who.pos.z + dz; if (this.nav.free(x, z)) return new THREE.Vector3(x, 0, z); }
    const n = this.nav.nearestFree(who.pos.x - fx, who.pos.z - fz)!;
    return new THREE.Vector3(n.x, 0, n.z);
  }
  /** 사람에게 걸어가서 도착하면 onReach */
  visit(who: Actor, onReach: () => void): void {
    if (this.a.sitting) this.a.standUp();
    this.target = who;
    this.onReach = onReach;
    this.state = 'approach';
    const p = this.spotNear(who);
    if (!this.a.goTo(this.nav, p.x, p.z, () => this.reach())) this.reach();
  }
  private reach(): void {
    this.state = 'talk';
    if (this.target) this.a.faceTo(this.target.pos.x, this.target.pos.z);
    const f = this.onReach; this.onReach = null; f?.();
  }
  goHome(): void {
    this.state = 'return';
    this.target = null;
    this.a.w.setProp(null); this.a.w.anim.carry = false;
    if (!this.a.goTo(this.nav, this.seat.x, this.seat.z, () => this.sitHome())) this.sitHome();
  }
  private sitHome(): void { this.a.sitAt(this.seat); this.state = 'seated'; this.idleT = between(10, 40); }
  /** 같이 걷기: 사람 옆에 붙음 */
  escort(who: Actor): void { if (this.a.sitting) this.a.standUp(); this.target = who; this.state = 'escort'; }
  update(dt: number): void {
    const a = this.a;
    if (this.state === 'approach' && this.target) {
      this.retarget -= dt;
      if (this.retarget <= 0) {
        this.retarget = 1;
        const p = this.spotNear(this.target);
        if (a.dist(p.x, p.z) > 0.6 && this.target.dist(a.pos.x, a.pos.z) > 1.6) a.goTo(this.nav, p.x, p.z, () => this.reach());
      }
    }
    if (this.state === 'escort' && this.target) {
      const f = this.target, rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
      const tx = f.pos.x - rx * 0.95, tz = f.pos.z - rz * 0.95;
      this.retarget -= dt;
      if (a.dist(tx, tz) > 0.5 && this.retarget <= 0) { this.retarget = 0.35; a.goTo(this.nav, tx, tz); }
      if (!a.walking && !f.walking) a.faceTo(f.pos.x, f.pos.z);
    }
    if (this.state === 'seated') {
      this.idleT -= dt;
      if (this.idleT <= 0) { this.idleT = between(15, 45); const r = Math.random(); if (r < 0.3) a.w.play('stretch'); else if (r < 0.5) a.w.play('nod'); }
    }
    a.update(dt);
  }
}
