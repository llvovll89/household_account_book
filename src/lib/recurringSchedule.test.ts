import { describe, expect, it } from 'vitest'
import { formatRecurringSchedule, isRecurringDueToday, getRecurringDate, createRecurringTransaction, getDueRecurringDates, isRecurringPendingForMonth, getDaysUntilMonthDay } from './recurringSchedule'

it('preserves transfer account details when applying a recurring payment and defaults old records to cash', () => {
  const legacy = { id: 'r', type: 'expense' as const, category: '보험', amount: 1000, description: '보험료', dayOfMonth: 31, lastAppliedMonth: '', createdAt: 1 }
  const result = createRecurringTransaction({ ...legacy, paymentMethod: 'transfer', paymentMethodId: 'bank' }, '2026-02', '2026-02-28', 'new')
  expect(result).toMatchObject({ paymentMethod: 'transfer', paymentMethodId: 'bank', date: '2026-02-28', amount: 1000 })
  expect(createRecurringTransaction(legacy, '2026-02', '2026-02-28', 'old')).toMatchObject({ paymentMethod: 'cash' })
  expect(Object.values(result)).not.toContain(undefined)
})

describe('formatRecurringSchedule', () => {
  it('frequency가 없으면 매월 며칠로 표기한다', () => {
    expect(formatRecurringSchedule({ dayOfMonth: 15 })).toBe('매월 15일')
  })

  it('weekly는 매주 요일로 표기한다', () => {
    expect(formatRecurringSchedule({ frequency: 'weekly', dayOfMonth: 1, weekday: 2 })).toBe('매주 화요일')
  })

  it('biweekly는 격주 요일로 표기한다', () => {
    expect(formatRecurringSchedule({ frequency: 'biweekly', dayOfMonth: 1, weekday: 5 })).toBe('격주 금요일')
  })
})

describe('isRecurringDueToday', () => {
  it('monthly: 이번 달에 아직 적용 안 됐고 dayOfMonth가 지났으면 true', () => {
    const r = { dayOfMonth: 10, lastAppliedMonth: '2026-07' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(true)
  })

  it('monthly: 이미 이번 달에 적용됐으면 false', () => {
    const r = { dayOfMonth: 10, lastAppliedMonth: '2026-08' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(false)
  })

  it('monthly: dayOfMonth가 아직 안 지났으면 false', () => {
    const r = { dayOfMonth: 20, lastAppliedMonth: '2026-07' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(false)
  })

  it('weekly: 요일이 다르면 false', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 2, lastAppliedMonth: '', lastAppliedDate: undefined }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(false) // 2026-08-15는 토요일
  })

  it('weekly: 요일이 맞고 한 번도 적용 안 됐으면 true', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: undefined }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(true) // 2026-08-15는 토요일
  })

  it('weekly: 요일이 맞아도 7일이 안 지났으면 false', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-08-12' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(false)
  })

  it('weekly: 7일이 지났으면 true', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-08-08' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(true)
  })

  it('biweekly: 7일만 지났으면 아직 false', () => {
    const r = { frequency: 'biweekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-08-08' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(false)
  })

  it('biweekly: 14일이 지났으면 true', () => {
    const r = { frequency: 'biweekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-08-01' }
    expect(isRecurringDueToday(r, new Date(2026, 7, 15), '2026-08')).toBe(true)
  })

  it('monthly: dayOfMonth가 31일이고 2월(28일까지)이면 2월 마지막 날에 적용된다', () => {
    const r = { dayOfMonth: 31, lastAppliedMonth: '2026-01' }
    // 2026년은 평년 → 2월은 28일까지
    expect(isRecurringDueToday(r, new Date(2026, 1, 28), '2026-02')).toBe(true)
  })

  it('monthly: dayOfMonth가 31일이고 2월 마지막 날 이전이면 아직 false', () => {
    const r = { dayOfMonth: 31, lastAppliedMonth: '2026-01' }
    expect(isRecurringDueToday(r, new Date(2026, 1, 27), '2026-02')).toBe(false)
  })

  it('monthly: dayOfMonth가 31일이고 30일짜리 달(4월)이면 30일에 적용된다', () => {
    const r = { dayOfMonth: 31, lastAppliedMonth: '2026-03' }
    expect(isRecurringDueToday(r, new Date(2026, 3, 30), '2026-04')).toBe(true)
  })
})

