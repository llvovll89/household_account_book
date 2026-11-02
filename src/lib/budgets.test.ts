import { expect, it } from 'vitest'
import { getEffectiveBudgets, getBudgetProgress } from './budgets'
import type { Transaction } from '../types'

it('replaces only the selected month category and preserves other default budgets', () => {
  const food = { category: '식비', limit: 100 }
  const travel = { category: '교통비', limit: 50 }
  const override = { category: '식비', limit: 200, yearMonth: '2026-09' }
  const otherMonth = { category: '교통비', limit: 500, yearMonth: '2026-10' }
  expect(getEffectiveBudgets([food, travel, override, otherMonth], '2026-09')).toEqual([override, travel])
  expect(getEffectiveBudgets([food, travel, override, otherMonth], '2026-08')).toEqual([food, travel])
})

const expense: Transaction = { id: 'a', category: '식비', type: 'expense', amount: 60, date: '2025-12-12', description: '', createdAt: 1 }

it('uses the source month allowance and toggle across a year boundary', () => {
  const budgets = [{ category: '식비', limit: 100, carryover: true }, { category: '식비', limit: 200, carryover: false, yearMonth: '2026-01' }]
  expect(getBudgetProgress(budgets, [expense], '2026-01')[0]).toMatchObject({ effectiveLimit: 240, carryoverAmount: 40, remaining: 240 })
  expect(getBudgetProgress(budgets, [expense], '2026-02')[0].carryoverAmount).toBe(0)
})

it('does not invent previous budgets, carry deficits, or count income as spending', () => {
  const budgets = [{ category: '식비', limit: 50, carryover: true, yearMonth: '2026-01' }]
  expect(getBudgetProgress(budgets, [], '2026-01')[0].carryoverAmount).toBe(0)
  const base = [{ category: '식비', limit: 50, carryover: true }]
  expect(getBudgetProgress(base, [expense], '2026-01')[0].carryoverAmount).toBe(0)
  expect(getBudgetProgress(base, [{ ...expense, type: 'income' }], '2026-01')[0].carryoverAmount).toBe(50)
})

it('carries only one month and scopes spending to the selected category and month', () => {
  const budgets = [{ category: '식비', limit: 100, carryover: true }]
  const transactions = [expense, { ...expense, id: 'b', date: '2026-01-02', amount: 30 }, { ...expense, id: 'c', category: '교통비', date: '2026-01-02' }]
  expect(getBudgetProgress(budgets, transactions, '2026-01')[0]).toMatchObject({ spent: 30, remaining: 110 })
  expect(getBudgetProgress(budgets, transactions, '2026-02')[0].effectiveLimit).toBe(170)
})
