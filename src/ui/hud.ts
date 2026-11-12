// 화면 위 정보(왼쪽 위 제목·부제, 오른쪽 위 칩)와 아래 버튼 묶음
import { h, $ui } from './dom';

export interface ChipDef { label: string; white?: boolean; on: () => void; key?: string }
export class Hud {
  readonly el: HTMLElement;
  private b: HTMLElement;
  private s: HTMLElement;
  private chips: HTMLElement;
  readonly dock: HTMLElement;
  private cnt: HTMLElement;
  constructor() {
    this.cnt = h('div', { class: 'hud-count np' });
    this.b = h('b');
    this.s = h('span');
    this.chips = h('div', { class: 'chips' });
    this.el = h('div', { class: 'hud' }, h('div', { class: 'l' }, this.b, this.s), this.chips);
    this.dock = h('div', { class: 'dock' });
    $ui().append(this.el, this.cnt, this.dock);
    this.hide();
  }
  show(): void { this.el.style.display = ''; this.dock.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; this.dock.style.display = 'none'; this.cnt.style.display = 'none'; }
  /** 위에 크게: 지금 함께 있는 사람 수(NPC 포함) */
  count(n: number | null, label = '지금 함께 근무 중'): void {
    if (n === null) { this.cnt.style.display = 'none'; return; }
    this.cnt.style.display = '';
    const t = `👥 ${label} ${n}명`;
    if (this.cnt.textContent !== t) this.cnt.textContent = t;
  }
  title(b: string, s = ''): void { if (this.b.textContent !== b) { this.b.textContent = b; this.b.classList.toggle('long', [...b].length > 11); } if (this.s.textContent !== s) this.s.textContent = s; }
  sub(s: string): void { if (this.s.textContent !== s) this.s.textContent = s; }
  setChips(list: ChipDef[]): void {
    this.chips.replaceChildren(...list.map((c) => h('button', { class: 'chip' + (c.white ? ' w' : ''), onclick: (e: Event) => { e.stopPropagation(); c.on(); } }, c.label)));
  }
  /** 아래 버튼 묶음 바꾸기 */
  setDock(...nodes: Array<Node | null | false>): void { this.dock.replaceChildren(...(nodes.filter(Boolean) as Node[])); }
}
/** 큰 버튼 */
export function bigBtn(label: string, on: () => void, cls = 'on', key?: string): HTMLButtonElement {
  const b = h('button', { class: 'btn ' + cls, onclick: (e: Event) => { e.stopPropagation(); on(); } }, label);
  if (key && document.body.classList.contains('pc-mode')) b.append(h('span', { class: 'key' }, key));
  return b;
}
export function rowBtns(list: Array<[string, () => void, string?]>): HTMLElement {
  return h('div', { class: 'row' }, ...list.map(([l, f, c]) => bigBtn(l, f, c ?? '')));
}
