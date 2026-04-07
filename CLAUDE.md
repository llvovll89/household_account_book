# 잔고플랜 — Household Account Book

개인 가계부 PWA. 수입/지출 내역, 예산, 반복거래, 메모, 주식 포트폴리오 관리.

## 스택

| 영역 | 기술 |
|------|------|
| UI | React 19, TypeScript 5.9 |
| 스타일 | Tailwind CSS v4 (설정 파일 없음, Vite 플러그인으로 통합) |
| 빌드 | Vite 7 |
| 백엔드 | Firebase 12 (Auth, Firestore, Analytics) |
| 차트 | Recharts 3 |
| CSV/Excel | PapaParse, XLSX |
| PWA | vite-plugin-pwa (workbox) |

## 프로젝트 구조

```
src/
├── App.tsx                  # 앱 전체 상태 + 탭 라우팅 + 모달 관리
├── types/index.ts           # 모든 인터페이스 + 카테고리 상수 + 색상/이모지 맵
├── types/navigation.ts      # Tab, AppMode, StockSubTab 타입
├── hooks/
│   ├── useTransactions.ts   # 내역 CRUD
│   ├── useStockTrades.ts    # 주식거래 CRUD
│   ├── useAuthSync.ts       # Firebase 인증 + 로컬 데이터 마이그레이션
│   ├── useStockChart.ts     # 주식 차트 데이터
│   └── useStockPrice.ts     # 실시간 주가 (Yahoo Finance)
├── lib/
│   ├── storage.ts           # localStorage ↔ Firestore 추상화
│   ├── format.ts            # fmt(숫자), fmtShort, generateId
│   ├── useMonthlyData.ts    # 월별 집계 훅
│   ├── chartTheme.ts        # 차트 색상 테마
│   ├── stockPriceApi.ts     # Yahoo Finance API 래퍼
│   ├── stockCalc.ts         # 주식 계산 로직
│   ├── bankParser.ts        # 은행 CSV 파서
│   ├── exportCsv.ts         # CSV 내보내기
│   └── toast.ts             # 토스트 알림
├── components/
│   ├── workspaces/          # LedgerWorkspace, StocksWorkspace (뷰 컨테이너)
│   ├── charts/              # SparklineCard, DonutChart, TrendAreaChart 등 8개
│   ├── layout/              # BottomNavigation
│   ├── TransactionModal.tsx # 내역 추가/수정 폼
│   ├── TransactionList.tsx  # 내역 목록 (필터, 태그별 합계)
│   ├── Dashboard.tsx        # 홈 (예산, 반복거래, 차트)
│   ├── Analytics.tsx        # 월별/연간 분석 차트
│   ├── MemoSection.tsx      # 메모 카드 + 캘린더 뷰
│   └── ...                  # 각종 모달 (Budget, Category, Recurring, Import, Export 등)
└── firebase/firebase.ts     # Firebase 초기화
```

## 아키텍처 패턴

### 상태 관리
- **Redux/Zustand 없음** — App.tsx에서 useState로 중앙 관리 후 props drilling
- CRUD 로직은 커스텀 훅으로 분리 (`useTransactions`, `useStockTrades`)
- useCallback으로 핸들러 메모이제이션

### 이중 스토리지
- **로컬 모드**: localStorage (키 prefix: `hb_*`)
- **Firebase 모드**: Firestore (`users/{uid}/app/default`)
- `storage.ts`의 `setStorageContext(mode, uid)` 로 모드 전환
- 로그인 시 로컬 데이터 → Firebase 병합 확인 모달 (`MergeLocalDataModal`)

### 컴포넌트 패턴
- **워크스페이스** 패턴: LedgerWorkspace/StocksWorkspace가 탭 내 뷰 전체 담당
- **모달 기반 폼**: 추가/수정은 모두 바텀시트 모달
- `charts/` — Recharts 기반 차트 컴포넌트 모음

## 핵심 타입 (`src/types/index.ts`)

```ts
Transaction    // id, type(income|expense), amount, category, description, tags?, date(YYYY-MM-DD), createdAt
Budget         // category, limit
RecurringTransaction  // id, type, amount, category, dayOfMonth, lastAppliedMonth
Memo           // id, title, content, date?, amount?, category?, pinned, createdAt, updatedAt
StockTrade     // id, ticker, tradeType(buy|sell), quantity, price, fee, currency, date, note
AppSettings    // payday, customExpenseCategories[], customIncomeCategories[], stockWatchlist[]
```

## 카테고리 상수 (`src/types/index.ts`)

```ts
INCOME_CATEGORIES   // ['급여', '부업', '용돈', '투자수익', '기타수입']
EXPENSE_CATEGORIES  // ['식비', '교통비', '주거비', '통신비', '의료비', '쇼핑', '문화/여가', '교육', '저축', '기타지출']
CATEGORY_COLOR      // Record<string, { bg: string; text: string }> — rgba 기반
CATEGORY_EMOJI      // Record<string, string>
```

## 유틸리티

```ts
// lib/format.ts
fmt(n: number): string        // 1234567 → "1,234,567"
fmtShort(n: number): string   // 1234567 → "123.4만"
generateId(): string          // 고유 ID 생성

// lib/storage.ts
loadTransactions() / saveTransactions()
loadMemos() / saveMemos()
loadBudgets() / saveBudgets()
loadSettings() / saveSettings()
```

## UI 컨벤션

- **다크 테마 고정** (라이트 모드 없음)
- **배경 팔레트**: `#0F1221` (앱 배경), `#1E2236` (카드), `#252A3F` (입력/칩)
- **강조색**: `#3D8EF8` (파랑/기본), `#2ACF6A` (수입), `#F25260` (지출)
- **텍스트**: `#F1F3F6` (기본), `#8B95A1` (보조), `#4E5968` (비활성)
- **모서리**: `rounded-2xl` (컴포넌트), `rounded-3xl` (카드), `rounded-[28px]` (바텀시트)
- **숫자 폰트**: `num` 클래스 적용
- 한국어 UI

## 하지 말 것

- 새 상태관리 라이브러리(Redux, Zustand 등) 추가 금지
- 라이트 모드 구현 금지
- Tailwind config 파일 생성 금지 (v4는 설정 파일 불필요)
- `description` 직접 파싱 대신 `tags` 필드 사용 (이미 분리됨)
