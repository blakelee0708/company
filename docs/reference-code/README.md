# 시안을 찍은 코드 (three.js r149)

`mockups/`의 화면은 AI 그림이 아니라 이 폴더의 코드로 찍은 것입니다. 같은 코드로 게임을 만들면 시안과 똑같이 나옵니다.

| 파일 | 내용 |
|---|---|
| `toon.js` | 캐릭터 `worker({ sex, suit, tie, pose, mouth, glasses, bald, hairC })`. 몸통 회전체 하나 + 이음매 없는 팔 관 + 닫힌 머리카락 면. 셔츠 V·넥타이·라펠은 셰이더로 칠함. 앞이 +z, 발바닥 y=0, 키 약 1.5 |
| `clay.js` | 점토 느낌 렌더: 방 반사, 부드러운 그림자, 톤 매핑 없음 |
| `scenes4.js` | 장면: 타이틀, 캐릭터 선택, 로비(천장 12m), 엘리베이터, 사무실(칸막이·듀얼 모니터), 부장님 가까이, 탕비실 |
| `mockups.html` | 시안 12장(폰) + PC 가로 화면 2장 |
| `sheet4.html` | 캐릭터 모음(`mockups/09-characters.png`) |
| `three.module.js` 등 | three.js r149와 예제 모듈(RoundedBoxGeometry, RoomEnvironment) |
| `PretendardVariable.woff2` | 글꼴 Pretendard(SIL Open Font License) |

보는 법: 이 폴더에서 `python3 -m http.server 8000`을 켜고 `http://localhost:8000/mockups.html`을 엽니다.

게임에서 쓸 때:
- TypeScript로 옮겨 `src/character/`, `src/world/`에 둡니다. 크기·색 숫자는 바꾸지 않습니다.
- 자세(pose)는 지금 정지 자세입니다. 움직임은 조각을 뼈대(SkinnedMesh)에 붙이거나 팔 관을 프레임마다 다시 만들어 만듭니다.
- 캐릭터는 `receiveShadow = false`를 꼭 지킵니다(몸에 줄무늬가 생기지 않게).
