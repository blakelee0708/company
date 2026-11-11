import { describe, it, expect } from 'vitest';
import { checkLine, engToKo } from '../src/shared/lineFilter';

const reason = (s: string): string => { const r = checkLine(s); return r.ok ? 'ok' : r.reason; };
describe('한 줄 걸러내기', () => {
  it('PRD 12장 숫자', () => {
    expect(reason('시1발')).toBe('abuse');
    expect(reason('010 1234 5678')).toBe('contact');
    expect(reason('tlqkf')).toBe('abuse');
    expect(reason('오늘 면접 봤어요')).toBe('ok');
  });
  it('영문 자판 → 한글', () => { expect(engToKo('tlqkf')).toBe('시발'); expect(engToKo('dkssudgktpdy')).toBe('안녕하세요'); });
  it('변형 욕설', () => {
    for (const s of ['시 발', '씨-발', '씨1빨', 'ㅅㅂ', 'ㅂㅅ같네', '병1신', 'qudtls', 'f u c k', '개 새 끼']) expect(reason(s), s).toBe('abuse');
  });
  it('연락처·링크', () => {
    for (const s of ['01012345678', '카톡 주세요', 'www.abc.com', 'insta @myid_12', '공일공 일이삼사', 'open.kakao.com/x']) expect(reason(s), s).toBe('contact');
  });
  it('광고', () => { expect(reason('부업 하실 분')).toBe('abuse'); expect(reason('토토 사이트')).toBe('abuse'); });
  it('위기 단어', () => { expect(reason('죽고 싶다')).toBe('crisis'); expect(reason('자살')).toBe('crisis'); });
  it('괜찮은 말은 통과', () => {
    for (const s of ['3번째 출근, 이제 좀 익숙해요', '커피 맛집은 4층 탕비실', '다음 주에 첫 출근합니다!', '취준 8개월 차, 그래도 출근', '시발점부터 다시', '새끼손가락 걸고 약속', '2026년 화이팅', '조정 회의 끝', 'hello world', '오늘 면접 보고 왔어요. 다들 힘내요']) expect(reason(s), s).toBe('ok');
  });
  it('길이', () => { expect(reason('가'.repeat(31))).toBe('long'); expect(reason('   ')).toBe('empty'); });
});
