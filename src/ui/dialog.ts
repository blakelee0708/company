// 대화창(시안 05): 상사 얼굴, 이름·직함, 한 글자씩 나오는 대사, 선택지 버튼 2~3개.
import { h, $ui } from './dom';

export interface DlgChoice { label: string; on: () => void; cls?: string }
export interface DlgOpts { face: string; name: string; rank: string; text: string; choices: DlgChoice[]; timeout?: number; onTimeout?: () => void }
let current: { close: () => void } | null = null;

export function openDialog(o: DlgOpts): { close: () => void; reply: (text: string, after?: () => void, ms?: number) => void } {
  current?.close();
  const say = h('div', { class: 'say' });
  const btnBox = h('div');
  const el = h('div', { class: 'dialog' },
    h('div', { class: 'who' }, h('div', { class: 'face' }, h('img', { src: o.face, alt: '' })), h('div', {}, h('div', { class: 'nm' }, o.name), h('div', { class: 'rk' }, o.rank))),
    say, btnBox);
  $ui().append(el);
  let typer = 0, timer = 0, closed = false;
  const type = (t: string, done?: () => void): void => {
    clearInterval(typer);
    let i = 0;
    const chars = [...t];
    say.textContent = '';
    typer = window.setInterval(() => { i++; say.textContent = chars.slice(0, i).join(''); if (i >= chars.length) { clearInterval(typer); done?.(); } }, 30);
  };
  const close = (): void => { if (closed) return; closed = true; clearInterval(typer); clearTimeout(timer); el.remove(); if (current === api) current = null; };
  const setButtons = (list: DlgChoice[]): void => {
    const btns = list.map((c, i) => h('button', { class: 'btn ' + (c.cls ?? (i === 0 ? 'on' : '')), onclick: (e: Event) => { e.stopPropagation(); clearTimeout(timer); c.on(); } }, c.label));
    const rows: HTMLElement[] = [];
    if (btns.length <= 2) rows.push(h('div', { class: 'row' }, ...btns));
    else { rows.push(h('div', { class: 'row' }, btns[0], btns[1])); rows.push(h('div', { class: 'row' }, ...btns.slice(2))); }
    btnBox.replaceChildren(...rows);
  };
  const api = {
    close,
    /** 상사가 짧게 답하고 ms 뒤 닫힘 */
    reply: (text: string, after?: () => void, ms = 1500): void => {
      btnBox.replaceChildren();
      clearTimeout(timer);
      type(text, () => { timer = window.setTimeout(() => { close(); after?.(); }, ms); });
    },
  };
  current = api;
  type(o.text);
  setButtons(o.choices);
  if (o.timeout) timer = window.setTimeout(() => o.onTimeout?.(), o.timeout * 1000);
  return api;
}
export function dialogOpen(): boolean { return !!current; }
export function closeDialog(): void { current?.close(); }
