// 퇴근 카드 = 오늘의 급여 명세서(시안 08)
import { h, $ui, esc } from './dom';
import type { Session } from '../core/session';
import { payFor, payUnits, workedMinutes, fmtDuration, won, UNIT_PAY } from '../shared/pay';
import { DEPTS } from '../shared/consts';
import { QUOTES } from '../npc/lines';
import { pick } from '../shared/rand';
import './payslip.css';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const hm = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export interface SlipData { date: string; who: string; hours: string; pay: number; units: number; minutes: number; todos: Array<{ text: string; mark: string }>; coffee: number; people: number; praise: number; cheers: number; quote: string }

export function slipData(s: Session, people: number): SlipData {
  const end = new Date(s.endAt || Date.now()), st = new Date(s.startAt || Date.now());
  const m = workedMinutes(s.workedMs());
  return {
    date: `${end.getFullYear()}. ${end.getMonth() + 1}. ${end.getDate()} (${DAYS[end.getDay()]})`,
    who: `${DEPTS[s.dept].name} ${s.name}`,
    hours: `${hm(st)} ~ ${hm(end)} · ${fmtDuration(m)}`,
    pay: payFor(m), units: payUnits(m), minutes: m,
    todos: s.written.map((t) => ({ text: t.text.trim(), mark: [t.state === 'approved' ? '승인' : '', t.done ? '완료' : ''].filter(Boolean).join(' · ') })),
    coffee: s.coffee, people, praise: s.praise, cheers: s.cheers,
    quote: pick(QUOTES),
  };
}

export function showPayslip(d: SlipData, on: { save: () => void; again: () => void }): HTMLElement {
  const todos = d.todos.length
    ? d.todos.map((t) => `<div class="ps-row"><span>✔ ${esc(t.text)}</span><span class="ps-mk">${esc(t.mark)}</span></div>`).join('')
    : '<div class="ps-row" style="color:#9aa0ad">적은 할 일이 없어요. 출근한 것만으로 충분해요</div>';
  const card = h('div', { class: 'ps-card', html: `
    <div class="ps-head"><b>∞</b><span>(주)무한채용 · 오늘의 급여 명세서</span></div>
    <div class="ps-date">${esc(d.date)}</div><div class="ps-who">${esc(d.who)}</div>
    <div class="ps-seal">오늘도<br>출근<br>완료</div>
    <div class="ps-dash" style="margin:22px 0 10px"></div>
    <div class="ps-line"><span>근무 시간</span><span>${esc(d.hours)}</span></div>
    <div class="ps-cap">오늘 번 돈</div>
    <div class="ps-pay">${won(d.pay)}<span> 원</span></div>
    <div class="ps-note">시급 10,700원 기준 · 30분 단위 (${d.units} × ${won(UNIT_PAY)}원)</div>
    ${d.minutes < 30 ? '<div class="ps-hint">30분을 채우면 5,350원이 쌓여요. 다음엔 조금만 더 있다 가요</div>' : ''}
    <div class="ps-dash" style="margin:14px 0 10px"></div>
    <div class="ps-t">오늘 한 일</div>
    <div class="ps-todos">${todos}</div>
    <div class="ps-stats">
      <div>마신 커피<b>${d.coffee}잔</b></div><div>같이 일한 사람<b>${d.people}명</b></div><div>받은 칭찬<b>${d.praise}번</b></div>
    </div>
    ${d.cheers ? `<div class="ps-cheer">받은 응원(인사·박수·건배) ${d.cheers}번</div>` : ''}
    <div class="ps-quote"><div>오늘의 한마디</div><p>${esc(d.quote)}</p></div>` });
  const el = h('div', { class: 'ps-wrap' }, h('div', { class: 'ps-scroll' }, card),
    h('div', { class: 'dock ps-dock' }, h('button', { class: 'btn', onclick: on.save }, '결과 이미지 저장'), h('button', { class: 'btn on', onclick: on.again }, '다시 출근하기')));
  $ui().append(el);
  return el;
}
