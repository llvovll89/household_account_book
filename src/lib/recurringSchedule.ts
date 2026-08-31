import type { RecurringTransaction } from '../types'

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

/** 오늘 기준으로 이 정기 항목을 자동 적용해야 하는지 판정한다 */
export function isRecurringDueToday(r: DueCheckFields, today: Date, todayYM: string): boolean {
  if (r.frequency === 'weekly' || r.frequency === 'biweekly') {
    if (today.getDay() !== (r.weekday ?? 0)) return false
    if (!r.lastAppliedDate) return true
    const last = new Date(`${r.lastAppliedDate}T00:00:00`)
    const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000)
    const period = r.frequency === 'weekly' ? 7 : 14
    return diffDays >= period
  }
  return r.lastAppliedMonth !== todayYM && clampDayToMonth(today, r.dayOfMonth) <= today.getDate()
}
