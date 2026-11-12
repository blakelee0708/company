// 로비 NPC 8~12명: 걷기, 서서 통화하기, 커피 들고 걷기, 게이트 통과하기. 내 쪽으로 오면 살짝 비켜 감.
import * as THREE from 'three';
import { Actor } from '../world/actor';
import { randomLook } from './looks';
import { LOBBY, type Lane } from '../world/lobby';
import type { NavGrid } from '../world/nav';
import { between, pick } from '../shared/rand';

type Beh = 'wander' | 'phone' | 'coffee' | 'gate' | 'wait' | 'desk';
interface N { a: Actor; beh: Beh; t: number; phase: number; lane?: Lane }

export class LobbyCrowd {
  list: N[] = [];
  constructor(scene: THREE.Scene, private nav: NavGrid, private lanes: Lane[]) {
    const add = (beh: Beh, x: number, z: number, yaw = Math.PI): N => {
      const a = new Actor(randomLook(), 'extra').place(x, z, yaw).addTo(scene);
      a.speed = between(1.5, 2.0);
      const n: N = { a, beh, t: between(0, 3), phase: 0 };
      this.list.push(n);
      return n;
    };
    // 엘리베이터 앞에서 기다리는 사람들
    add('wait', -4.4, -12.4, Math.PI); add('wait', -1.2, -12.2, Math.PI + 0.2); add('wait', 1.8, -12.6, Math.PI - 0.2);
    // 안내 데스크
    const d = add('desk', 7.4, 1.2, -0.4); d.a.w.setPose('sitType'); d.a.sitting = true;
    // 오가는 사람들
    add('wander', 3.0, 2.4); add('wander', -3.6, 3.6); add('coffee', 3.8, 7.0); add('phone', -8.2, 6.5, 0.8);
    add('gate', 1.2, 9.0); add('gate', -4.0, 11.0); add('wander', 5.0, 9.5);
    for (const n of this.list) {
      if (n.beh === 'coffee') { n.a.w.setProp('cup'); n.a.w.anim.carry = true; }
      if (n.beh === 'phone') { n.a.w.setProp('phone'); n.a.w.play('phone'); }
    }
  }
  update(dt: number, me: Actor, lane = 2.4): void {
    for (const n of this.list) {
      const a = n.a;
      n.t -= dt;
      // 비켜 가기
      if (a.walking) {
        const d = a.dist(me.pos.x, me.pos.z);
        if (d < 1.8 && d > 0.01) {
          const ax = (a.pos.x - me.pos.x) / d, az = (a.pos.z - me.pos.z) / d;
          const nx = a.pos.x + ax * dt * 1.8, nz = a.pos.z + az * dt * 1.8;
          if (this.nav.free(nx, nz)) { a.pos.x = nx; a.pos.z = nz; }
        }
      }
      // 카메라와 나 사이(내 뒤쪽 길)는 비워 둠
      if (a.walking || n.beh === 'phone') {
        const dx = a.pos.x - me.pos.x, dz = a.pos.z - me.pos.z;
        if (dz > -0.5 && dz < 12 && Math.abs(dx) < lane) { const nx = a.pos.x + Math.sign(dx || 1) * dt * 1.6; if (this.nav.free(nx, a.pos.z)) a.pos.x = nx; }
      }
      if (n.beh === 'wander' || n.beh === 'coffee') {
        if (!a.walking && n.t <= 0) {
          let x = between(-9.5, 9.5), z = between(-1.5, 11);
          // 내 바로 뒤(카메라 쪽)와 내 옆은 피함
          for (let k = 0; k < 8 && (Math.abs(x - me.pos.x) < lane + 1 && z > me.pos.z - 2); k++) { x = between(-9.5, 9.5); z = between(-1.5, 11); }
          if (!a.goTo(this.nav, x, z)) n.t = 1; else n.t = between(2, 6);
        }
      } else if (n.beh === 'gate') this.gate(n);
      a.update(dt);
    }
  }
  private gate(n: N): void {
    const a = n.a, gz = LOBBY.GZ;
    if (a.walking || n.t > 0) return;
    if (n.phase === 0) { n.lane = pick(this.lanes); a.goTo(this.nav, n.lane.x, gz + 1.0, () => { a.faceYaw(Math.PI); }); n.phase = 1; return; }
    if (n.phase === 1) { a.w.setProp('card'); a.w.play('card'); n.lane!.target = 1; n.t = 0.7; n.phase = 2; return; }
    if (n.phase === 2) { a.w.setProp(null); a.walkStraight([{ x: n.lane!.x, z: gz - 1.2 }, { x: n.lane!.x + between(-2, 2), z: LOBBY.HALL_Z }]); n.phase = 3; n.t = 1.0; return; }
    if (n.phase === 3) { n.lane!.target = 0; n.t = between(1, 3); n.phase = 4; return; }
    if (n.phase === 4) { a.place(between(-8, 8), 12.5, Math.PI); n.phase = 0; n.t = between(1, 4); }
  }
  dispose(): void { for (const n of this.list) n.a.dispose(); this.list = []; }
}
