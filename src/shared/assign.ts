// 배정 규칙(5장): 실제 사람이 1명 이상 있고 자리가 남은 부서 중 무작위. 없으면 5개 중 무작위. 모두 20명이면 가득 참(null).
import { DEPT_CAP } from './consts';
export function chooseDept(counts: number[], rnd: () => number = Math.random): number | null {
  const open = counts.map((n, i) => [n, i] as const).filter(([n]) => n < DEPT_CAP);
  if (!open.length) return null;
  const withPeople = open.filter(([n]) => n > 0);
  const pool = withPeople.length ? withPeople : open;
  return pool[Math.floor(rnd() * pool.length)][1];
}
