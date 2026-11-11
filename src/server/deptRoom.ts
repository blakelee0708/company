// 부서 하나 = 방 하나(정원 20). WebSocket Hibernation을 쓴다.
// 사람마다 위치·자리를 소켓 첨부(attachment)에만 두고, 어디에도 저장하지 않는다.
// NPC는 서버에 없다: 각 기기가 자리표를 보고 같은 규칙으로 그린다.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './worker';
import { DEPT_CAP, SEATS, SNAP_MS } from '../shared/consts';
import type { ClientMsg, PeerPub, ServerMsg, SnapRow, St } from '../shared/protocol';
import { r2 } from '../shared/protocol';

interface Att extends PeerPub { ready: boolean; dirty: boolean }
const clamp = (v: number, a: number, b: number): number => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a);
const SUITS = new Set(['navy', 'charcoal', 'gray', 'black', 'beige', 'pink']);
const NAME_RE = /^[가-힣]사원#\d{4}$/;

export class DeptRoom extends DurableObject<Env> {
  private b = 0;
  private d = 0;
  private flushT: ReturnType<typeof setTimeout> | null = null;
  private countT: ReturnType<typeof setTimeout> | null = null;
  private lastCount = -1;

  private socks(): WebSocket[] { return this.ctx.getWebSockets(); }
  private att(ws: WebSocket): Att | null { try { return ws.deserializeAttachment() as Att | null; } catch { return null; } }
  private save(ws: WebSocket, a: Att): void { ws.serializeAttachment(a); }
  private send(ws: WebSocket, m: ServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* 닫힘 */ } }
  private broadcast(m: ServerMsg, except?: WebSocket): void { const s = JSON.stringify(m); for (const ws of this.socks()) if (ws !== except && this.att(ws)?.ready) { try { ws.send(s); } catch { /* */ } } }
  private ready(): Array<[WebSocket, Att]> { const out: Array<[WebSocket, Att]> = []; for (const ws of this.socks()) { const a = this.att(ws); if (a?.ready) out.push([ws, a]); } return out; }
  private seats(): Array<string | null> { const s: Array<string | null> = new Array(SEATS).fill(null); for (const [, a] of this.ready()) if (a.seat >= 0 && a.seat < SEATS) s[a.seat] = a.id; return s; }
  private pub(a: Att): PeerPub { const { id, name, sex, suit, tie, x, z, y, st, seat, cup } = a; return { id, name, sex, suit, tie, x, z, y, st, seat, cup }; }

  /** 건물 방에 인원 알림(배정용) */
  private reportCount(force = false): void {
    const n = this.ready().length;
    if (!force && n === this.lastCount) return;
    this.lastCount = n;
    const stub = this.env.BUILDING.get(this.env.BUILDING.idFromName('b' + this.b));
    this.ctx.waitUntil(stub.fetch(`https://b/count?b=${this.b}&d=${this.d}&n=${n}`).then(() => undefined).catch(() => undefined));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.searchParams.has('b')) { this.b = Number(url.searchParams.get('b')) | 0; this.d = Number(url.searchParams.get('d')) | 0; }
    if (url.pathname === '/push') {
      // 건물 방이 보낸 게시판 소식
      const m = (await req.json()) as ServerMsg;
      this.broadcast(m);
      return new Response('ok');
    }
    if (url.pathname === '/count') return Response.json({ n: this.ready().length });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    const full = this.socks().length > DEPT_CAP;
    if (full) { this.send(server, { t: 'full' }); server.close(4000, 'full'); return new Response(null, { status: 101, webSocket: client }); }
    const id = Math.random().toString(36).slice(2, 10);
    const a: Att = { id, name: '', sex: 'm', suit: 'navy', tie: 0, x: 0, z: 9, y: Math.PI, st: 0, seat: -1, cup: 0, ready: false, dirty: false };
    this.save(server, a);
    // 메타 정보(건물·부서)도 첨부에 같이 둠: 잠들었다 깨어나도 앎
    server.serializeAttachment({ ...a, b: this.b, d: this.d });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let m: ClientMsg;
    try { m = JSON.parse(raw) as ClientMsg; } catch { return; }
    const a = this.att(ws) as (Att & { b?: number; d?: number }) | null;
    if (!a) return;
    if (a.b !== undefined) { this.b = a.b; this.d = a.d ?? 0; }
    switch (m.t) {
      case 'hi': {
        if (a.ready) return;
        a.name = NAME_RE.test(m.name) ? m.name : '김사원#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        a.sex = m.sex === 'f' ? 'f' : 'm';
        a.suit = SUITS.has(m.suit) ? m.suit : 'navy';
        a.tie = Number(m.tie) | 0;
        a.ready = true;
        this.save(ws, a);
        const peers = this.ready().filter(([w]) => w !== ws).map(([, p]) => this.pub(p));
        let notes: Array<{ id: string; text: string }> = [];
        try { const r = await this.env.BUILDING.get(this.env.BUILDING.idFromName('b' + this.b)).fetch(`https://b/board?b=${this.b}`); notes = await r.json(); } catch { /* 게시판 없이 */ }
        this.send(ws, { t: 'welcome', id: a.id, peers, seats: this.seats(), notes });
        this.broadcast({ t: 'join', p: this.pub(a) }, ws);
        this.reportCount();
        return;
      }
      case 's': {
        if (!a.ready) return;
        a.x = r2(clamp(m.x, -10, 16)); a.z = r2(clamp(m.z, -20, 12)); a.y = r2(clamp(m.y, -7, 7));
        a.st = ([0, 1, 2, 3].includes(m.st) ? m.st : 0) as St;
        a.cup = m.cup ? 1 : 0;
        // 자리는 seat 메시지로만 얻음. 일어나면 -1
        if (m.seat < 0 && a.seat >= 0) { a.seat = -1; this.save(ws, { ...a, dirty: true }); this.broadcast({ t: 'seats', seats: this.seats() }); }
        a.dirty = true;
        this.save(ws, a);
        this.scheduleFlush();
        return;
      }
      case 'seat': {
        if (!a.ready) return;
        const i = Number(m.i) | 0;
        if (i < 0 || i >= SEATS) return;
        const taken = this.seats()[i];
        if (taken && taken !== a.id) { this.send(ws, { t: 'seatNo', i }); return; }
        a.seat = i;
        this.save(ws, a);
        this.broadcast({ t: 'seats', seats: this.seats() });
        return;
      }
      case 'e': {
        if (!a.ready) return;
        const k = m.k;
        if (!['bow', 'clap', 'cheers', 'done', 'ask', 'yes', 'no', 'apart', 'drink'].includes(k)) return;
        const out: ServerMsg = { t: 'e', k, from: a.id, to: m.to };
        if (m.to) { for (const [w, p] of this.ready()) if (p.id === m.to) this.send(w, out); }
        else this.broadcast(out, ws);
        return;
      }
      case 'note': {
        if (!a.ready || typeof m.text !== 'string') return;
        const r = await this.env.BUILDING.get(this.env.BUILDING.idFromName('b' + this.b)).fetch(`https://b/note?b=${this.b}`, { method: 'POST', body: JSON.stringify({ uid: a.id, text: m.text.slice(0, 60) }) });
        const j = (await r.json()) as { ok: boolean; msg?: string; crisis?: boolean };
        if (!j.ok) this.send(ws, { t: 'noteNo', msg: j.msg ?? '올릴 수 없어요', crisis: j.crisis });
        return;
      }
      case 'report': {
        if (!a.ready || typeof m.id !== 'string') return;
        await this.env.BUILDING.get(this.env.BUILDING.idFromName('b' + this.b)).fetch(`https://b/report?b=${this.b}`, { method: 'POST', body: JSON.stringify({ uid: a.id, id: m.id.slice(0, 40) }) });
        return;
      }
      case 'ping': this.send(ws, { t: 'pong' }); this.reportCount(true); return;
    }
  }

  /** 위치는 묶어서 최대 200ms마다 */
  private scheduleFlush(): void {
    if (this.flushT) return;
    this.flushT = setTimeout(() => {
      this.flushT = null;
      const rows: SnapRow[] = [];
      for (const [w, a] of this.ready()) if (a.dirty) { rows.push([a.id, a.x, a.z, a.y, a.st, a.seat, a.cup]); a.dirty = false; this.save(w, a); }
      if (rows.length) this.broadcast({ t: 'snap', p: rows });
    }, SNAP_MS);
  }

  private gone(ws: WebSocket): void {
    const a = this.att(ws);
    try { ws.close(1000, 'bye'); } catch { /* */ }
    if (!a?.ready) return;
    // 이 소켓을 빼고 다시 계산
    a.ready = false; a.seat = -1; this.save(ws, a);
    this.broadcast({ t: 'leave', id: a.id }, ws);
    this.broadcast({ t: 'seats', seats: this.seats() }, ws);
    if (this.countT) clearTimeout(this.countT);
    this.countT = setTimeout(() => this.reportCount(), 50);
  }
  async webSocketClose(ws: WebSocket): Promise<void> { this.gone(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { this.gone(ws); }
}
