import { SURNAMES } from './consts';
import { pick } from './rand';
/** 김사원#4821 */
export function randomName(r: () => number = Math.random): string {
  return pick(SURNAMES, r) + '사원#' + String(Math.floor(r() * 10000)).padStart(4, '0');
}
/** 김사원#4821 → 김사원님 */
export function callName(name: string): string { return name.split('#')[0] + '님'; }
export function shortName(name: string): string { return name.split('#')[0]; }
