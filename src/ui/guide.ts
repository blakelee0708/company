// 조작법 카드
import { h, $ui, isPC } from './dom';
export function openGuide(): void {
  const pc = isPC();
  const rows: Array<[string, string]> = pc
    ? [['걷기', '바닥 클릭 · 방향키/WASD'], ['돌려 보기', '마우스 끌기 · 휠로 확대'], ['사람에게', '사람을 클릭하면 버튼이 떠요'], ['카드 찍기', 'Space'], ['앉기·일어나기', 'E'], ['PC 창 닫기', 'Esc']]
    : [['걷기', '바닥을 톡 누르기'], ['돌려 보기', '한 손가락으로 끌기'], ['확대', '두 손가락 벌리기·오므리기'], ['사람에게', '사람을 누르면 버튼이 떠요'], ['앉기', '빈자리(하늘색 동그라미) 가까이']];
  const v = h('div', { class: 'veil' });
  v.append(h('div', { class: 'card guide' },
    h('div', { class: 'g-t' }, '조작법'),
    ...rows.map(([k, d]) => h('div', { class: 'g-r' }, h('b', {}, k), h('span', {}, d))),
    h('div', { class: 'g-n' }, '오늘 할 일은 이 기기에만 있고, 아무것도 저장하지 않아요. 새로고침하면 처음부터 시작해요.'),
    h('div', { class: 'g-s' }, '사무실에는 자동으로 일하는 동료도 함께 있어요'),
    h('button', { class: 'btn on', style: 'width:100%;margin-top:12px', onclick: () => v.remove() }, '알겠어요')));
  v.addEventListener('click', (e) => { if (e.target === v) v.remove(); });
  $ui().append(v);
}
