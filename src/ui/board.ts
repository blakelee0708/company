// 사내 게시판(시안 07): 코르크판에 포스트잇. 한 줄 남기기(30자, 걸러내기), 길게 눌러 신고.
import { h, $ui, toast } from './dom';
import { checkLine, MSG } from '../shared/lineFilter';
import { LINE_MAX, BOARD_PER_PERSON } from '../shared/consts';
import { BOARD_HINTS } from '../npc/lines';
import { pick } from '../shared/rand';
import './board.css';

export interface Note { id: string; text: string; mine?: boolean }
export interface BoardSource {
  notes(): Note[];
  post(text: string): void;
  report(id: string): void;
  canPost(): boolean;
  onChange(f: () => void): () => void;
}
const COL = ['#fff59a', '#ffd1dc', '#c9f2d4', '#cfe6ff', '#ffe2b8'];

/** 메모들을 코르크판 안에 그림 */
export function renderNotes(box: HTMLElement, src: BoardSource, compact = false): void {
  const list = src.notes().slice(-40).reverse();
  box.replaceChildren(...list.map((n, i) => {
    const hsh = [...n.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const r = (hsh % 9) - 4;
    const el = h('div', { class: 'note' + (compact ? ' sm' : ''), style: `background:${COL[hsh % 5]};transform:rotate(${r}deg)` }, h('i'), n.text);
    let t = 0;
    const start = (): void => { t = window.setTimeout(() => reportMenu(el, n, src), 600); };
    const stop = (): void => clearTimeout(t);
    el.addEventListener('pointerdown', start); el.addEventListener('pointerup', stop); el.addEventListener('pointerleave', stop); el.addEventListener('pointercancel', stop);
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); reportMenu(el, n, src); });
    void i;
    return el;
  }));
}
function reportMenu(el: HTMLElement, n: Note, src: BoardSource): void {
  if (n.mine) { toast('내가 쓴 메모예요'); return; }
  el.querySelector('.rep')?.remove();
  const b = h('button', { class: 'rep', onclick: (e: Event) => { e.stopPropagation(); src.report(n.id); b.remove(); toast('신고했어요. 3번 모이면 가려져요'); } }, '신고');
  el.append(b);
  setTimeout(() => b.remove(), 3000);
}

export function openBoard(src: BoardSource, onClose: () => void): () => void {
  const cork = h('div', { class: 'cork' });
  const draw = (): void => renderNotes(cork, src);
  draw();
  const off = src.onChange(draw);
  const close = (): void => { off(); el.remove(); onClose(); };
  const el = h('div', { class: 'board-wrap' },
    h('div', { class: 'board-title' }, '사내 게시판 ', h('span', {}, '건물 전체 · 최근 40개'), h('button', { class: 'x-close', onclick: close }, '✕')),
    cork,
    h('div', { class: 'dock' }, h('button', { class: 'btn on', onclick: () => writeLine(src) }, '✏️ 한 줄 남기기')));
  $ui().append(el);
  return close;
}

export function writeLine(src: BoardSource): void {
  if (!src.canPost()) { toast(`출근 한 번에 ${BOARD_PER_PERSON}개까지 올릴 수 있어요`); return; }
  const inp = h('input', { class: 'bw-in', maxlength: String(LINE_MAX), placeholder: pick(BOARD_HINTS) }) as HTMLInputElement;
  const err = h('div', { class: 'bw-err' });
  const cnt = h('span', { class: 'bw-cnt' }, `0/${LINE_MAX}`);
  inp.addEventListener('input', () => { cnt.textContent = `${[...inp.value].length}/${LINE_MAX}`; err.textContent = ''; });
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); });
  const v = h('div', { class: 'veil' });
  const send = (): void => {
    const r = checkLine(inp.value);
    if (!r.ok) {
      if (r.reason === 'crisis') { v.remove(); crisisHelp(); return; }
      err.textContent = r.message; return;
    }
    src.post(r.text); v.remove(); toast('게시판에 붙였어요');
  };
  v.append(h('div', { class: 'card bw' },
    h('div', { class: 'bw-t' }, '하고 싶은 말을 한 줄 남겨 보세요'),
    h('div', { class: 'bw-row' }, inp, cnt), err,
    h('div', { class: 'bw-s' }, '욕설·비방·광고·연락처는 올릴 수 없어요'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => v.remove() }, '취소'), h('button', { class: 'btn on', onclick: send }, '붙이기'))));
  $ui().append(v);
  setTimeout(() => inp.focus(), 50);
}
/** 위기 단어: 쓴 사람 화면에만 도움 안내 */
export function crisisHelp(): void {
  const v = h('div', { class: 'veil' });
  v.append(h('div', { class: 'card confirm' },
    h('div', { class: 'q' }, '많이 힘드시죠.', h('br'), '혼자 견디지 않아도 돼요.'),
    h('div', { style: 'font:600 14px/1.7 P;color:#3a4152;margin-bottom:14px' }, '자살예방상담전화 ', h('b', {}, '109'), h('br'), '정신건강위기상담 ', h('b', {}, '1577-0199'), h('br'), h('span', { style: 'font-size:12px;color:#7a8090' }, '24시간 · 무료 · 비밀 보장')),
    h('button', { class: 'btn on', style: 'width:100%', onclick: () => v.remove() }, '알겠어요')));
  $ui().append(v);
  void MSG;
}

/** 혼자 출근(서버 없음)일 때: 기기 안에서만 */
export class LocalBoard implements BoardSource {
  private list: Note[];
  private subs = new Set<() => void>();
  private mine = 0;
  constructor(seed: string[]) { this.list = seed.map((t, i) => ({ id: 'seed' + i, text: t })); }
  notes(): Note[] { return this.list; }
  post(text: string): void { this.mine++; this.list.push({ id: 'me' + Date.now(), text, mine: true }); this.emit(); }
  report(): void { /* 혼자일 때는 셀 사람이 없음 */ }
  canPost(): boolean { return this.mine < BOARD_PER_PERSON; }
  onChange(f: () => void): () => void { this.subs.add(f); return () => this.subs.delete(f); }
  emit(): void { for (const f of this.subs) f(); }
}
