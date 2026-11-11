// NPC 대사표(PRD 7장). 톤: 위로·칭찬·걱정·가벼운 부탁만. 꾸중·갑질·야근 강요·외모/나이/성별 이야기 없음.
// {이름} = 성 + "사원님", {할일} = 내가 적은 할 일 하나(10자 넘으면 앞 10자 + "…")
export type Who = 'boss' | 'mgr' | 'any';
export interface Choice { label: string; reply?: string[]; act?: 'leave' | 'pantry' | 'walkPantry' }
export interface Line { id: string; who: Who; text: string; choices?: Choice[]; needTodo?: boolean }

export const DEFAULT_REPLY: Record<string, string[]> = {
  감사합니다: ['그래그래 ㅎㅎ', '고맙긴, 내가 고맙지'],
  알겠습니다: ['좋아, 무리는 하지 말고', '천천히 해도 돼'],
  퇴근하겠습니다: ['벌써? …그래, 퇴근은 빠를수록 좋지. 수고했어!', '오 칼퇴! 부럽다. 조심히 가'],
};
export const DEFAULT_CHOICES: Choice[] = [
  { label: '감사합니다', reply: DEFAULT_REPLY['감사합니다'] },
  { label: '알겠습니다', reply: DEFAULT_REPLY['알겠습니다'] },
  { label: '퇴근하겠습니다', reply: DEFAULT_REPLY['퇴근하겠습니다'], act: 'leave' },
];
const C = (label: string, reply?: string | string[], act?: Choice['act']): Choice => ({ label, reply: reply === undefined ? DEFAULT_REPLY[label] : Array.isArray(reply) ? reply : [reply], act: act ?? (label === '퇴근하겠습니다' ? 'leave' : undefined) });
const LEAVE = C('퇴근하겠습니다');

let n = 0;
const L = (who: Who, text: string, choices?: Choice[], needTodo = false): Line => ({ id: 'l' + n++, who, text, choices, needTodo });

/** 7-1 인사 */
export const GREET: Line[] = [
  L('boss', '왔어? 좋은 아침!'),
  L('boss', '오늘도 출근했네. 그게 제일 어려운 거야, 잘했어'),
  L('boss', '커피는 마셨고? 탕비실에 원두 새로 들어왔어'),
  L('boss', '오, 왔구나! 오늘 하루도 잘 부탁해'),
  L('boss', '출근 도장 꾹! 오늘도 반가워'),
  L('boss', '자리 편한 데 골라 앉아. 오늘은 천천히 시작하자'),
  L('mgr', '{이름}, 오늘 컨디션 어때요?'),
  L('mgr', '어서 와요! 자리 편한 데 앉아요'),
  L('mgr', '출근길 춥지 않았어요?'),
  L('mgr', '왔어요? 오늘도 같이 힘내 봐요'),
  L('mgr', '좋은 아침이에요! 물 한 잔 마시고 시작해요'),
  L('mgr', '{이름} 왔다! 반가워요 ㅎㅎ'),
];

