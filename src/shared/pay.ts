// 급여 계산: 급여 = floor(근무 분 ÷ 30) × 5,350원 (시급 10,700원, 30분 단위)
export const HOURLY_WAGE = 10700;
export const UNIT_MIN = 30;
export const UNIT_PAY = (HOURLY_WAGE * UNIT_MIN) / 60; // 5,350

export function payFor(minutes: number): number {
  const m = Math.max(0, Math.floor(minutes));
  return Math.floor(m / UNIT_MIN) * UNIT_PAY;
}
export function payUnits(minutes: number): number { return Math.floor(Math.max(0, Math.floor(minutes)) / UNIT_MIN); }
/** 밀리초 → 근무 분(버림) */
export function workedMinutes(ms: number): number { return Math.max(0, Math.floor(ms / 60000)); }
/** "2시간 34분" */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}
export function won(n: number): string { return n.toLocaleString('ko-KR'); }
/** 00:12:40 */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (v: number): string => String(v).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
