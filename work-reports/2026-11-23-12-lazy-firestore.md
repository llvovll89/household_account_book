# Firestore·Storage 지연 로드 (시작 번들 −27%)

- 날짜: 2026-11-23
- PR: #50

## 한 줄 요약
Firestore와 Firebase Storage SDK를 시작할 때가 아니라 처음 필요할 때 불러오도록 바꿨습니다. 홈 시작 번들이 222KB에서 162KB로, 입력 화면이 237KB에서 177KB로 줄었습니다(gzip).

## 왜 했나
- 기술부채 감사 8번 항목입니다.
- `firebase.ts`가 시작 시 `getFirestore`·`getStorage`를 호출했습니다. 그래서 로그인하지 않은 사용자도 두 SDK를 모두 받았습니다.
- `vite.config.ts`가 firebase 관련 모듈을 모두 한 청크(`vendor-firebase`)에 묶고 있었습니다.

## 무엇을 바꿨나
- `firebase.ts`: `db`·`storage` 상수 대신 `getDb()`·`getStorageInstance()`를 둡니다. 처음 호출할 때 SDK를 동적으로 불러오고, 결과는 캐시합니다.
- `lib/storage.ts`: Firestore 함수(`doc`, `getDoc`, `getDocFromServer`, `runTransaction`)를 Firebase 모드 경로에서만 동적으로 불러옵니다.
- `lib/receiptStorage.ts`: 영수증을 올리거나 지울 때만 Storage SDK를 불러옵니다.
- `vite.config.ts`: `vendor-firestore`, `vendor-firebase-storage` 청크를 분리했습니다. 둘 다 PWA precache에는 그대로 포함되므로, 로그인 사용자의 오프라인 동작은 같습니다.

## 확인한 방법
- `npm run verify` 통과(테스트 283개). 테스트의 firebase mock은 새 함수 이름으로 바꿨습니다.
- 시작 번들 측정(`measure-startup.mjs`, gzip)
  - 홈: 221,713 → 162,195바이트
  - 입력: 236,915 → 177,387바이트

## 남은 일·주의
- 로그인 사용자는 첫 데이터 로드 때 Firestore 청크를 한 번 더 받습니다. 서비스 워커가 precache하므로 두 번째 방문부터는 로컬에서 바로 읽습니다.
- **교수님 확인:** 배포 후 로그인 → 데이터 표시 → 저장 → 새로고침이 정상인지 봐 주세요.
