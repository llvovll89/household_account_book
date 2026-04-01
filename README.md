# 잔고플랜

수입·지출·예산을 한 번에 관리하는 개인 재무 관리 PWA입니다.

## 주요 기능

- 거래 관리: 수입/지출 등록, 수정, 삭제
- 예산 관리: 카테고리별 예산 설정, 리스트/게이지 뷰
- 정기 내역: 월별 반복 거래 등록 및 일괄 적용
- 분석: 월별/연간 추이, 카테고리 분석 차트
- 메모: 카드 뷰 + 캘린더 뷰 전환, 날짜별 스케줄 형태 확인
- 주식 거래: 매수/매도 기록 및 보유/손익 계산 (로그인 사용자만 노출)
- 가져오기/내보내기: CSV 기반 거래 데이터 import/export
- PWA: 홈 화면 설치, 오프라인 캐시, 업데이트 배너

## 데이터 저장 방식

- 비로그인: 로컬 저장소(localStorage)에 저장
- 로그인: Firebase(Auth + Firestore)에 사용자별 저장
- 로그인 시 로컬 데이터가 있으면 Firebase 데이터와 병합 여부를 선택할 수 있습니다.

## 기술 스택

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- Firebase (Auth, Firestore, Analytics)
- Recharts
- vite-plugin-pwa
- PapaParse, XLSX

## 시작하기

### 1) 설치

```bash
npm install
```

### 2) 개발 서버

```bash
npm run dev
```

### 3) 빌드

```bash
npm run build
```

### 4) 빌드 결과 확인

```bash
npm run preview
```

## 환경 변수

루트에 `.env` 또는 `.env.local` 파일을 만들고 아래 값을 설정하세요.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

## Vercel 배포

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: 위 `VITE_FIREBASE_*` 값을 Vercel 프로젝트 설정에 동일하게 추가

## 보안 주의사항

- `VITE_` 접두사 환경변수는 클라이언트 번들에 포함되므로 공개됩니다.
- Firebase 웹 설정값은 공개 전제이지만, Firestore Rules/Auth 도메인 제한은 반드시 설정하세요.
- `.env`는 Git에 커밋하지 마세요.

## 공유(카카오톡) 미리보기

- `index.html`에 Open Graph 메타가 포함되어 있어 링크 공유 시 썸네일/제목/설명이 노출됩니다.
- 반영이 늦으면 카카오 공유 디버거에서 캐시를 초기화해 주세요.

## 프로젝트 구조 (핵심)

```text
src/
  components/
  firebase/
  hooks/
  lib/
  types/
  App.tsx
```

## 라이선스

개인 프로젝트