describe('getRecurringDate', () => {
  it.each([
    ['2026-02', 31, '2026-02-28'],
    ['2028-02', 31, '2028-02-29'],
    ['2026-04', 31, '2026-04-30'],
    ['2026-12', 15, '2026-12-15'],
  ])('clamps %s day %i to %s', (month, day, expected) => {
    expect(getRecurringDate(month, day)).toBe(expected)
  })
})

describe('getDueRecurringDates (놓친 주간 회차 따라잡기)', () => {
  it('weekly: 해당 요일에 앱을 열지 않았어도 놓친 회차를 모두 반환한다', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-08-01' }
    const thursday = new Date(2026, 7, 20)
    expect(getDueRecurringDates(r, thursday)).toEqual(['2026-08-08', '2026-08-15'])
    expect(isRecurringDueToday(r, thursday, '2026-08')).toBe(true)
  })

  it('biweekly: 14일 간격으로 놓친 회차를 반환한다', () => {
    const r = { frequency: 'biweekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-07-18' }
    expect(getDueRecurringDates(r, new Date(2026, 7, 20))).toEqual(['2026-08-01', '2026-08-15'])
  })

  it('weekly: 요일을 바꾼 뒤에는 바뀐 요일 기준으로 다음 회차를 잡는다', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 1, lastAppliedMonth: '', lastAppliedDate: '2026-08-08' }
    expect(getDueRecurringDates(r, new Date(2026, 7, 20))).toEqual(['2026-08-17'])
  })

  it('weekly: 적용 이력이 없으면 해당 요일 당일에만 오늘 날짜를 반환한다', () => {
    const r = { frequency: 'weekly' as const, dayOfMonth: 1, weekday: 6, lastAppliedMonth: '', lastAppliedDate: '' }
    expect(getDueRecurringDates(r, new Date(2026, 7, 15))).toEqual(['2026-08-15'])
    expect(getDueRecurringDates(r, new Date(2026, 7, 14))).toEqual([])
  })
})

describe('isRecurringPendingForMonth', () => {
  it('보고 있는 달보다 이후 달에 이미 적용됐으면 미적용으로 보지 않는다', () => {
    expect(isRecurringPendingForMonth({ lastAppliedMonth: '2026-11' }, '2026-10')).toBe(false)
    expect(isRecurringPendingForMonth({ lastAppliedMonth: '2026-11' }, '2026-11')).toBe(false)
    expect(isRecurringPendingForMonth({ lastAppliedMonth: '2026-10' }, '2026-11')).toBe(true)
    expect(isRecurringPendingForMonth({ lastAppliedMonth: '' }, '2026-11')).toBe(true)
  })

  it('주간·격주 항목은 월 단위 미적용 목록에 넣지 않는다', () => {
    expect(isRecurringPendingForMonth({ frequency: 'weekly', lastAppliedMonth: '' }, '2026-11')).toBe(false)
  })
})

describe('getDaysUntilMonthDay', () => {
  it('counts whole days regardless of the current time of day', () => {
    expect(getDaysUntilMonthDay(5, new Date(2026, 10, 9, 9))).toBe(26)
    expect(getDaysUntilMonthDay(5, new Date(2026, 10, 9, 15))).toBe(26)
  })

  it('clamps a day that does not exist in this or next month', () => {
    expect(getDaysUntilMonthDay(31, new Date(2026, 10, 9))).toBe(21) // 11/30
    expect(getDaysUntilMonthDay(30, new Date(2026, 1, 10))).toBe(18) // 2/28
    expect(getDaysUntilMonthDay(30, new Date(2026, 0, 31))).toBe(28) // 2/28
  })

  it('returns 0 on the day and supports the last day of month', () => {
    expect(getDaysUntilMonthDay(9, new Date(2026, 10, 9, 23))).toBe(0)
    expect(getDaysUntilMonthDay('last', new Date(2026, 10, 9))).toBe(21)
  })
})
