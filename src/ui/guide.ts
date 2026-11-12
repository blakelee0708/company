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

/** 부서에 들어오면 한 번: 투명 레이어로 조작법과 할 일 안내 → [알겠어요] */
export function openOfficeGuide(): Promise<void> {
  return new Promise((res) => {
    const pc = isPC();
    const items: Array<[string, string, string]> = [
      ['📝', '내 자리에 앉아 진짜 할 일 적기', '하늘색 동그라미(빈자리)에 앉으면 PC가 켜져요. 오늘 실제로 해야 할 일(예: 자소서 1번 쓰기)을 적어 두고, 하나씩 해 보세요.'],
      ['🚶', '걷기', pc ? '바닥을 클릭하거나 방향키·WASD' : '바닥을 톡 누르면 그쪽으로 걸어가요'],
      ['☕', '탕비실', '오른쪽 벽 "탕비실 →" 문으로 가면 커피·간식을 먹을 수 있어요'],
      ['👋', '동료에게 말 걸기', '사람을 누르면 [인사하기] [박수] [탕비실 같이 가요]가 떠요'],
      ['🙂', '부장·과장님', '가끔 자리로 찾아와 말을 걸어요. 결재도 해 줘요'],
    ];
    const ok = h('button', { class: 'btn on og-ok' }, '알겠어요');
    const v = h('div', { class: 'og-veil' },
      h('div', { class: 'og-box' },
        h('div', { class: 'og-t' }, '오늘 이렇게 일해요'),
        ...items.map(([i, t, d]) => h('div', { class: 'og-r' }, h('span', { class: 'og-i' }, i), h('div', {}, h('b', {}, t), h('span', {}, d)))),
        h('div', { class: 'og-s' }, '퇴근할 때는 오른쪽 위 [퇴근하기] · 오늘 일한 만큼 급여가 나와요'),
        ok));
    ok.addEventListener('click', (e) => { e.stopPropagation(); v.remove(); res(); });
    $ui().append(v);
  });
}
