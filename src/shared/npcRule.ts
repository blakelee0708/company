// NPC 교체 규칙(5장): 목표 = max(0, 10 − 실제 사람 수). 30초에 한 명씩만 빠지고, 15초에 한 명씩만 들어온다.
import { npcTarget, NPC_LEAVE_SEC, NPC_ENTER_SEC } from './consts';
export interface SwapState { wait: number }
export type SwapAct = 'leave' | 'enter' | null;
/** dt초 지난 뒤 할 일. wait는 다음 교체까지 남은 초 */
export function npcSwapStep(st: SwapState, live: number, humans: number, emptySeats: number, dt: number, speed = 1): SwapAct {
  st.wait -= dt;
  if (st.wait > 0) return null;
  const want = npcTarget(humans);
  if (live > want) { st.wait = NPC_LEAVE_SEC / speed; return 'leave'; }
  if (live < want && emptySeats > 0) { st.wait = NPC_ENTER_SEC / speed; return 'enter'; }
  st.wait = 0;
  return null;
}
