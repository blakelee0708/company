// (주)무한채용 Worker: 정적 파일은 ASSETS가, /ws/* 와 /api/* 는 여기서 처리한다.
import { DeptRoom } from './deptRoom';
import { BuildingRoom } from './buildingRoom';
export { DeptRoom, BuildingRoom };

export interface Env {
  ASSETS: Fetcher;
  DEPT: DurableObjectNamespace;
  BUILDING: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
