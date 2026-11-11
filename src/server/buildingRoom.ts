// 건물 하나: 부서 5개 인원(배정용)과 사내 게시판(건물 전체, 최근 40개). 메모리에만 있고 저장하지 않는다.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './worker';
import { chooseDept } from '../shared/assign';
import { DEPT_COUNT, BOARD_MAX, BOARD_PER_PERSON, BOARD_HIDE_REPORTS } from '../shared/consts';
import { checkLine } from '../shared/lineFilter';
import { BOARD_SEED } from '../shared/boardSeed';
import type { NotePub } from '../shared/protocol';

interface Note extends NotePub { by: string; reports: Set<string>; hidden: boolean }
export class BuildingRoom extends DurableObject<Env> {
  private counts = new Array(DEPT_COUNT).fill(0) as number[];
  private seen = new Array(DEPT_COUNT).fill(0) as number[];
  private notes: Note[] = [];
  private posts = new Map<string, number>();
  private b = 0;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // NPC가 미리 붙여 둔 메모 8개
    const seed = [...BOARD_SEED].sort(() => Math.random() - 0.5).slice(0, 8);
    this.notes = seed.map((t, i) => ({ id: 'n' + i, text: t, by: 'npc', reports: new Set(), hidden: false }));
  }
  private visible(): NotePub[] { return this.notes.filter((n) => !n.hidden).slice(-BOARD_MAX).map((n) => ({ id: n.id, text: n.text })); }
  private async push(msg: unknown): Promise<void> {
    const body = JSON.stringify(msg);
    await Promise.all(this.counts.map((n, d) => (n > 0 ? this.env.DEPT.get(this.env.DEPT.idFromName(`b${this.b}-${d}`)).fetch('https://d/push', { method: 'POST', body }).catch(() => undefined) : undefined)));
  }
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const q = url.searchParams;
    if (q.has('b')) this.b = Number(q.get('b')) | 0;
    const now = Date.now();
    // 2분 넘게 소식 없는 부서는 0명으로 봄
    for (let d = 0; d < DEPT_COUNT; d++) if (this.counts[d] && now - this.seen[d] > 120000) this.counts[d] = 0;
    if (url.pathname === '/assign') {
      const d = chooseDept(this.counts);
      return Response.json(d === null ? { full: true } : { dept: d });
    }
    if (url.pathname === '/count') {
      const d = Number(q.get('d')) | 0, n = Number(q.get('n')) | 0;
      this.counts[d] = n; this.seen[d] = now;
      return Response.json({ ok: true });
    }
    if (url.pathname === '/board') return Response.json(this.visible());
    if (url.pathname === '/note') {
      const { uid, text } = (await req.json()) as { uid: string; text: string };
      const c = this.posts.get(uid) ?? 0;
      if (c >= BOARD_PER_PERSON) return Response.json({ ok: false, msg: `출근 한 번에 ${BOARD_PER_PERSON}개까지 올릴 수 있어요` });
      const r = checkLine(text);
      if (!r.ok) return Response.json({ ok: false, msg: r.message, crisis: r.reason === 'crisis' });
      this.posts.set(uid, c + 1);
      const n: Note = { id: 'n' + now.toString(36) + Math.random().toString(36).slice(2, 6), text: r.text, by: uid, reports: new Set(), hidden: false };
      this.notes.push(n);
      if (this.notes.length > 200) this.notes.splice(0, this.notes.length - 200);
      await this.push({ t: 'note', n: { id: n.id, text: n.text, by: uid } });
      return Response.json({ ok: true, id: n.id });
    }
    if (url.pathname === '/report') {
      const { uid, id } = (await req.json()) as { uid: string; id: string };
      const n = this.notes.find((x) => x.id === id);
      if (n && n.by !== uid && !n.hidden) {
        n.reports.add(uid);
        if (n.reports.size >= BOARD_HIDE_REPORTS) { n.hidden = true; await this.push({ t: 'hide', id }); }
      }
      return Response.json({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }
}
