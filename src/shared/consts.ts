// 정해진 값(PRD). 서버와 화면이 같이 쓴다.
export const DEPTS = [
  { id: 0, name: '신바람기획부', floor: 3, prop: '화이트보드, 포스트잇' },
  { id: 1, name: '두근두근영업부', floor: 4, prop: '실적 그래프 액자' },
  { id: 2, name: '차곡차곡재무부', floor: 5, prop: '계산기, 서류철' },
  { id: 3, name: '반짝반짝디자인부', floor: 6, prop: '색 견본, 큰 모니터' },
  { id: 4, name: '무럭무럭인사부', floor: 7, prop: '화분' },
] as const;
export const DEPT_COUNT = DEPTS.length;
/** 부서 하나 정원(실제 사람) */
export const DEPT_CAP = 20;
/** 건물 하나 = 부서 5개 = 100명 */
export const BUILDING_CAP = DEPT_CAP * DEPT_COUNT;
/** 건물 수(늘리면 2동, 3동) */
export const MAX_BUILDINGS = 1;
/** 사원 자리 수(1팀 7 · 2팀 7 · 3팀 6) */
export const SEATS = 20;
/** 기본 NPC 사원 수 */
export const NPC_BASE = 10;
/** 목표 NPC 사원 수 = max(0, 10 − 실제 사람 수) */
export const npcTarget = (humans: number): number => Math.max(0, NPC_BASE - humans);
/** NPC가 빠지는 간격(초), 들어오는 간격(초) */
export const NPC_LEAVE_SEC = 30;
export const NPC_ENTER_SEC = 15;
/** 위치 보내기 최소 간격(ms) */
export const SNAP_MS = 200;
/** 게시판 */
export const BOARD_MAX = 40;
export const BOARD_PER_PERSON = 3;
export const BOARD_HIDE_REPORTS = 3;
export const LINE_MAX = 30;
export const TODO_MAX = 4;
export const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'] as const;
export const SUIT_KEYS = ['navy', 'charcoal', 'gray', 'black', 'beige', 'pink'] as const;
export type SuitKey = (typeof SUIT_KEYS)[number];
/** 걷는 속도(m/s). 장면이 넓어서 빠른 걸음으로 */
export const WALK_SPEED = 2.6;
export const NPC_SPEED = 1.9;
export const BOSS_SPEED = 2.1;
