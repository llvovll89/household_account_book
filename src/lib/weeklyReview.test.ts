import { expect, it } from 'vitest'
import type { Transaction } from '../types'
import { getDaysSinceLastRecord, getWeeklyReview } from './weeklyReview'

const entry = (date: string, amount = 1000, type: 'income' | 'expense' = 'expense'): Transaction => ({ id: date, type, category: '식비', amount, date, description: '', createdAt: 1 })

it('compares Monday through today with the same elapsed weekdays across month and year boundaries', () => {
  const review = getWeeklyReview([
    entry('2025-12-29', 2000), entry('2026-01-02', 3000), entry('2026-01-02', 50000, 'income'),
    entry('2025-12-22', 1000), entry('2025-12-26', 2000), entry('2025-12-28', 99000), entry('2026-01-03', 99000),
  ], new Date(2026, 0, 2, 23, 30))
  expect(review).toMatchObject({ start: '2025-12-29', end: '2026-01-02', previousStart: '2025-12-22', previousEnd: '2025-12-26', expense: 5000, previousExpense: 3000, count: 3, recordedDays: 2, canCompare: true, topCategory: { category: '식비', amount: 5000 } })
})

it('handles Monday and Sunday without including the previous full week or future dates', () => {
  expect(getWeeklyReview([entry('2026-10-19', 1000), entry('2026-10-20', 9000)], new Date(2026, 9, 19))).toMatchObject({ count: 1, expense: 1000, previousEnd: '2026-10-12' })
  expect(getWeeklyReview([], new Date(2026, 9, 25))).toMatchObject({ start: '2026-10-19', recordedDays: 0, canCompare: false, topCategory: null })
})

it('uses calendar dates for return gaps and ignores scheduled future records', () => {
  const now = new Date(2026, 0, 2, 23, 59)
  expect(getDaysSinceLastRecord([entry('2025-12-29'), entry('2026-01-20')], now)).toBe(4)
  expect(getDaysSinceLastRecord([entry('2026-01-02')], now)).toBe(0)
  expect(getDaysSinceLastRecord([], now)).toBeNull()
  expect(getDaysSinceLastRecord([entry('2026-01-20')], now)).toBeNull()
})
