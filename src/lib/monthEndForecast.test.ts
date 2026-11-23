import { describe, expect, it } from 'vitest'
import type { RecurringTransaction, Transaction } from '../types'
import { forecastMonthEndExpense } from './monthEndForecast'

const tx = (id: string, amount: number, date: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, type: 'expense', amount, category: '식비', description: '', date, createdAt: 1, ...extra })
const rent: RecurringTransaction = { id: 'rent', type: 'expense', category: '주거비', amount: 500000, description: '월세', dayOfMonth: 1, lastAppliedMonth: '2026-11', createdAt: 1 }

describe('forecastMonthEndExpense', () => {
  it('does not stretch an already recorded rent over the whole month', () => {
    // 11/10까지 월세 50만 + 식비 10만(하루 1만)
    const txs = [tx('r', 500000, '2026-11-01', { category: '주거비', description: '월세' }), tx('f', 100000, '2026-11-05')]
    const f = forecastMonthEndExpense(txs, [rent], '2026-11', new Date(2026, 10, 10))
    expect(f.scheduledRemaining).toBe(0)
    expect(f.variableRemaining).toBe(200000) // 1만 × 남은 20일
    expect(f.projected).toBe(800000)
  })

  it('adds monthly items not yet recorded and the remaining weekly occurrences', () => {
    const insurance: RecurringTransaction = { id: 'ins', type: 'expense', category: '보험', amount: 80000, description: '보험료', dayOfMonth: 25, lastAppliedMonth: '2026-10', createdAt: 1 }
    // 토요일 레슨, 11/7까지 적용 → 11/14·21·28 남음
    const lesson: RecurringTransaction = { id: 'w', type: 'expense', category: '교육', amount: 30000, description: '레슨', dayOfMonth: 1, frequency: 'weekly', weekday: 6, lastAppliedMonth: '', lastAppliedDate: '2026-11-07', createdAt: 1 }
    const salary: RecurringTransaction = { id: 's', type: 'income', category: '급여', amount: 3000000, description: '', dayOfMonth: 25, lastAppliedMonth: '2026-10', createdAt: 1 }
    const f = forecastMonthEndExpense([tx('f', 100000, '2026-11-10')], [insurance, lesson, salary], '2026-11', new Date(2026, 10, 10))
    expect(f.scheduledRemaining).toBe(80000 + 30000 * 3)
    expect(f.projected).toBe(100000 + 170000 + 200000)
  })
})
