// 이번 출근 한 번의 상태. 기기 메모리에만 있고 어디에도 저장하지 않는다.
import type { SuitKey } from '../shared/consts';
import { TIES } from '../character/parts';
import { randomName } from '../shared/names';
import { pick } from '../shared/rand';
import { SUIT_KEYS } from '../shared/consts';

export type TodoState = 'empty' | 'written' | 'pending' | 'approved';
export interface Todo { text: string; state: TodoState; done: boolean; stamps: number; opinion: string; hint: string }

const HINTS = ['예) 자기소개서 1번 문항 쓰기', '예) 이력서 한 군데 넣기', '예) 30분 산책하기', '예) 미뤄 둔 메일 답장하기', '예) 방 청소하기', '예) 영어 단어 20개'];

export class Session {
  name = randomName();
  sex: 'm' | 'f' = 'm';
  suit: SuitKey = pick(SUIT_KEYS.slice(0, 5));
  tie: number = pick(TIES);
  dept = 0;
  building = 0;
  /** 카드 찍은 시각(ms). 근무 시간의 시작 */
  startAt = 0;
  endAt = 0;
  todos: Todo[] = [];
  coffee = 0;
  praise = 0;
  cheers = 0;
  /** 같이 일한 사람(실제 사람 id) */
  coworkers = new Set<string>();
  npcSeen = 0;
  boardPosts = 0;
  usedLines = new Set<string>();
  constructor() {
    const hs = [...HINTS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 4; i++) this.todos.push({ text: '', state: 'empty', done: false, stamps: 0, opinion: '', hint: hs[i] });
  }
  get written(): Todo[] { return this.todos.filter((t) => t.text.trim()); }
  workedMs(now = Date.now()): number { return this.startAt ? (this.endAt || now) - this.startAt : 0; }
}
