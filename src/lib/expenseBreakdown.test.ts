import { expect, it } from 'vitest'
import { summarizeExpenses } from './expenseBreakdown'
import type { Transaction } from '../types'

const tx = (category: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: category, type: 'expense', category, amount, date: '2026-10-01', description: '', createdAt: 1, ...extra })
it('separates consumption, savings and loans without changing the cash outflow', () => {
  const records = [tx('식비', 30), tx('보험', 20), tx('저축', 100), tx('대출', 220, { loanPrincipal: 200, loanInterest: 20 }), tx('대출', 50), tx('급여', 500, { type: 'income' })]
  const before = JSON.stringify(records)
  expect(summarizeExpenses(records)).toEqual({ all: 420, consumption: 50, savings: 100, loan: 270, principal: 200, interest: 20, unsplit: 50 })
  expect(JSON.stringify(records)).toBe(before)
})
it('does not invent a split for legacy or inconsistent loan records', () => {
  expect(summarizeExpenses([tx('대출', 100, { loanPrincipal: 70, loanInterest: 20 })])).toMatchObject({ loan: 100, unsplit: 100, principal: 0, interest: 0 })
})
