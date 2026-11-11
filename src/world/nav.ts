// 걷기 길 찾기: 0.5m 칸 격자 위 A*(책상·칸막이를 피해서). 결과는 직선으로 이어지는 꼭짓점만 남긴다.
export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Pt { x: number; z: number }

export class NavGrid {
  readonly cell: number;
  readonly nx: number;
  readonly nz: number;
  readonly blocked: Uint8Array;
  constructor(public readonly x0: number, public readonly z0: number, public readonly x1: number, public readonly z1: number, cell = 0.5) {
    this.cell = cell;
    this.nx = Math.ceil((x1 - x0) / cell);
    this.nz = Math.ceil((z1 - z0) / cell);
    this.blocked = new Uint8Array(this.nx * this.nz);
  }
  idx(ix: number, iz: number): number { return iz * this.nx + ix; }
  toCell(x: number, z: number): [number, number] { return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)]; }
  center(ix: number, iz: number): Pt { return { x: this.x0 + (ix + 0.5) * this.cell, z: this.z0 + (iz + 0.5) * this.cell }; }
  inside(ix: number, iz: number): boolean { return ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz; }
  /** 사각형(월드 좌표)을 막음. pad만큼 넓혀서 */
  block(r: Rect, pad = 0, v = 1): void {
    const xa = Math.min(r.x0, r.x1) - pad, xb = Math.max(r.x0, r.x1) + pad, za = Math.min(r.z0, r.z1) - pad, zb = Math.max(r.z0, r.z1) + pad;
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const c = this.center(ix, iz);
      if (c.x >= xa && c.x <= xb && c.z >= za && c.z <= zb) this.blocked[this.idx(ix, iz)] = v;
    }
  }
  /** 사각형 안을 다시 열어 둠(자리·문) */
  open(r: Rect): void { this.block(r, 0, 0); }
  free(x: number, z: number): boolean {
    const [ix, iz] = this.toCell(x, z);
    return this.inside(ix, iz) && !this.blocked[this.idx(ix, iz)];
  }
  /** 가장 가까운 빈 칸 */
  nearestFree(x: number, z: number): Pt | null {
    const [cx, cz] = this.toCell(x, z);
    for (let r = 0; r < 12; r++) {
      let best: Pt | null = null, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ix = cx + dx, iz = cz + dz;
        if (!this.inside(ix, iz) || this.blocked[this.idx(ix, iz)]) continue;
        const c = this.center(ix, iz), d = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return best;
    }
    return null;
  }
  /** 두 점 사이가 막힘 없이 이어지는지(칸 단위로 따라가며 검사) */
  line(a: Pt, b: Pt): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / (this.cell * 0.35));
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!this.free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
    return true;
  }
  /** A*: from → to. 끝점이 막혀 있으면 가장 가까운 빈 칸으로. 길이 없으면 null */
  path(from: Pt, to: Pt): Pt[] | null {
    const s0 = this.free(from.x, from.z) ? from : this.nearestFree(from.x, from.z);
    const t0 = this.free(to.x, to.z) ? to : this.nearestFree(to.x, to.z);
    if (!s0 || !t0) return null;
    if (this.line(s0, t0)) return [t0];
    const [sx, sz] = this.toCell(s0.x, s0.z), [tx, tz] = this.toCell(t0.x, t0.z);
    const N = this.nx * this.nz, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap: Array<[number, number]> = [];
    const push = (f: number, i: number): void => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = (): [number, number] => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const H = (ix: number, iz: number): number => { const dx = Math.abs(ix - tx), dz = Math.abs(iz - tz); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    const si = this.idx(sx, sz), ti = this.idx(tx, tz);
    g[si] = 0; push(H(sx, sz), si);
    let found = false;
    while (heap.length) {
      const [, i] = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      if (i === ti) { found = true; break; }
      const ix = i % this.nx, iz = (i / this.nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const jx = ix + dx, jz = iz + dz;
        if (!this.inside(jx, jz)) continue;
        const j = this.idx(jx, jz);
        if (this.blocked[j] || closed[j]) continue;
        if (dx && dz && (this.blocked[this.idx(ix + dx, iz)] || this.blocked[this.idx(ix, iz + dz)])) continue; // 모서리 깎기 금지
        const ng = g[i] + (dx && dz ? Math.SQRT2 : 1);
        if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + H(jx, jz), j); }
      }
    }
    if (!found) return null;
    const cells: Pt[] = [];
    for (let i = ti; i !== -1 && i !== si; i = came[i]) cells.push(this.center(i % this.nx, (i / this.nx) | 0));
    cells.reverse();
    cells[cells.length - 1] = t0;
    // 줄이기: 보이는 곳까지 건너뜀
    const out: Pt[] = [];
    let cur: Pt = s0, k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) if (this.line(cur, cells[m])) { far = m; break; }
      out.push(cells[far]); cur = cells[far]; k = far + 1;
    }
    return out;
  }
}
