// 아주 작은 DOM 도우미
export type Child = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'style') e.style.cssText = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
export const $ui = (): HTMLElement => document.getElementById('ui')!;
export function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }

let toastBox: HTMLElement | null = null;
export function toast(msg: string, ms = 2400): void {
  if (!toastBox || !toastBox.isConnected) { toastBox = h('div', { class: 'toasts' }); $ui().append(toastBox); }
  const t = h('div', { class: 'toast' }, msg);
  toastBox.append(t);
  while (toastBox.children.length > 3) toastBox.firstElementChild!.remove();
  setTimeout(() => t.remove(), ms);
}
/** 예/아니오 확인 창 */
export function confirmBox(q: string, yes: string, no: string): Promise<boolean> {
  return new Promise((res) => {
    const v = h('div', { class: 'veil' });
    const close = (r: boolean): void => { v.remove(); res(r); };
    v.append(h('div', { class: 'card confirm' }, h('div', { class: 'q' }, q), h('div', { class: 'row' }, h('button', { class: 'btn dk', onclick: () => close(true) }, yes), h('button', { class: 'btn', onclick: () => close(false) }, no))));
    $ui().append(v);
  });
}
let fadeEl: HTMLElement | null = null;
/** 화면을 0.3초 어둡게 했다가 fn 실행 뒤 밝힘 */
export async function fadeThrough(fn: () => void | Promise<void>, hold = 0): Promise<void> {
  if (!fadeEl || !fadeEl.isConnected) { fadeEl = h('div', { class: 'fade' }); document.getElementById('app')!.append(fadeEl); }
  fadeEl.classList.add('on');
  await wait(320);
  await fn();
  if (hold) await wait(hold);
  fadeEl.classList.remove('on');
  await wait(300);
}
export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const isPC = (): boolean => window.innerWidth > window.innerHeight && window.innerWidth >= 900;
