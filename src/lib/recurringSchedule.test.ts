import { describe, expect, it } from 'vitest'
import { formatRecurringSchedule, isRecurringDueToday } from './recurringSchedule'

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
