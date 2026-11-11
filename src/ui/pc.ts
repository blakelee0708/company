// PC 창(시안 04): 모니터 모양 그룹웨어. 오늘의 할 일 4칸 / 결재함 / 사내 게시판 / 퇴근 기록(오늘).
// 할 일 내용은 이 기기 메모리에만 있다(서버로 보내지 않음).
import { h, $ui, toast } from './dom';
import type { Session, Todo } from '../core/session';
import { checkLine } from '../shared/lineFilter';
import { LINE_MAX } from '../shared/consts';
import { payFor, workedMinutes, fmtDuration, won } from '../shared/pay';
import './pc.css';

export type PcTab = 'todo' | 'appr' | 'board' | 'rec';
export interface PcHandlers {
  onSubmit(i: number): void;
  onDone(i: number): void;
  onClose(): void;
  board(): HTMLElement;
  bossNames(): { boss: string; mgr: string };
  lowPower?(on: boolean): void;
}
const STATE_LABEL: Record<string, [string, string]> = { written: ['작성', '#5a6274'], pending: ['결재 대기', '#c07a2a'] };

export class PcWindow {
  el: HTMLElement | null = null;
  tab: PcTab = 'todo';
  private body!: HTMLElement;
  private clock!: HTMLElement;
  private menu!: HTMLElement;
  private noteEl: HTMLElement | null = null;
  private tick = 0;
  constructor(private s: Session, private hd: PcHandlers) {}
  get isOpen(): boolean { return !!this.el; }

