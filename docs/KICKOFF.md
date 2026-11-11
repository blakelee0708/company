# 외부 AI에게 줄 지시문 (한 번에 끝까지)

1. 코딩 AI(Claude Code 등)를 GitHub 저장소 `blakelee0708/company`에 연결해 새 세션을 엽니다.
2. 이 묶음(`muhan-handoff` 폴더 전체: PRD.md, mockups/, reference-code/)을 올립니다.
3. 아래 상자 안의 글을 그대로 붙여 넣고 보냅니다. 끝까지 묻지 않고 혼자 진행하도록 쓴 지시문입니다.

---

```
너는 이 프로젝트의 개발자야. 웹 3D 가상 회사 "(주)무한채용 — 출근하기"를 처음부터 끝까지 혼자 만든다.
나는 자는 중이라 대답할 수 없어. 중간에 질문하지 말고, 멈추지 말고, 12장의 6단계를 모두 끝낼 때까지 계속 진행해.
판단이 필요한 곳은 PRD 원칙에 맞는 합리적인 기본값으로 정하고, README의 "내가 정한 것" 목록에 이유와 함께 적어.

[저장소와 배포]
- GitHub 저장소: blakelee0708/company (비어 있음). 작업은 main 브랜치에 바로 커밋하고 푸시해.
- Cloudflare Worker 이름: company. 이미 저장소와 연결돼 있어서, main에 푸시하면 Cloudflare가 `npx wrangler deploy`로 자동 배포해.
  - wrangler.jsonc: "name": "company", "main": "src/server/worker.ts", "build": { "command": "npm run build" },
    "assets": { "directory": "./dist", "binding": "ASSETS" }, Durable Object 바인딩과 migrations(new_sqlite_classes),
    "observability": { "enabled": false }.
  - 푸시하기 전에 로컬에서 `npm run build`와 `npx wrangler deploy --dry-run`이 성공하는지 꼭 확인해. main이 배포에 실패하는 상태로 두지 마.
  - 배포 주소: https://company.play-run.workers.dev
- 맨 처음 할 일: 이 묶음(PRD.md, mockups/, reference-code/)을 저장소 docs/ 폴더에 넣고 커밋해.
  그다음 1단계 전에 "준비 중" 화면 하나만 있는 최소 버전(Vite + Worker)을 만들어 푸시해서 배포가 성공하는지 먼저 확인해.

[먼저 읽을 것]
1. docs/PRD.md 전체. 모든 숫자·문구·규칙은 PRD가 기준이야. [미정]은 네가 기본값으로 정해.
2. docs/mockups/ 의 화면 시안(00~09는 폰 세로, pc-01·pc-03은 PC 가로). 화면 구성, 버튼 위치, 문구, 색, 캐릭터와 공간 생김새의 기준.
3. docs/reference-code/. 시안은 전부 이 three.js 코드로 찍은 거야(AI 그림 아님). PRD 15장 순서대로
   캐릭터(toon.js의 worker), 빛(clay.js), 장면(scenes4.js: 천장 12m 로비, 넓은 칸막이·듀얼 모니터 사무실, 과장=2팀 팀장 자리, 탕비실, 엘리베이터)을
   TypeScript로 옮겨 출발점으로 써. 크기·위치·색 숫자는 바꾸지 마.
   - 몸은 매끈한 도형 몇 개로만(PRD 14장). 팔다리가 몸에서 떨어져 보이면 안 되고, 캐릭터는 그림자를 받지 않게(줄무늬 없게).
   - 자리는 넓게(자리 폭 3m, 책상 2.8×1.2). 폰은 가까이(주변 2~3자리), PC는 사무실 전체가 보이게(PRD 6장).

[반드시 지킬 것]
- 의도는 "위로"다. 부장·과장은 좋은 상사다. 꾸중·갑질·야근 강요·외모/나이/성별 이야기는 대사에 절대 넣지 않는다.
- 아무것도 저장하지 않는다: 회원가입·로그인·쿠키·localStorage·서버 DB 없음. 서버 로그 저장도 끈다.
- "오늘의 할 일" 내용은 서버로 보내지 않는다(내 기기 메모리에만).
- 자유 채팅은 없다. 글은 사내 게시판 한 줄(30자, 걸러내기 통과)뿐이다.
- 실제 기업을 떠올리게 하는 이름·로고·색은 쓰지 않는다.
- 급여 = floor(근무 분 ÷ 30) × 5,350원 (시급 10,700원). 단위 테스트로 확인한다.
- 비밀값(API 키 등)은 필요 없고, 저장소에 넣지도 않는다.

[기술]
- Vite + TypeScript(strict) + three.js r149, 3D 위에 HTML UI.
- Cloudflare Workers(정적 파일) + Durable Objects(부서 하나 = 방 하나, 정원 20, WebSocket Hibernation). 건물 하나 = 부서 5개 = 최대 100명.
- 위치는 묶어서 최대 200ms마다 보낸다. NPC는 서버에 없고 각 기기가 자리표를 보고 같은 규칙으로 그린다.
- 폰(앱 안 브라우저 포함)과 PC 모두에서 동작. 중급 폰 30fps, 4G에서 5초 안에 로비 조작 가능.

[순서] PRD 12장의 6단계를 차례로. 각 단계가 끝날 때마다 main에 커밋·푸시해서 배포까지 되게 해.
0. 준비: docs/ 넣기, 최소 버전 배포 확인
1. 캐릭터(reference-code/toon.js 옮기기 + 앉기·타자·카드 찍기·손짓 동작) — 시안 09와 나란히 비교
2. 혼자 출근: 타이틀 → 캐릭터 선택(남사원·여사원) → 로비(카드 찍기) → 엘리베이터 → 사무실 → 앉기 → PC 할 일 4칸 → 퇴근 카드(급여)
3. 부장·과장 NPC(다가와 말 걸기, 대화창, 대사표, 결재)
4. 탕비실(커피 4종, 간식, 건배)
5. 같이 출근(실시간): 부서 방, 자리표, 배정, NPC 교체, 인사·박수·탕비실 같이 가기, 사내 게시판
6. 마무리: 조작법 카드, 결과 이미지 저장, 입장 속도, og:image

[단계마다 할 것]
- 타입 검사와 단위 테스트 통과.
- Playwright로 실제 브라우저를 띄워 그 단계의 흐름을 끝까지 눌러 보고, 폰(390×844)과 PC(1440×900) 화면을 캡처해 docs/mockups/의 같은 화면과 나란히 놓고 비교. 다르면 고친다.
- 캡처는 docs/progress/단계번호/ 에 저장해서 커밋(내가 아침에 볼 수 있게).
- README 맨 위 "진행 기록"에 단계마다 3줄: 한 것, 확인한 것, 아직 확인 못 한 것.
- 막히면 그 부분만 README에 적고 다음 일로 넘어가. 전체를 멈추지 마.

[다 끝나면]
- 배포 주소에서 폰·PC 크기로 처음부터 퇴근까지 한 번 끝까지 해 보고, 그 캡처를 docs/progress/final/ 에 넣어 커밋.
- README에 최종 요약: 된 것, 안 된 것, 내가 정한 기본값, 다음에 하면 좋을 것.

지금 0단계부터 시작해.
```

---

## 참고: 함께 달려요 코드를 쓸 수 있다면

같은 운영자의 "함께 달려요(run 2gether)" 저장소(`blakelee0708/2getherrun`)를 외부 AI가 읽을 수 있으면 위 지시문 끝에 이 줄을 덧붙이세요.

```
blakelee0708/2getherrun 저장소를 참고해: 동작 엔진(anim/), 카메라(game/view.ts), 방 서버(server/crowdRoom.ts),
한 줄 걸러내기(shared/lineFilter.ts, shared/words.ts), 결과 이미지 저장(ui/share.ts)을 가져와서 고쳐 써.
캐릭터 몸(character/)은 가져오지 마. docs/reference-code/toon.js의 매끈한 몸을 써.
```
