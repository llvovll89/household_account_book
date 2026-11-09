# 잔고플랜 — Household Account Book

개인 가계부 PWA. 수입/지출 내역, 예산, 정기 내역, 구독, 저축 목표, 메모 관리.
배포: https://balance-plan.vercel.app/ (Vercel, `main` 자동 배포)

## 스택

| 영역 | 기술 |
|------|------|
| UI | React 19, TypeScript 5.9 |
| 스타일 | Tailwind CSS v4 (설정 파일 없음, Vite 플러그인으로 통합) |
| 빌드 | Vite 7 |
| 백엔드 | Firebase 12 (Auth, Firestore, Storage, Analytics) |
| 차트 | Recharts 3 |
| 가져오기·내보내기 | PapaParse, SheetJS `xlsx` 0.20 (CDN tarball), pdfjs-dist |
| PWA | vite-plugin-pwa (workbox) |
| 테스트 | Vitest 5 + Testing Library (jsdom), Node 22 |

## 명령어

```bash
npm run dev       # 개발 서버
npm run test      # vitest run
npm run verify    # lint + test + 빌드 + 시작 번들 예산 검사 (CI와 동일, PR 전 필수)
```

## 프로젝트 구조

```
src/
├── App.tsx                  # 앱 전체 상태 + 탭 라우팅 + 모달 관리 (가장 큰 파일)
├── main.tsx
├── types/index.ts           # 도메인 인터페이스 + 카테고리 상수 + 색상/이모지 맵
├── types/navigation.ts      # Tab: home | transactions | analytics | memos | subscriptions | goals
├── firebase/firebase.ts     # Firebase 초기화 (Auth는 initializeAuth, Analytics는 load 이후 지연)
├── hooks/
│   ├── useAppHandlers.ts    # 거래·예산·정기내역·태그·설정 CRUD 핸들러 (App에서 사용)
│   ├── useAuthSync.ts       # 로그인 상태 + 로컬→Firebase 병합 + 하이드레이션
│   ├── useModalClose.ts     # 모달 포커스 트랩·Escape·스크롤 잠금 공통 훅
│   ├── usePWAInstall.ts / useUsageFlow.ts / useCountUp.ts
├── lib/                     # UI 없는 로직 (테스트는 같은 이름 .test.ts)
│   ├── storage.ts           # localStorage ↔ Firestore 추상화, 동기화·백업·복원
│   ├── backup.ts            # 백업 파일 검증
│   ├── format.ts            # fmt, fmtShort, fmtPrice, generateId + 날짜: parseYmdLocal, toLocalDateStr, toYearMonth, shiftYM
│   ├── recurringSchedule.ts # 정기 내역 도래 판정·회차 계산, 월 반복일까지 남은 일수
│   ├── cardBilling.ts       # 카드 청구월·결제일 계산
│   ├── budgets.ts           # 월별 유효 예산, 이월
│   ├── spendingRules.ts     # 지출 분석 기간·절감 제안 규칙
│   ├── bankParser.ts        # 은행 CSV/XLSX/PDF 파싱·컬럼 매핑
│   ├── importDuplicates.ts / importMappings.ts / autoCategoryRules.ts
│   ├── exportCsv.ts         # CSV/XLSX 내보내기 (수식 주입 방지)
│   ├── tags.ts              # 태그 이름 변경·삭제 시 설명의 #태그 동기화
│   ├── weeklyReview.ts / expenseBreakdown.ts / useMonthlyData.ts / chartTheme.ts
│   └── receiptStorage.ts / toast.ts / usageFlow.ts / pwaShortcuts.ts / categoryMigration.ts
├── components/
│   ├── workspaces/LedgerWorkspace.tsx  # 탭별 화면 컨테이너 (lazy 로드)
│   ├── charts/              # Recharts 차트 9개
│   ├── layout/              # BottomNavigation, ThemeToggle, WorkspaceSkeleton
│   ├── ui/                  # BrandMark, CategoryIcon, EmptyState, PaymentMethodIcon
│   ├── import/              # 가져오기 상세 모달
│   ├── Dashboard.tsx + HomeOverview.tsx   # 홈
│   ├── MonthlyDashboard.tsx # 월간 위젯 (요청 시 마운트)
│   ├── TransactionModal.tsx / TransactionList.tsx / TransactionDetailModal.tsx
│   ├── Analytics.tsx / SpendingAnalysisView.tsx / WeeklyReview.tsx
│   ├── MemoSection.tsx / SubscriptionView.tsx / GoalsView.tsx / CalendarView.tsx
│   └── ...Modal.tsx         # Budget, Category, Recurring, Import, Export, Backup, SyncConflict 등
└── test/                    # 테스트 setup·fixture
work-reports/                # PR별 작업 보고서 (README에 규칙과 목록)
docs/                        # 성능·백업·감사 등 설계/점검 문서
```

