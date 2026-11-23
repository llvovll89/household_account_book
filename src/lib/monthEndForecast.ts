import type { RecurringTransaction, Transaction } from '../types'
import { toLocalDateStr } from './format'
import { getDueRecurringDates, isRecurringPendingForMonth } from './recurringSchedule'

export interface MonthEndForecast {
  /** 월말까지 예상되는 이번 달 총지출 */
  projected: number
  /** 아직 기록되지 않은 정기 지출 */
  scheduledRemaining: number
  /** 정기 지출을 뺀 일상 지출의 하루 평균으로 추정한 남은 기간 지출 */
  variableRemaining: number
}

// 정기 내역으로 등록된 거래는 표시가 없으므로 같은 카테고리·금액·설명으로 알아본다
function isFromRecurring(t: Transaction, recurring: RecurringTransaction[]): boolean {
  return recurring.some((r) => r.type === 'expense' && r.category === t.category && r.amount === t.amount && r.description === t.description)
}

// 주간·격주 항목이 이번 달 남은 기간(미적용 회차 포함)에 몇 번 나오는지
function remainingWeeklyDates(r: RecurringTransaction, today: Date, monthEnd: Date, yearMonth: string): string[] {
  if (r.lastAppliedDate) {
    return getDueRecurringDates(r, monthEnd).filter((d) => d.startsWith(yearMonth))
  }
  // 아직 한 번도 적용하지 않았으면 오늘부터 해당 요일을 센다
  const period = r.frequency === 'weekly' ? 7 : 14
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  next.setDate(next.getDate() + (((r.weekday ?? 0) - next.getDay() + 7) % 7))
  const dates: string[] = []
  while (next <= monthEnd) {
    dates.push(toLocalDateStr(next))
    next.setDate(next.getDate() + period)
  }
  return dates
}

/**
 * 이번 달 월말 지출을 예측한다.
 * 지금까지 쓴 금액 + 아직 등록되지 않은 정기 지출 + 정기 지출을 뺀 일상 지출 추세로 계산한다.
 * 단순히 (지출 ÷ 지난 일수 × 월 일수)로 늘리면 월초 월세·보험료가 한 달 내내 반복되는 것처럼 부풀려진다.
 */
export function forecastMonthEndExpense(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  yearMonth: string,
  today: Date,
): MonthEndForecast {
  const [y, m] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const daysElapsed = Math.min(daysInMonth, Math.max(1, today.getDate()))
  const todayStr = toLocalDateStr(today)
  const monthEnd = new Date(y, m - 1, daysInMonth)

  let spent = 0
  let variableSoFar = 0
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.date.startsWith(yearMonth)) continue
    spent += t.amount
    if (t.date <= todayStr && !isFromRecurring(t, recurring)) variableSoFar += t.amount
  }

  let scheduledRemaining = 0
  for (const r of recurring) {
    if (r.type !== 'expense') continue
    if (r.frequency === 'weekly' || r.frequency === 'biweekly') {
      scheduledRemaining += r.amount * remainingWeeklyDates(r, today, monthEnd, yearMonth).length
    } else if (isRecurringPendingForMonth(r, yearMonth)) {
      scheduledRemaining += r.amount
    }
  }

  const variableRemaining = Math.round((variableSoFar / daysElapsed) * (daysInMonth - daysElapsed))
  return { projected: spent + scheduledRemaining + variableRemaining, scheduledRemaining, variableRemaining }
}
