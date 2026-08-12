# 신호등 대환장

두 개의 신호만 바꿔 60초 동안 차량을 최대한 많이 통과시키는 탑다운 교통 관제 웹게임입니다.

## 실행

Node.js 20 이상이 필요합니다.

```powershell
npm install
npm run dev
```

개발 서버는 `http://localhost:5188`에서 실행됩니다.

```powershell
npm test
npm run typecheck
npm run build
```

## 조작

- PC: `1` 또는 위·아래 방향키로 남북 신호, `2` 또는 좌·우 방향키로 동서 신호
- 모바일: 화면 아래 `남북`, `동서` 버튼
- 일시정지: `Space` 또는 오른쪽 위 일시정지 버튼
- 소리: 오른쪽 위 음표 버튼

## 규칙

- 제한 시간은 60초입니다.
- 신호는 황색 350ms와 전방향 적색 250ms를 거쳐 바뀝니다.
- 차량 한 대가 안전하게 통과하면 기본 100점과 콤보 보너스를 얻습니다.
- 구급차를 통과시키면 우선 통과 보너스를 얻습니다.
- 구급차가 진입하면 짧은 사이렌과 화면 안내가 재생됩니다.
- 같은 색 차량을 연속 통과시키면 색상 콤보가 이어집니다.
- 충돌하면 500점이 줄고 콤보가 초기화됩니다.
- 충돌을 목격한 주변 접근로의 맨 앞차가 급정거하고, 안전거리 때문에 뒤차들이 줄줄이 멈춰 5초 동안 연쇄 정체가 생깁니다.
- 구급차는 첫 1대가 초반에 보장되며 이후 최소 18초 간격, 한 판 최대 3대만 등장합니다.
- 2단계에서는 10초마다 차량이 몰려오는 러시아워 웨이브 6개를 버티며, 웨이브 클리어 보너스를 얻습니다.
- 세 번 충돌하면 즉시 종료됩니다.
- 한 방향 대기열이 7대가 되면 정체 페널티 250점을 받습니다.
- 같은 날짜에는 같은 차량 생성 순서가 사용되며, 개인 최고 기록은 브라우저에 저장됩니다.

## 기술 구성

- Vite + TypeScript
- HTML5 Canvas 2D 월드 렌더링
- 시맨틱 HTML/CSS HUD와 터치 조작
- 고정 시간 간격과 시드 RNG를 사용하는 결정적 게임 시뮬레이션
- Vitest 단위·통합 테스트
- Playwright CLI 실제 브라우저 검증

## 에셋과 라이선스

사용자가 새로 제작해야 하는 에셋은 없습니다.

- 자동차·나무·장애물: [Kenney Racing Pack](https://kenney.nl/assets/racing-pack), CC0
- 효과음: Kenney New Platformer Pack, CC0
- 신호등·도로·HUD·버튼: Canvas와 CSS 기본 도형

프로젝트가 실제로 사용하는 파일과 출처는 `public/assets/assets.json`에 기록되어 있습니다. 원문 라이선스는 `public/assets/License-Racing-Pack.txt`와 `public/assets/License-New-Platformer-Pack.txt`에 포함되어 있습니다.

## 구조

```text
src/game/       결정적 게임 상태와 규칙
src/rendering/  Canvas 렌더러와 이미지 로더
src/ui/         DOM HUD와 접근성 상태
src/storage/    검증된 localStorage 어댑터
src/audio/      효과음 재생과 음소거
src/app/        화면·입력·게임 루프 연결
docs/           계획과 화면 목업
```

## 배포

`npm run build` 결과물인 `dist/`를 정적 호스팅하면 됩니다. `netlify.toml`에 Vite 빌드와 SPA 폴백 설정이 포함되어 있습니다.

최종 검증 결과는 [docs/QA_REPORT.md](docs/QA_REPORT.md)에서 확인할 수 있습니다.
