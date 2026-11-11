import { describe, it, expect } from 'vitest';
import { payFor, HOURLY_WAGE, UNIT_PAY, fmtDuration, fmtClock, workedMinutes } from '../src/shared/pay';

describe('급여 = floor(근무 분 ÷ 30) × 5,350원', () => {
  it('시급과 단위', () => { expect(HOURLY_WAGE).toBe(10700); expect(UNIT_PAY).toBe(5350); });
  it.each([[0, 0], [29, 0], [30, 5350], [59, 5350], [60, 10700], [154, 26750]])('%i분 → %i원', (m, w) => {
    expect(payFor(m)).toBe(w);
  });
  it('음수·소수는 안전하게', () => { expect(payFor(-5)).toBe(0); expect(payFor(29.99)).toBe(0); expect(payFor(30.5)).toBe(5350); });
  it('표시', () => {
    expect(fmtDuration(154)).toBe('2시간 34분');
    expect(fmtDuration(29)).toBe('29분');
    expect(fmtDuration(120)).toBe('2시간');
    expect(fmtClock(760000)).toBe('00:12:40');
    expect(workedMinutes(59 * 60000 + 59999)).toBe(59);
  });
});
