import type { RecurringTransaction, Transaction } from '../types'
import { generateId, toLocalDateStr } from './format'

export function createRecurringItem(draft: Omit<RecurringTransaction, 'id' | 'createdAt'>): RecurringTransaction {
  return { ...draft, id: generateId(), createdAt: Date.now() }
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

type ScheduleFields = Pick<RecurringTransaction, 'frequency' | 'dayOfMonth' | 'weekday'>
type DueCheckFields = Pick<RecurringTransaction, 'frequency' | 'dayOfMonth' | 'weekday' | 'lastAppliedMonth' | 'lastAppliedDate'>

/** 정기 항목의 반복 주기를 사람이 읽는 문구로 변환 (예: "매월 15일", "매주 화요일") */
export function formatRecurringSchedule(r: ScheduleFields): string {
  if (r.frequency === 'weekly') return `매주 ${WEEKDAY_LABELS[r.weekday ?? 0]}요일`
  if (r.frequency === 'biweekly') return `격주 ${WEEKDAY_LABELS[r.weekday ?? 0]}요일`
  return `매월 ${r.dayOfMonth}일`
}

/** 해당 월의 실제 일수를 넘는 dayOfMonth를 그 달의 마지막 날로 클램프한다 (예: 2월 31일 → 28/29일) */
function clampDayToMonth(today: Date, day: number): number {
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return Math.min(day, lastDay)
}

function isWeeklyFrequency(r: Pick<RecurringTransaction, 'frequency'>): boolean {
  return r.frequency === 'weekly' || r.frequency === 'biweekly'
}

/**
 * 주간·격주 항목에서 마지막 적용 이후 오늘까지 도래한 회차 날짜를 반환한다.
 * 해당 요일에 앱을 열지 않아 놓친 회차도 실제 발생일로 따라잡는다.
 */
export function getDueRecurringDates(r: DueCheckFields, today: Date): string[] {
  if (!isWeeklyFrequency(r)) return []
  const weekday = r.weekday ?? 0
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!r.lastAppliedDate) return end.getDay() === weekday ? [toLocalDateStr(end)] : []

  const period = r.frequency === 'weekly' ? 7 : 14
  const [y, m, d] = r.lastAppliedDate.split('-').map(Number)
  // 마지막 적용일 + 주기 이후 첫 해당 요일부터 (요일을 바꾼 경우에도 맞춰진다)
  const next = new Date(y, m - 1, d + period)
  next.setDate(next.getDate() + ((weekday - next.getDay() + 7) % 7))

  const dates: string[] = []
  while (next <= end) {
    dates.push(toLocalDateStr(next))
    next.setDate(next.getDate() + period)
  }
  return dates
}

/** 오늘 기준으로 이 정기 항목을 자동 적용해야 하는지 판정한다 */
export function isRecurringDueToday(r: DueCheckFields, today: Date, todayYM: string): boolean {
  if (isWeeklyFrequency(r)) return getDueRecurringDates(r, today).length > 0
  return r.lastAppliedMonth !== todayYM && clampDayToMonth(today, r.dayOfMonth) <= today.getDate()
}

/** 보고 있는 달에 월간 항목이 아직 적용되지 않았는지 판정한다 (이후 달에 적용됐으면 이미 처리된 것으로 본다) */
export function isRecurringPendingForMonth(r: Pick<RecurringTransaction, 'frequency' | 'lastAppliedMonth'>, yearMonth: string): boolean {
  if (isWeeklyFrequency(r)) return false
  return (r.lastAppliedMonth ?? '') < yearMonth
}

/**
 * 매월 반복되는 날(월급일·결제일)까지 남은 일수. 오늘이면 0.
 * 현재 시각과 무관하게 날짜 단위로 세고, 없는 날짜(31일 → 30일·2월)는 말일로 보정한다.
 */
export function getDaysUntilMonthDay(day: number | 'last', today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const occurrence = (monthOffset: number) => {
    const first = new Date(start.getFullYear(), start.getMonth() + monthOffset, 1)
    return new Date(first.getFullYear(), first.getMonth(), clampDayToMonth(first, day === 'last' ? 31 : day))
  }
  let next = occurrence(0)
  if (next < start) next = occurrence(1)
  return Math.round((next.getTime() - start.getTime()) / 86_400_000)
}

/** 월말 반복 내역을 실제 존재하는 날짜로 변환한다. */
export function getRecurringDate(yearMonth: string, dayOfMonth: number): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const day = clampDayToMonth(new Date(year, month - 1, 1), dayOfMonth)
  return `${yearMonth}-${String(day).padStart(2, '0')}`
}

export function createRecurringTransaction(r: RecurringTransaction, yearMonth: string, today: string, id: string): Transaction {
  return {
    id, type: r.type, amount: r.amount, category: r.category, description: r.description,
    paymentMethod: r.paymentMethod ?? 'cash',
    ...(r.paymentMethodId ? { paymentMethodId: r.paymentMethodId } : {}),
    ...(r.creditBillingDay ? { creditBillingDay: r.creditBillingDay } : {}),
    date: r.frequency === 'weekly' || r.frequency === 'biweekly' ? today : getRecurringDate(yearMonth, r.dayOfMonth),
    createdAt: Date.now(),
  }
}
