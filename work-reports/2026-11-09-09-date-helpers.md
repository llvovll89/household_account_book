# 날짜 헬퍼 통합

- 날짜: 2026-11-09
- PR: #36

## 한 줄 요약
여러 파일에 복사돼 있던 "연월 만들기"와 "이전·다음 달 계산"을 `lib/format.ts`의 함수 두 개로 모았습니다. 동작은 바뀌지 않습니다.

## 왜 했나
- 기술부채 감사 1번 항목입니다(우선순위 1위).
- 같은 날 고친 월급날 D-day, 구독 결제일, 말일 보정 버그 3건은 모두 **복사된 날짜 계산 코드**에서 나왔습니다. 한 곳을 고쳐도 다른 복사본은 그대로 남는 구조였습니다.
- 정리 전 상태:
  - `getYearMonth`가 `App.tsx`와 `ExportModal.tsx`에 따로 있었습니다.
  - `toYmd`가 `CalendarDatePicker.tsx`와 `spendingRules.ts`에 따로 있었는데, 이미 있는 `toLocalDateStr`과 같은 함수입니다.
  - 이전·다음 달 계산(`m === 1 ? ... : ...`)이 `Analytics`, `MonthlyDashboard`, `budgets`, `cardBilling`에 6벌 복사돼 있었습니다.
  - `shiftYM`이 `cardBilling.ts`에 있어서, 예산·분석 코드가 카드 청구 모듈에 의존하고 있었습니다.

## 무엇을 바꿨나
- `lib/format.ts`에 `toYearMonth(date)`(로컬 기준 YYYY-MM)를 추가하고, `shiftYM(ym, n)`(n개월 이동, 연도 넘김 처리)을 옮겼습니다. 날짜 함수는 `parseYmdLocal`, `toLocalDateStr`과 함께 한 파일에 있습니다.
- 위 복사본을 모두 이 함수로 바꾸고 중복 정의를 지웠습니다.
- 날짜 단위 문자열 조립(`${yearMonth}-${dd}`)이나 시간 표시처럼 다른 목적의 코드는 손대지 않았습니다.

## 확인한 방법
- `toYearMonth`와 `shiftYM`에 연도 넘김(1월→작년 12월, 12월→내년 1월, 14개월 이전) 테스트를 추가했습니다.
- 기존 카드·예산·분석 테스트를 그대로 통과합니다.
- 정리 후 중복 정의 0개, 연도를 넘기는 인라인 계산 0개를 검색으로 확인했습니다.
- `npm run verify`를 통과했습니다(테스트 258개).

## 남은 일·주의
- 새로 날짜 계산이 필요하면 `lib/format.ts`의 함수를 쓰세요(`CLAUDE.md`의 날짜 규칙 참고).
- `Analytics.tsx`의 `getYM(year, month)`는 숫자에서 문자열을 만드는 다른 용도라 남겼습니다.
