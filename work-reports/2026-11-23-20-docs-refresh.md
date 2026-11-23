# CLAUDE.md·교수님 확인 목록 갱신

- 날짜: 2026-11-23
- PR: #58

## 한 줄 요약
#39~#57에서 바뀐 구조와 규칙을 CLAUDE.md에 반영하고, 교수님이 직접 확인할 항목을 `docs/owner-action-items.md`에 추가했습니다.

## 무엇을 바꿨나
- **CLAUDE.md 구조**
  - 하단 메뉴 구성(홈·내역·분석·더보기)
  - `useSyncPersistence` 훅
  - 새 lib 파일(계좌 잔액, 대출, 구독, 목표, 월말 예측, 알림)
  - Firestore·Storage 지연 로드
- **CLAUDE.md 규칙**
  - `firebase/firestore`·`firebase/storage`를 정적으로 import하지 않기
  - 인라인 시트는 `InlineDialog`로 감싸기
- **교수님 확인 목록**
  - 오프라인 재시도
  - 지연 로드 이후 로그인 흐름
  - 새 기능 5종 써 보기

## 확인한 방법
- `npm run lint` 통과(문서만 변경)
