// NPC 사원 겉모습: 4장 표의 조합을 무작위로(일부는 안경)
import type { Look } from '../character/worker';
import { TIES } from '../character/parts';
import { SUIT_KEYS } from '../shared/consts';
import { pick } from '../shared/rand';
export function randomLook(r: () => number = Math.random): Look {
  const sex = r() < 0.5 ? 'm' : 'f';
  return { sex, suit: pick(SUIT_KEYS, r), tie: pick(TIES, r), glasses: r() < 0.22 };
}