/** 7-2 업무 독려(앉아 있을 때 2~4분마다) */
export const NUDGE: Line[] = [
  L('boss', '업무 열심히 해~ 근데 무리는 하지 말고'),
  L('boss', "'{할일}' 그거 오늘 안에 부탁할게. 급한 건 아니야", [C('알겠습니다'), C('오늘 꼭 할게요', ['좋아, 믿고 있을게']), LEAVE], true),
  L('mgr', "'{할일}' 금요일까지만 부탁해요. 막히면 말하고", [C('알겠습니다'), C('도와주세요', '그럼 같이 보자. 일단 첫 줄만 써 봐요')], true),
  L('boss', '집중하는 모습 보기 좋다'),
  L('mgr', '한 시간 했으면 5분은 쉬어요. 그것도 일이에요', [C('감사합니다'), C('탕비실 다녀올게요', '그래요, 다녀와요~', 'pantry')]),
  L('boss', '오늘 할 일 적었어? 적는 것부터가 시작이야'),
  L('mgr', '모니터 너무 가까이 보지 말고요, 눈 아파요'),
  L('boss', "'{할일}' 하다가 막히면 일단 쉬운 것부터 해 봐", [C('알겠습니다'), C('쉬운 것부터 할게요', ['그래, 그게 요령이야']), LEAVE], true),
  L('mgr', "'{할일}' 순서대로 잘 가고 있죠? 천천히 해요", [C('알겠습니다'), C('네, 하고 있어요', ['역시! 그 속도 좋아요']), LEAVE], true),
  L('boss', '어깨 한 번 쭉 펴고 해. 자세가 반이야'),
  L('mgr', '물 자주 마셔요. 은근 잊어버리더라고요'),
  L('boss', '잘하고 있어. 지금처럼만 하면 돼'),
  L('mgr', '오늘 목표 하나만 끝내도 충분해요'),
  L('boss', '창밖 한 번 보고 와. 눈도 쉬어야지'),
];
/** 할 일을 하나도 안 적었을 때 {할일} 대사 대신 */
export const NO_TODO: Line[] = [
  L('boss', '오늘 할 일부터 하나 적어 볼까? 작은 거라도 좋아'),
  L('mgr', '오늘 할 일 하나만 적어 봐요. 물 마시기도 할 일이에요'),
];

/** 7-3 칭찬([완료] 뒤, 결재 승인 때) */
export const PRAISE: Line[] = [
  L('boss', '오, 벌써 끝냈어? 역시 {이름}'),
  L('mgr', "'{할일}' 완료! 오늘 한 건 했네요", undefined, true),
  L('mgr', '이 정도면 오늘 밥값 했어요 ㅎㅎ'),
  L('boss', '하나씩 해내는 게 제일 멋진 거야'),
  L('boss', '해냈네! 그 한 걸음이 제일 커'),
  L('mgr', '완료 체크 보니까 제가 다 뿌듯하네요'),
  L('boss', '좋아, 오늘 일 잘 풀리네'),
  L('mgr', '와, 깔끔하게 끝냈네요. 박수!'),
  L('boss', "'{할일}' 끝냈다며? 진짜 수고했어", undefined, true),
  L('mgr', '하나 끝! 잠깐 기지개 켜고 해요'),
];
export const PRAISE_ALL: Line = L('boss', '오늘 할 일 다 끝냈네! 최고야. 일찍 퇴근해도 돼');

/** 9장 결재 */
export const APPROVE_MGR: Line[] = [
  L('mgr', '확인했어요, 부장님께 올릴게요'),
  L('mgr', "'{할일}' 결재 봤어요. 좋네요, 부장님께 올려 둘게요", undefined, true),
];
export const APPROVE_BOSS: Line[] = [
  L('boss', '결재했어. 깔끔하네, 수고했어'),
  L('boss', "'{할일}' 승인! 계획 좋다", undefined, true),
  L('boss', '도장 꾹 찍었어. 이대로 가 보자'),
];

/** 7-4 걱정과 위로([고민 상담], 오래 앉아 있을 때) */
const STRONG = (): Choice[] => [C('힘이 되네요', '언제든 얘기해'), C('더 버텨 볼게요', '버티는 것도 실력이야')];
export const COMFORT: Line[] = [
  L('any', '요즘 많이 힘들지? 다 지나가더라, 진짜로', STRONG()),
  L('any', '나도 서류 서른 군데 떨어지고 여기 들어왔어. 너도 돼', STRONG()),
  L('any', '얼굴이 좀 피곤해 보이는데, 잠깐 쉬었다 해', [C('감사합니다'), C('탕비실 다녀올게요', '그래, 다녀와~', 'pantry')]),
  L('any', '오늘 아무것도 못 해도 괜찮아. 출근한 걸로 됐어', [C('힘이 되네요', '언제든 얘기해'), C('그래도 하나는 할게요', '그 마음이면 충분해')]),
  L('any', '비교하지 마. 다들 자기 속도로 가는 거야', STRONG()),
  L('any', '결과가 늦게 와도, 하는 사람은 결국 닿더라', STRONG()),
  L('any', '쉬는 것도 다음을 위한 준비야. 미안해하지 마', STRONG()),
  L('any', '오늘 여기 온 것만으로도 한 발 나아간 거야', [C('힘이 되네요', '언제든 얘기해'), C('내일도 올게요', '그래, 자리 비워 둘게')]),
  L('any', '잘 안 풀리는 날은 그냥 그런 날이야. 네 탓 아니야', STRONG()),
  L('any', '작은 거 하나 끝내 보자. 그게 생각보다 힘이 돼', [C('힘이 되네요', '언제든 얘기해'), C('그래도 하나는 할게요', '그 마음이면 충분해')]),
];