## 아키텍처 패턴

### 상태 관리
- **Redux/Zustand 없음** — App.tsx에서 useState로 중앙 관리 후 props drilling
- 변경 핸들러는 `useAppHandlers`에 모음. UI 표시 상태는 App의 `ui` reducer(`dispatchUI`)
- 계산 로직은 컴포넌트가 아니라 `lib/`의 순수 함수로 두고 테스트한다

### 이중 스토리지 (`lib/storage.ts`)
- **로컬 모드**: localStorage (키 prefix: `hb_*`)
- **Firebase 모드**: Firestore 단일 문서 `users/{uid}/app/default`, 키별 `versions`로 낙관적 잠금
- `setStorageContext(mode, uid)`로 모드 전환. Firebase 모드에서도 거래·메모 등은 로컬에 캐시
- 저장 실패 시 `hb_pending_sync`에 `{uid, keys, base}` 기록 → 다음 로드 때 실패한 키만 조건부 재전송
- 로그인 시 로컬 데이터 → Firebase 병합 확인 (`MergeLocalDataModal`), 로그아웃 시 Firebase 캐시 정리
- 보안 규칙: `firestore.rules`, `storage.rules` (배포는 수동)

### 컴포넌트 패턴
- **워크스페이스** 패턴: LedgerWorkspace가 탭 내 뷰 전체 담당, 무거운 화면은 `lazy`
- **모달 기반 폼**: 추가/수정은 바텀시트 모달, 포커스 관리는 `useModalClose`
- 시작 번들 예산: `scripts/measure-startup.mjs` (홈 250KB / 입력 280KB gzip, 차트·xlsx·pdf 즉시 로드 금지)

## 핵심 타입 (`src/types/index.ts`)

```ts
Transaction           // id, type(income|expense), amount, category, description, tags?, date(YYYY-MM-DD),
                      // paymentMethod?, paymentMethodId?, creditBillingDay?, loanPrincipal?/loanInterest?, createdAt
Budget                // category, limit, yearMonth?(월별 override), carryover?
RecurringTransaction  // frequency(monthly|weekly|biweekly), dayOfMonth, weekday?, lastAppliedMonth, lastAppliedDate?
Memo / Subscription / SavingsGoal / UserPaymentMethod / AutoCategoryRule / TransactionTemplate
AppSettings (lib/storage.ts)  // payday, cardBillingDay, userPaymentMethods, custom*Categories, templates, rules, hiddenWidgets
```

## 카테고리 상수 (`src/types/index.ts`)

```ts
INCOME_CATEGORIES   // ['급여', '부업', '용돈', '투자수익', '기타수입']
EXPENSE_CATEGORIES  // ['식비', '교통비', '주거비', '통신비', '의료비', '쇼핑', '문화/여가', '교육', '저축', '대출', '보험', '기타지출']
CATEGORY_COLOR      // Record<string, { bg: string; text: string }>
CATEGORY_EMOJI      // Record<string, string>
```

## 날짜 규칙

