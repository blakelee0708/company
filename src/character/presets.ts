// 시안(scenes4.js)에 쓰인 캐릭터 조합
import { TIES } from './parts';
import type { Look } from './worker';

export const ME: Look = { suit: 'navy', tie: TIES[0] };
export const BOSS: Look = { suit: 'gray', tie: TIES[1], glasses: true, bald: true, hairC: 0x8d8a88 };
export const MGR_F: Look = { sex: 'f', suit: 'black', glasses: true };
export const MGR_M: Look = { sex: 'm', suit: 'black', tie: TIES[1], glasses: true };
export const NPC: Look[] = [
  { suit: 'charcoal', tie: TIES[1] }, { sex: 'f', suit: 'navy' }, { suit: 'gray', tie: TIES[2] }, { sex: 'f', suit: 'pink' },
  { suit: 'black', tie: TIES[3] }, { sex: 'f', suit: 'charcoal' }, { suit: 'navy', tie: TIES[0], glasses: true }, { sex: 'f', suit: 'beige' },
];
/** 장면에서 캐릭터를 키우는 배율 */
export const SC = 1.22;