/** 7-5 일어날 때(30% 확률) */
export const STANDUP: Line[] = [
  L('any', '어디 가? 탕비실? 나도 커피 한 잔 해야겠다', [C('같이 가요', ['좋아, 가자!'], 'walkPantry'), C('혼자 다녀올게요', '그래, 다녀와~')]),
  L('any', '어디 가? 화장실?', [C('탕비실이요', '가는 김에 내 것도… 농담이야 ㅎㅎ'), C('바람 좀 쐬려고요', '좋지, 금방 와')]),
];

/** 7-6 같이 걸을 때(탕비실까지, 말풍선 3~4줄 차례로) */
export const WALK: string[] = [
  '나 신입 때는 말이야… 아니다, 라떼 얘기는 그만할게 ㅎㅎ',
  '요즘 점심 뭐 먹어? 나는 김치찌개만 3일째야',
  '주말에 뭐 해? 쉬는 것도 계획이 필요하더라',
  '우리 회사 탕비실 믹스커피가 은근 맛집이야',
  '회사 앞에 붕어빵 생겼던데, 퇴근할 때 사 가',
  '예전에 발표하다가 슬라이드를 거꾸로 띄운 적이 있어. 다들 기억 못 하더라, 괜찮아',
  '요즘 산책 코스 하나 찾았는데, 해 질 때 진짜 예뻐',
  '화분 물 주는 거 깜빡했다. 이따 같이 줄래?',
  '어제 본 영화가 좋았어. 다 보고 나니까 힘이 나더라',
  '커피 마시고 딱 10분만 쉬자. 그게 제일 효율 좋아',
];

/** 7-7 엘리베이터 */
export const ELEV_CALL = ['빨리 타!', '어서 타요, 문 닫혀요!', '타요 타요~', '같이 올라가요!'];
export const ELEV_IN = ['몇 층 가요? 아, 같은 층이네요'];
/** 7-8 NPC 사원이 비켜 줄 때 */
export const STAFF_OUT = ['외근 다녀오겠습니다', '회의 들어가요', '은행 좀 다녀올게요'];
export const STAFF_YIELD = '아, 여기 앉으세요!';
export const STAFF_IN = ['다녀왔습니다~', '회의 끝났어요', '외근 마치고 왔어요'];
export const STAFF_DECLINE = '지금 마감이라… 다음에 꼭!';
export const STAFF_ACCEPT = ['좋아요, 가요!', '마침 커피 땡겼어요', '저도 쉬려던 참이에요'];

/** 아무것도 안 누르면(12초) */
export const IGNORED = '바쁜가 보네, 나중에 얘기하자';
/** 퇴근할 때 근처 상사 */
export const BYE = ['수고했어! 내일 보자', '오늘도 고생 많았어. 조심히 가', '수고했어요! 푹 쉬어요'];

/** 실제 시각에 따른 한마디(13장 4번: 넣기로 정함) */
export const LUNCH = L('boss', '점심 먹고 해! 밥은 꼭 챙겨 먹어');
export const EVENING = L('boss', '퇴근 안 해? 얼른 가. 오늘 충분히 했어', [C('감사합니다'), C('조금만 더 할게요', ['그래, 너무 늦지만 마']), LEAVE]);

