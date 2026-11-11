// (주)무한채용 Worker: 정적 파일은 ASSETS가, /ws/* 와 /api/* 는 여기서 처리한다.
// 아무것도 저장하지 않는다(로그 저장 끔: wrangler.jsonc observability off, console 출력 없음).
import { DeptRoom } from './deptRoom';
import { BuildingRoom } from './buildingRoom';
import { MAX_BUILDINGS, DEPT_COUNT } from '../shared/consts';
export { DeptRoom, BuildingRoom };

export interface Env {
  ASSETS: Fetcher;
  DEPT: DurableObjectNamespace;
  BUILDING: DurableObjectNamespace;
}
const json = (o: unknown, status = 200): Response => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true });
    if (url.pathname === '/api/assign') {
      // 건물마다 물어보고, 자리가 있는 첫 건물에서 부서를 고름
      for (let b = 0; b < MAX_BUILDINGS; b++) {
        const stub = env.BUILDING.get(env.BUILDING.idFromName('b' + b));
        const r = await stub.fetch(`https://b/assign?b=${b}`);
        const j = (await r.json()) as { dept: number; full?: boolean };
        if (!j.full) return json({ building: b, dept: j.dept });
      }
      return json({ full: true });
    }
    if (url.pathname === '/ws/dept') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const b = Math.max(0, Math.min(MAX_BUILDINGS - 1, Number(url.searchParams.get('b')) | 0));
      const d = Math.max(0, Math.min(DEPT_COUNT - 1, Number(url.searchParams.get('d')) | 0));
      const stub = env.DEPT.get(env.DEPT.idFromName(`b${b}-${d}`));
      const u = new URL(req.url); u.searchParams.set('b', String(b)); u.searchParams.set('d', String(d));
      return stub.fetch(new Request(u.toString(), req));
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
