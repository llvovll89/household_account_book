# 취약 의존성 교체와 보안 규칙 코드화

- 날짜: 2026-11-09
- PR: #27 / 커밋: `ebaa0cb`

## 한 줄 요약
은행 파일을 읽는 `xlsx`의 알려진 취약점 2건을 없애고, Firebase 접근 규칙을 저장소에서 관리하기 시작했습니다.

## 왜 했나
- npm의 `xlsx@0.18.5`는 SheetJS가 더 이상 갱신하지 않는 버전입니다. 프로토타입 오염(GHSA-4r6h-8v6p-xvw6)과 ReDoS(GHSA-5pgg-2g8v-p4x9) 취약점이 있습니다. 앱은 사용자가 고른 은행 파일을 이 라이브러리로 파싱하므로 공격 표면이 실제로 있습니다.
- `npm audit` 결과 vite, postcss, protobufjs 등 전이 의존성에서 high 6건, critical 2건이 나왔습니다.
- Firestore와 Storage 보안 규칙이 저장소에 없어서 콘솔에서만 관리되고 있었습니다. 변경 이력도 리뷰 과정도 없었습니다.

## 무엇을 바꿨나
- `xlsx`를 SheetJS 공식 CDN 배포본 0.20.3으로 교체했습니다(공식 권장 설치 방식).
- `npm audit fix`로 semver 범위 안에서 고칠 수 있는 의존성을 패치했습니다.
- `firestore.rules`: 로그인한 본인의 `users/{uid}/app/default` 문서만 읽고 쓸 수 있습니다. 그 밖의 경로는 모두 거부합니다.
- `storage.rules`: 본인의 영수증 경로만 접근할 수 있고, 업로드는 5MB 미만 이미지만 허용합니다. 앱의 업로드 검증 기준과 같습니다.
- `firebase.json`에 위 두 규칙 파일을 연결했습니다.

## 확인한 방법
- xlsx 가져오기 회귀 테스트를 추가했습니다(은행 제목 행 아래에서 헤더를 찾는지 확인).
- `npm run verify`(lint, 테스트 210개, 빌드, 시작 번들 예산)를 통과했습니다.
- 앱이 실제로 쓰는 Firestore·Storage 경로를 코드에서 찾아 규칙과 일치하는지 대조했습니다.

## 남은 일·주의
- **규칙 배포 필요:** 콘솔의 현재 규칙과 비교한 뒤 `npx firebase-tools deploy --only firestore:rules,storage`로 배포해야 합니다.
- `@grpc/grpc-js` 경고는 최신 Firestore도 `~1.9`에 고정돼 있어서 남아 있습니다. Node 빌드에서만 쓰이고 브라우저 번들에는 들어가지 않습니다.
- vitest 관련 경고는 dev 의존성이고 메이저 업그레이드가 필요해서 테스트 정비 작업으로 미뤘습니다.
