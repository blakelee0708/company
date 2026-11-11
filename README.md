# (주)무한채용 — 출근하기

웹 3D 가상 회사. 링크를 누르면 회사 1층 로비에 서 있고, 사원증을 찍고, 엘리베이터를 타고, 내 자리에 앉아 오늘 할 일을 적고, 퇴근할 때 "오늘의 급여"를 받습니다.

- 배포: https://company.play-run.workers.dev
- 기준 문서: [docs/PRD.md](docs/PRD.md) · 시안: [docs/mockups/](docs/mockups/) · 참고 코드: [docs/reference-code/](docs/reference-code/)

## 진행 기록

### 0단계 — 준비
- 한 것: docs/에 기획 묶음을 넣고, Vite + TypeScript + Cloudflare Worker(Durable Object 2종) 최소 버전("준비 중" 화면)을 만들었습니다.
- 확인한 것: `npm run check`, `npm run build`, `npx wrangler deploy --dry-run` 성공.
- 아직 확인 못 한 것: 배포 주소 접속(아래 0단계 확인 결과 참고).

## 개발

```bash
npm install
npm run dev        # 화면만
npm run check      # 타입 검사
npm test           # 단위 테스트
npm run build && npx wrangler dev   # Worker + Durable Object 포함
```