  open(tab: PcTab = this.tab): void {
    this.tab = tab;
    if (this.el) { this.render(); return; }
    this.clock = h('span', { class: 'pc-clock' });
    this.menu = h('div', { class: 'pc-menu' });
    this.body = h('div', { class: 'pc-body' });
    this.el = h('div', { class: 'pc-win' },
      h('div', { class: 'pc-screen' },
        h('div', { class: 'pc-top' }, h('b', {}, '∞'), h('span', { class: 'pc-app' }, '무한채용 그룹웨어'), this.clock),
        h('div', { class: 'pc-main' }, this.menu, this.body)),
      h('div', { class: 'pc-stand' }, h('div')));
    $ui().append(this.el);
    this.hd.lowPower?.(true);
    this.updClock();
    this.tick = window.setInterval(() => this.updClock(), 1000);
    this.render();
  }
  close(): void {
    if (!this.el) return;
    clearInterval(this.tick);
    const e = this.el; this.el = null; this.noteEl = null;
    this.hd.lowPower?.(false);
    e.classList.add('out');
    setTimeout(() => e.remove(), 220);
  }
  private updClock(): void {
    const d = new Date();
    this.clock.textContent = `${this.s.name.split('#')[0]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  /** PC 창 오른쪽 아래 알림 */
  notify(text: string, ms = 3500): void {
    if (!this.el) return;
    this.noteEl?.remove();
    const n = h('div', { class: 'pc-note' }, text);
    this.el.querySelector('.pc-screen')!.append(n);
    this.noteEl = n;
    setTimeout(() => n.remove(), ms);
  }
  refresh(): void { if (this.el) this.render(); }

  private render(): void {
    const pend = this.s.todos.filter((t) => t.state === 'pending').length;
    const items: Array<[PcTab, string, number]> = [['todo', '오늘의 할 일', 0], ['appr', '결재함', pend], ['board', '사내 게시판', 0], ['rec', '퇴근 기록', 0]];
    this.menu.replaceChildren(...items.map(([k, l, n]) => h('button', { class: 'pc-mi' + (k === this.tab ? ' on' : ''), onclick: () => { this.tab = k; this.render(); } }, l, n ? h('span', { class: 'pc-badge' }, String(n)) : null)));
    if (this.tab === 'todo') this.body.replaceChildren(this.todoView());
    else if (this.tab === 'appr') this.body.replaceChildren(this.apprView());
    else if (this.tab === 'board') this.body.replaceChildren(h('div', { class: 'pc-h' }, '사내 게시판'), h('div', { class: 'pc-sub' }, '건물 전체 · 최근 40개'), this.hd.board());
    else this.body.replaceChildren(this.recView());
  }

  private todoView(): HTMLElement {
    const box = h('div', {}, h('div', { class: 'pc-h' }, '오늘의 할 일'), h('div', { class: 'pc-sub' }, '오늘 실제로 해야 할 일을 적어 보세요. 4개까지 적을 수 있어요.'));
    this.s.todos.forEach((t, i) => box.append(this.todoRow(t, i)));
    box.append(h('div', { class: 'pc-foot' }, '적은 내용은 이 기기에만 있고, 다른 사람에게 보이지 않아요.'));
    return box;
  }
  private todoRow(t: Todo, i: number): HTMLElement {
    const locked = t.state === 'pending' || t.state === 'approved' || t.done;
    const inp = h('input', { class: 'pc-in' + (t.done ? ' done' : ''), maxlength: String(LINE_MAX), placeholder: t.hint, value: t.text, disabled: locked, 'aria-label': `할 일 ${i + 1}` }) as HTMLInputElement;
    inp.addEventListener('input', () => {
      if ([...inp.value].length > LINE_MAX) inp.value = [...inp.value].slice(0, LINE_MAX).join('');
      const had = !!t.text.trim();
      t.text = inp.value;
      const has = !!t.text.trim();
      if (has !== had) { t.state = has ? 'written' : 'empty'; this.render(); const again = this.body.querySelectorAll('input')[i] as HTMLInputElement | undefined; again?.focus(); if (again) again.setSelectionRange(again.value.length, again.value.length); }
    });
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
    let mark: HTMLElement | null = null;
    if (t.done) mark = h('span', { class: 'pc-check' }, '✓');
    else if (t.state === 'approved') mark = h('span', { class: 'stamp sm' }, '승인');
    else if (STATE_LABEL[t.state]) mark = h('span', { class: 'pc-st', style: `color:${STATE_LABEL[t.state][1]}` }, STATE_LABEL[t.state][0]);
    if (t.done && t.state === 'approved') mark = h('span', { style: 'display:flex;gap:4px;align-items:center' }, h('span', { class: 'stamp sm' }, '승인'), h('span', { class: 'pc-check' }, '✓'));
    const row = h('div', { class: 'pc-todo' }, h('div', { class: 'pc-tr' }, h('span', { class: 'pc-n' }, String(i + 1)), inp, mark));
    if (t.text.trim() && !t.done) {
      const canSubmit = t.state === 'written';
      row.append(h('div', { class: 'pc-btns' },
        h('button', { class: 'pc-b' + (canSubmit ? '' : ' off'), disabled: !canSubmit, onclick: () => this.approvalForm(i) }, t.state === 'written' ? '결재 올리기' : t.state === 'pending' ? '결재 올림' : '승인됨'),
        h('button', { class: 'pc-b on', onclick: () => { t.done = true; this.hd.onDone(i); this.render(); } }, '완료')));
    }
    return row;
  }
  /** 결재 문서 창 */
  private approvalForm(i: number): void {
    const t = this.s.todos[i];
    const { boss, mgr } = this.hd.bossNames();
    const op = h('input', { class: 'pc-in', maxlength: String(LINE_MAX), placeholder: '의견(선택) · 30자까지' }) as HTMLInputElement;
    op.addEventListener('keydown', (e) => e.stopPropagation());
    const err = h('div', { class: 'pc-err' });
    const form = h('div', { class: 'pc-form' },
      h('div', { class: 'pc-h' }, '결재 문서'),
      h('table', { class: 'pc-doc' },
        h('tr', {}, h('th', {}, '제목'), h('td', {}, t.text)),
        h('tr', {}, h('th', {}, '기안자'), h('td', {}, this.s.name)),
        h('tr', {}, h('th', {}, '결재선'), h('td', {}, `과장(${mgr}) → 부장(${boss})`)),
        h('tr', {}, h('th', {}, '의견'), h('td', {}, op))),
      err,
      h('div', { class: 'pc-btns' },
        h('button', { class: 'pc-b', onclick: () => this.render() }, '취소'),
        h('button', { class: 'pc-b on', onclick: () => {
          if (op.value.trim()) {
            const r = checkLine(op.value);
            if (!r.ok) { err.textContent = r.message; return; }
            t.opinion = r.text;
          }
          t.state = 'pending'; t.stamps = 0;
          this.hd.onSubmit(i);
          toast('결재를 올렸어요 · 과장님 → 부장님');
          this.render();
        } }, '상신')));
    this.body.replaceChildren(form);
    op.focus();
  }
  private apprView(): HTMLElement {
    const { boss, mgr } = this.hd.bossNames();
    const list = this.s.todos.filter((t) => t.state === 'pending' || t.state === 'approved');
    const box = h('div', {}, h('div', { class: 'pc-h' }, '결재함'), h('div', { class: 'pc-sub' }, '결재선: 과장 → 부장 · 반려는 없어요'));
    if (!list.length) box.append(h('div', { class: 'pc-empty' }, '올린 결재가 아직 없어요. 할 일 옆 [결재 올리기]를 눌러 보세요.'));
    for (const t of list) {
      box.append(h('div', { class: 'pc-todo' },
        h('div', { class: 'pc-tr' }, h('span', { class: 'pc-in ro' }, t.text)),
        t.opinion ? h('div', { class: 'pc-op' }, '의견: ' + t.opinion) : null,
        h('div', { class: 'pc-stamps' },
          h('div', { class: 'pc-sbox' }, h('div', {}, '과장'), t.stamps >= 1 ? h('span', { class: 'stamp sm' }, mgr.slice(0, 1)) : h('span', { class: 'pc-wait' }, '대기')),
          h('div', { class: 'pc-sbox' }, h('div', {}, '부장'), t.stamps >= 2 ? h('span', { class: 'stamp sm' }, boss.slice(0, 1)) : h('span', { class: 'pc-wait' }, '대기')),
          t.state === 'approved' ? h('span', { class: 'stamp' }, '승인') : null)));
    }
    return box;
  }
  private recView(): HTMLElement {
    const s = this.s, m = workedMinutes(s.workedMs());
    const st = new Date(s.startAt);
    const row = (k: string, v: string): HTMLElement => h('div', { class: 'pc-rec' }, h('span', {}, k), h('b', {}, v));
    return h('div', {}, h('div', { class: 'pc-h' }, '퇴근 기록(오늘)'), h('div', { class: 'pc-sub' }, '오늘 출근부터 지금까지'),
      row('출근', `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}`),
      row('근무 시간', fmtDuration(m)),
      row('지금까지 급여', won(payFor(m)) + '원'),
      row('할 일', `${s.written.length}개 적음 · ${s.todos.filter((t) => t.done).length}개 완료`),
      row('마신 커피', s.coffee + '잔'),
      row('받은 칭찬', s.praise + '번'),
      h('div', { class: 'pc-foot' }, '시급 10,700원 기준 · 30분 단위'));
  }
}
