# 기술부채 감사 (2026-11-09)

같은 날 수정한 동기화·도메인·가져오기 버그(#27~#30)와 성능 작업(#31, #33)은 제외했습니다.
점수는 **(영향 + 위험) × (6 − 노력)**이고, 각 항목은 1~5점입니다.

| 순위 | 항목 | 분류 | 근거 | 영향/위험/노력 | 점수 | 상태 |
|---|---|---|---|---|---|---|
| 1 | 날짜 헬퍼 중복 | 코드 | `getYearMonth` 2벌(`App.tsx`, `ExportModal.tsx`), `toYmd` 2벌(`CalendarDatePicker`, `spendingRules`), 월 계산 헬퍼가 `cardBilling` 안에 비공개. 같은 날 고친 D-day·말일 보정 버그 3건이 모두 복사된 날짜 로직에서 나옴 | 3/4/2 | 28 | Phase 1 |
| 2 | CLAUDE.md·문서 노후화 | 문서 | 존재하지 않는 `useTransactions.ts`를 핵심 훅으로 소개, 실제와 다른 구조, 루트에 흩어진 감사·리뷰 문서 6개 | 3/2/1 | 25 | Phase 1 |
| 3 | 거대 컴포넌트에 테스트 0개 | 테스트 | `Analytics` 2,895줄, `MonthlyDashboard` 2,120줄, `GoalsView` 1,117줄, `MemoSection` 1,047줄, `SpendingAnalysisView` 806줄 | 3/4/3 | 21 | Phase 2 |
| 4 | 시작 시 테마 깜빡임 | 코드 | `data-theme`이 인증 이후 마운트되는 `ThemeToggle`에서만 설정되어, 로딩 화면은 항상 다크 | 2/2/1 | 20 | Phase 1 (#34) |
| 5 | 라이트 테마 색상 체계 | 코드 | `.tsx` 안 hex 하드코딩 2,202회. Tailwind 임의값 색상 클래스 190종 중 테마 토큰에 연결된 것은 25종, 165종 미연결 (예: `bg-[#3D8EF8]/20` 24회, `hover:bg-[#3A3A3C]` 22회) | 4/4/4 | 16 | Phase 2 |
| 6 | App.tsx 비대화 | 아키텍처 | 2,728줄, `useState` 53개, `useEffect` 15개, `LedgerWorkspace` props 37개 | 5/3/4 | 16 | Phase 3 |
| 7 | 메이저 버전 지연 | 의존성 | vitest 3→5(dev 의존성에 critical 경고), vite 7→8, vite-plugin-pwa 1→2, TS 5.9→7, eslint 9→10, firebase 12→13 | 2/3/3 | 15 | Phase 2 |
| 8 | Firestore 즉시 로드 | 아키텍처 | 첫 화면 `vendor-firebase` 112KB 중 90KB 미사용, 로그아웃 사용자에게 불필요 | 2/2/3 | 12 | Phase 3 |

**양호한 부분:** `any`·`@ts-ignore` 0개, `eslint-disable` 1개, TODO 0개.

**측정 한계:** 5번은 정적 분석 결과입니다. 라이트 모드의 실제 화면은 페이지별로 눈으로 확인해야 합니다.

## 단계별 계획

- **Phase 1 (빠른 효과):** 1번 날짜 헬퍼 통합, 2번 문서 정리, 4번 테마 깜빡임
- **Phase 2 (기능 작업과 병행):** 7번 vitest 업그레이드, 5번 의미 토큰 도입 후 파일 단위 치환, 3번 계산 로직의 `lib/` 분리와 테스트
- **Phase 3 (구조 개선):** 6번 App.tsx 기능별 훅 분리, 8번 Firestore 지연 로드
