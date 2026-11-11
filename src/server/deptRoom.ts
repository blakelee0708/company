import { DurableObject } from 'cloudflare:workers';
export class DeptRoom extends DurableObject {
  async fetch(): Promise<Response> { return new Response('준비 중', { status: 503 }); }
}
