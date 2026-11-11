# (주)무한채용 — 출근하기

웹 3D 가상 회사. 링크를 누르면 회사 1층 로비에 서 있고, 사원증을 찍고, 엘리베이터를 타고, 내 자리에 앉아 오늘 할 일을 적고, 퇴근할 때 "오늘의 급여"를 받습니다.

- 배포: https://company.play-run.workers.dev
- 기준 문서: [docs/PRD.md](docs/PRD.md) · 시안: [docs/mockups/](docs/mockups/) · 참고 코드: [docs/reference-code/](docs/reference-code/)

## 진행 기록

### 0단계 — 준비
- 한 것: docs/에 기획 묶음을 넣고, Vite + TypeScript + Cloudflare Worker(Durable Object 2종) 최소 버전("준비 중" 화면)을 만들었습니다.
- 확인한 것: `npm run check`, `npm run build`, `npx wrangler deploy --dry-run` 성공.
- 아직 확인 못 한 것: 없음. 푸시 후 약 1~2분 뒤 https://company.play-run.workers.dev/api/health 가 200을 돌려주는 것까지 확인했습니다.

### 1단계 — 캐릭터
- 한 것: `toon.js`의 `worker()`를 `src/character/worker.ts`로 옮겼습니다(숫자 그대로). 팔·다리는 매 프레임 꼭짓점만 다시 계산하는 이음매 없는 관(`Limb`), 얼굴 조각은 재질별로 하나로 합쳐 그리기 횟수를 줄였습니다. 동작 엔진 `src/anim/animator.ts`: 서기·걷기·앉기·타자 + 손 흔들기·손짓·카드 찍기·박수·인사·마시기·건배·기지개·통화·끄덕이기.
- 확인한 것: 캐릭터 뷰어(`/viewer.html?still=1`)를 시안 09와 나란히 비교(`docs/progress/1/compare-09-characters.png`) — 비율·색·자세가 같습니다. 모든 동작을 앞·옆에서 찍어(`docs/progress/1/poses.png`) 손이 얼굴·몸을 뚫지 않는 것을 확인. 급여 단위 테스트 9개 통과.
- 아직 확인 못 한 것: 실제 중급 폰에서의 프레임(이 환경은 소프트웨어 렌더링이라 측정 불가).

## 개발

```bash
npm install
npm run dev        # 화면만
npm run check      # 타입 검사
npm test           # 단위 테스트
npm run build && npx wrangler dev   # Worker + Durable Object 포함
```
