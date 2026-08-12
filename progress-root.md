# 신호등 대환장 구현 진행 기록

## 범위와 가정

- 단일 교차로, 60초, 1인 로컬 기록 MVP
- Vite + TypeScript + Canvas 2D + DOM/CSS
- Kenney CC0 원본 에셋과 코드로 그리는 UI만 사용
- 로그인과 원격 순위표는 제외

## Sprint 1 — 기반과 에셋

- [x] 공식 Racing Pack 다운로드 및 CC0 라이선스 확인
- [x] 필요한 자동차·환경 스프라이트와 효과음만 프로젝트에 복사
- [x] 에셋 매니페스트, favicon, manifest, HTML 구조 작성
- [x] 의존성 설치 및 에셋 매니페스트 검증

## Sprint 2 — 게임 로직

- [x] 결정적 RNG와 신호 상태 머신
- [x] 차량 이동·대기·충돌·점수·종료
- [x] 단위 테스트

## Sprint 3 — 화면과 조작

- [x] Canvas 렌더러와 반응형 HUD
- [x] 터치·키보드·저장·오디오
- [x] 시작·일시정지·결과 흐름

## Sprint 4 — QA

- [x] 타입 검사, 단위 테스트, 빌드, 보안 감사
- [x] 데스크톱·모바일 실제 플레이 검증
- [x] 콘솔, 네트워크, 접근성, 성능 검증

## 최종 결과

- TypeScript: 통과
- Vitest: 6개 파일, 28개 테스트 통과
- 2단계: 스테이지 선택, 6단계 러시아워 웨이브, 웨이브 클리어 보너스 완료
- npm audit: 취약점 0건
- Production Lighthouse: Performance 100 / Accessibility 100 / Best Practices 100 / SEO 100
- 브라우저 콘솔: 오류 0건 / 경고 0건
- 프로덕션 정적 요청: 누락 에셋 0건