- 날짜는 `YYYY-MM-DD` 문자열. `new Date('YYYY-MM-DD')`는 UTC로 파싱되므로 금지 → `parseYmdLocal` 사용
- 오늘 날짜 문자열은 `toLocalDateStr()`, 연월은 `toYearMonth()`, 이전·다음 달은 `shiftYM(ym, n)` (직접 `m === 1 ? ...` 계산 금지). 일수 차이는 자정 기준 날짜끼리 계산
- 매월 반복일(월급일·결제일·정기 내역)은 말일 보정 필요 → `recurringSchedule.ts`의 헬퍼 사용

## UI 컨벤션

- **다크 테마 기본**, 라이트 모드는 `ThemeToggle`로 전환 (`:root[data-theme="light"]`, `src/interface.css`)
  - 첫 페인트 전 테마는 `index.html`의 `theme-init` 스크립트가 적용 (ThemeToggle 초기값 규칙과 동일하게 유지)
- 색상은 CSS 변수(`var(--surface)`, `var(--muted)`, `var(--accent)`, `var(--category-*)` 등) 사용. hex 뒤에 알파를 붙이는 `${color}25` 대신 `color-mix(in srgb, ${color} 15%, transparent)` 사용
- **Tailwind 색상은 테마 토큰 클래스 사용** (`src/index.css`의 `@theme`, 값은 `interface.css`):
  - 의미: `bg-page` `bg-surface` `bg-raised` `text-fg` `text-muted` `text-accent` `text-income` `text-expense` `text-warning` `border-line`
  - 틴트·테두리·링: `bg-tone-blue/15` `border-tone-red/20` `ring-tone-green/40` 등 (`tone-blue|red|green|amber|teal|slate`, 두 테마 모두 원래 밝은 색)
  - 중립·연한 글자: `hover:bg-tone-hover` `hover:text-tone-gray` `to-tone-chip` `text-tone-faint` `text-fg-strong` `text-tone-*-pale|soft`
  - hex 클래스(`bg-[#1C1C1E]` 등)는 쓰지 말 것. 토큰으로 옮긴 파일은 ESLint가 막는다. 기존 파일 치환: `node scripts/migrate-theme-tokens.mjs <파일>`
- **배경 팔레트**: `#111111` (앱 배경), `#1C1C1E` (카드), `#2C2C2E` (입력/칩)
- **강조색**: `#3D8EF8` (파랑/기본), `#2ACF6A` (수입), `#F25260` (지출)
- **텍스트**: `#F1F3F6` (기본), `#8B95A1` (보조), `#4E5968` (비활성)
- **모서리**: `rounded-2xl` (컴포넌트), `rounded-3xl` (카드), `rounded-[28px]` (바텀시트)
- **숫자 폰트**: `num` 클래스 적용
- **폰트**: Pretendard Variable dynamic subset (CDN, 비차단 로드)
- 한국어 UI

## 작업 흐름

- 주제 묶음마다 브랜치 → PR → CI(`Verify`) 통과 → squash merge
- PR마다 `work-reports/`에 보고서를 추가하고 `work-reports/README.md` 목록에 한 줄 추가
- 커밋 메시지: 제목 한 줄 + "왜 / 무엇을 / 검증" 짧은 섹션

## 하지 말 것

- 새 상태관리 라이브러리(Redux, Zustand 등) 추가 금지
- 새 색상을 하드코딩할 때 라이트 테마 값(`:root[data-theme="light"]`)도 함께 정의할 것
- Tailwind config 파일 생성 금지 (v4는 설정 파일 불필요)
- 태그는 `tags` 필드로 읽는다. 저장 시 설명의 `#태그`에서 만들어지므로, 태그를 바꿀 때는 `lib/tags.ts` 헬퍼로 설명과 함께 바꿀 것
- `getAuth()` 대신 `firebase/firebase.ts`의 `auth` 사용 (시작 시 로그인 iframe 로드 방지)
