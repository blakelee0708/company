// 같이 출근(실시간): 부서 방 WebSocket. 위치는 움직일 때 1초에 3번, 앉아 있으면 바뀔 때만.
// 할 일 내용은 보내지 않는다. 연결이 안 되면 혼자 출근으로 계속한다.
import type { Game } from '../game';
import type { OfficeCtl } from '../office/officeCtl';
import type { BoardSource, Note } from '../ui/board';
import type { ClientMsg, EvKind, PeerPub, ServerMsg, St } from '../shared/protocol';
import { r2 } from '../shared/protocol';
import { BOARD_PER_PERSON } from '../shared/consts';
import { BOARD_SEED } from '../shared/boardSeed';
import { toast } from '../ui/dom';
import { crisisHelp } from '../ui/board';

class NetBoard implements BoardSource {
  list: Note[] = BOARD_SEED.map((t, i) => ({ id: 'seed' + i, text: t }));
  private subs = new Set<() => void>();
  mine = 0;
  constructor(private net: Net) {}
  notes(): Note[] { return this.list; }
  post(text: string): void {
    if (!this.net.live) { this.mine++; this.list.push({ id: 'me' + Date.now(), text, mine: true }); this.emit(); return; }
    this.mine++;
    this.net.send({ t: 'note', text });
  }
  report(id: string): void { this.net.send({ t: 'report', id }); }
  canPost(): boolean { return this.mine < BOARD_PER_PERSON; }
  onChange(f: () => void): () => void { this.subs.add(f); return () => this.subs.delete(f); }
  emit(): void { for (const f of this.subs) f(); }
}

export class Net {
  ws: WebSocket | null = null;
  id = '';
  live = false;
  board: NetBoard;
  peers = new Map<string, PeerPub>();
  seats: Array<string | null> = [];
  office: OfficeCtl | null = null;
  private ping = 0;
  private lastSent = 0;
  private lastKey = '';
  private closed = false;
  private retried = false;
  onFull: (() => void) | null = null;

  constructor(private g: Game, public building: number, public dept: number) {
    this.board = new NetBoard(this);
  }
  connect(): void {
    if (this.closed) return;
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws/dept?b=${this.building}&d=${this.dept}`);
      this.ws = ws;
      ws.onopen = () => {
        const s = this.g.s;
        this.send({ t: 'hi', name: s.name, sex: s.sex, suit: s.suit, tie: s.tie });
        this.ping = window.setInterval(() => this.send({ t: 'ping' }), 25000);
      };
      ws.onmessage = (e) => { try { this.onMsg(JSON.parse(String(e.data)) as ServerMsg); } catch { /* */ } };
      ws.onclose = () => {
        clearInterval(this.ping);
        const was = this.live;
        this.live = false;
        if (this.closed) return;
        // 다른 사람들은 지움(혼자 출근으로 계속)
        for (const id of [...this.peers.keys()]) { this.peers.delete(id); this.office?.removePeer(id); }
        if (!this.retried) { this.retried = true; setTimeout(() => this.connect(), 2000); }
        else if (was) toast('연결이 끊겨서 혼자 출근으로 이어 가요');
      };
      ws.onerror = () => { /* onclose가 처리 */ };
    } catch { /* 혼자 출근 */ }
  }
  send(m: ClientMsg): void { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  close(): void { this.closed = true; clearInterval(this.ping); try { this.ws?.close(); } catch { /* */ } this.ws = null; this.live = false; }

  attach(o: OfficeCtl): void {
    this.office = o;
    for (const p of this.peers.values()) o.addPeer(p);
    if (this.seats.length) o.applySeats(this.seats);
  }
  claimSeat(i: number): boolean { if (this.live) this.send({ t: 'seat', i }); return true; }
  event(k: EvKind | string, to?: string): void { this.send({ t: 'e', k: k as EvKind, to }); }
  /** 내 위치·상태 보내기(움직이면 1초에 3번까지, 앉아 있으면 바뀔 때만) */
  sendState(force = true): void {
    const o = this.office;
    if (!o || !this.live) return;
    const me = o.me;
    const st: St = me.sitting ? 2 : me.walking || me.w.anim.base === 'walk' ? 1 : o.inPantry ? 3 : 0;
    const seat = me.sitting && me.seat ? me.seat.idx : -1;
    const m: ClientMsg = { t: 's', x: r2(me.pos.x), z: r2(me.pos.z), y: r2(me.yaw), st, seat, cup: o.carry ? 1 : 0 };
    const key = `${m.x},${m.z},${st},${seat},${m.cup}`;
    const now = performance.now();
    if (key === this.lastKey && !force) return;
    if (!force && st === 1 && now - this.lastSent < 333) return;
    this.lastKey = key; this.lastSent = now;
    this.send(m);
  }

  private onMsg(m: ServerMsg): void {
    const o = this.office;
    switch (m.t) {
      case 'welcome':
        this.id = m.id; this.live = true;
        for (const p of m.peers) { this.peers.set(p.id, p); this.g.s.coworkers.add(p.id); o?.addPeer(p); }
        this.seats = m.seats; o?.applySeats(m.seats);
        if (m.notes.length) { this.board.list = m.notes.map((n) => ({ id: n.id, text: n.text })); this.board.emit(); }
        o?.tickHud();
        this.sendState();
        break;
      case 'join': this.peers.set(m.p.id, m.p); this.g.s.coworkers.add(m.p.id); o?.addPeer(m.p); o?.tickHud(); break;
      case 'leave': this.peers.delete(m.id); o?.removePeer(m.id); o?.tickHud(); break;
      case 'snap': for (const r of m.p) { const p = this.peers.get(r[0]); if (!p) continue; [p.x, p.z, p.y, p.st, p.seat, p.cup] = [r[1], r[2], r[3], r[4], r[5], r[6]]; o?.peerState(p); } break;
      case 'seats': this.seats = m.seats; o?.applySeats(m.seats); break;
      case 'seatNo': o?.seatDenied(m.i); break;
      case 'e': o?.peerEvent(m.k, m.from, m.to === this.id); break;
      case 'note': this.board.list.push({ id: m.n.id, text: m.n.text, mine: m.n.by === this.id }); if (this.board.list.length > 40) this.board.list.splice(0, this.board.list.length - 40); this.board.emit(); break;
      case 'noteNo': this.board.mine = Math.max(0, this.board.mine - 1); if (m.crisis) crisisHelp(); else toast(m.msg); break;
      case 'hide': this.board.list = this.board.list.filter((n) => n.id !== m.id); this.board.emit(); break;
      case 'full': this.closed = true; this.live = false; this.onFull?.(); break;
      case 'pong': break;
    }
  }
}
