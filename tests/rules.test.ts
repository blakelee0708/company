import { describe, it, expect } from 'vitest';
import { npcTarget, DEPT_CAP } from '../src/shared/consts';
import { npcSwapStep } from '../src/shared/npcRule';
import { chooseDept } from '../src/shared/assign';
import { pickLine, NUDGE, PRAISE, COMFORT, GREET, ALL_LINES, fillLine, QUOTES } from '../src/npc/lines';

describe('배정 규칙', () => {
  it('사람 있는 부서가 우선', () => {
    for (let k = 0; k < 50; k++) expect([1, 3]).toContain(chooseDept([0, 4, 0, 7, 0]));
  });
  it('모두 비었으면 5개 중 무작위', () => {
    const seen = new Set<number>();
    for (let k = 0; k < 200; k++) seen.add(chooseDept([0, 0, 0, 0, 0])!);
    expect(seen.size).toBe(5);
  });
  it('가득 찬 부서는 빼고, 모두 20명이면 가득 참', () => {
    for (let k = 0; k < 50; k++) expect(chooseDept([DEPT_CAP, 3, DEPT_CAP, DEPT_CAP, DEPT_CAP])).toBe(1);
    expect(chooseDept([20, 20, 20, 20, 20])).toBeNull();
  });
  it('사람 있는 부서가 다 차면 빈 부서로', () => { expect(chooseDept([20, 0, 20, 20, 20])).toBe(1); });
});

describe('NPC 사원 수', () => {
  it('max(0, 10 − 실제 사람 수)', () => { expect(npcTarget(0)).toBe(10); expect(npcTarget(1)).toBe(9); expect(npcTarget(10)).toBe(0); expect(npcTarget(15)).toBe(0); });
  it('30초에 한 명씩만 빠짐', () => {
    const st = { wait: 0 };
    let live = 10, left = 0;
    // 사람 6명이 들어옴 → 목표 4. 60초 동안 1초씩
    for (let t = 0; t <= 60; t++) { const a = npcSwapStep(st, live, 6, 10, 1); if (a === 'leave') { live--; left++; } }
    expect(left).toBe(3); // 0초, 30초, 60초
  });
  it('15초에 한 명씩만 들어옴', () => {
    const st = { wait: 0 };
    let live = 0, came = 0;
    for (let t = 0; t <= 30; t++) { const a = npcSwapStep(st, live, 1, 10, 1); if (a === 'enter') { live++; came++; } }
    expect(came).toBe(3); // 0, 15, 30초
  });
});

describe('대사 규칙', () => {
  it('한 번 출근하는 동안 같은 대사는 다시 나오지 않음(30분 앉아 있기)', () => {
    const used = new Set<string>();
    const got: string[] = [];
    // 2~4분마다 한 번 → 30분이면 최대 15번. 칭찬·위로도 섞어서
    for (let k = 0; k < 15; k++) { const l = pickLine(NUDGE, used, { who: k % 2 ? 'boss' : 'mgr', hasTodo: true }) ?? pickLine(NUDGE, used, { hasTodo: true }); if (l) got.push(l.id); }
    for (let k = 0; k < 8; k++) { const l = pickLine(PRAISE, used, { hasTodo: true }); if (l) got.push(l.id); }
    for (let k = 0; k < 4; k++) { const l = pickLine(COMFORT, used, { hasTodo: true }); if (l) got.push(l.id); }
    expect(new Set(got).size).toBe(got.length);
  });
  it('다 쓰면 null(반복하지 않음)', () => {
    const used = new Set<string>();
    for (let k = 0; k < GREET.length; k++) expect(pickLine(GREET, used, { hasTodo: false })).not.toBeNull();
    expect(pickLine(GREET, used, { hasTodo: false })).toBeNull();
  });
  it('할 일이 없으면 {할일} 대사는 안 나옴', () => {
    const used = new Set<string>();
    for (let k = 0; k < 30; k++) { const l = pickLine(NUDGE, used, { hasTodo: false }); if (l) expect(l.text.includes('{할일}')).toBe(false); }
  });
  it('{이름}·{할일} 채우기(10자 넘으면 …)', () => {
    expect(fillLine('{이름}, 안녕', '김사원#4821', null)).toBe('김사원님, 안녕');
    expect(fillLine("'{할일}' 부탁", '김사원#4821', '자기소개서 1번 문항 쓰기')).toBe("'자기소개서 1번 문…' 부탁");
  });
  it('금지된 말이 없음(꾸중·야근·외모·나이·성별)', () => {
    const bad = /(야근|왜 이것밖에|정신 차려|늦었|살 빠|살쪘|예쁘|잘생|나이가|여자가|남자가|혼나|시말서|징계)/;
    for (const l of ALL_LINES) expect(bad.test(l.text), l.text).toBe(false);
    for (const q of QUOTES) expect(bad.test(q), q).toBe(false);
    expect(QUOTES.length).toBe(30);
  });
});