/** 퇴근 카드 오늘의 한마디(30개) */
export const QUOTES = [
  '오늘도 출근한 당신, 그것만으로 충분히 잘했어요',
  '적어 둔 일 하나만 해도 오늘은 성공이에요',
  '어디에 있든, 오늘 당신은 일하는 사람이었어요',
  '쉬어 가는 날도 출근한 날이에요',
  '내일 자리는 비워 둘게요. 언제든 다시 출근하세요',
  '오늘 한 걸음, 내일은 조금 더 가벼울 거예요',
  '자리에 앉은 순간부터 이미 시작한 거예요',
  '결과는 늦게 와도, 오늘의 당신은 진짜예요',
  '할 일을 적은 손이 오늘의 주인공이에요',
  '오늘 버틴 시간도 분명히 쌓이고 있어요',
  '느려도 괜찮아요. 멈추지만 않으면 돼요',
  '오늘 마신 커피만큼 숨 고르기도 잘했어요',
  '당신의 속도가 맞는 속도예요',
  '오늘의 출근 도장, 잘 찍었습니다',
  '수고했어요. 이제 푹 쉬는 것도 일이에요',
  '작은 완료가 모여 큰 하루가 돼요',
  '오늘은 오늘만큼만. 충분히 잘했어요',
  '아무도 안 봐도, 오늘 당신은 성실했어요',
  '출근길을 나선 마음, 그게 제일 대단해요',
  '하루를 채운 당신에게 박수를 보내요',
  '다음 출근도 여기서 기다릴게요',
  '오늘 적은 일, 내일의 당신이 고마워할 거예요',
  '잘 안 된 일보다 해낸 일을 기억해요',
  '지금 이 순간도 경력이 되고 있어요',
  '오늘의 당신, 우리 회사 우수 사원이에요',
  '힘든 날일수록 출근한 건 더 큰 일이에요',
  '내일의 할 일은 내일의 당신에게 맡겨요',
  '오늘 하루 고생 많았어요. 정말로요',
  '당신이 있어서 사무실이 따뜻했어요',
  '퇴근 완료! 오늘 저녁은 맛있는 걸로 해요',
];

/** 할 일 칸 예시 */
export const TODO_HINTS = ['예) 자기소개서 1번 문항 쓰기', '예) 이력서 한 군데 넣기', '예) 30분 산책하기', '예) 미뤄 둔 메일 답장하기', '예) 방 청소하기', '예) 영어 단어 20개'];
/** 게시판 예시 + NPC가 미리 붙여 둔 메모 */
export const BOARD_HINTS = ['예) 오늘 면접 보고 왔어요. 다들 힘내요', '예) 3번째 출근, 이제 좀 익숙해요', '예) 다음 주에 첫 출근합니다!', '예) 커피 맛집은 4층 탕비실'];
export { BOARD_SEED } from '../shared/boardSeed';

/** 대사 고르기: 같은 대사는 한 번 출근하는 동안 다시 나오지 않음 */
export function pickLine(pool: Line[], used: Set<string>, opts: { who?: 'boss' | 'mgr'; hasTodo: boolean; rnd?: () => number }): Line | null {
  const r = opts.rnd ?? Math.random;
  const ok = pool.filter((l) => !used.has(l.id) && (l.who === 'any' || !opts.who || l.who === opts.who) && (!l.needTodo || opts.hasTodo));
  if (!ok.length) return null;
  const l = ok[Math.floor(r() * ok.length)];
  used.add(l.id);
  return l;
}
export function fillLine(text: string, name: string, todo: string | null): string {
  const call = name.split('#')[0] + '님';
  const t = todo ? (todo.length > 10 ? todo.slice(0, 10) + '…' : todo) : '';
  return text.replace(/\{이름\}/g, call).replace(/\{할일\}/g, t);
}
export const ALL_LINES: Line[] = [...GREET, ...NUDGE, ...NO_TODO, ...PRAISE, PRAISE_ALL, ...APPROVE_MGR, ...APPROVE_BOSS, ...COMFORT, ...STANDUP, LUNCH, EVENING];
