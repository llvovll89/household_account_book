import { describe, expect, it } from 'vitest'
import type { Loan, Transaction } from '../types'
import { estimateMonthlyPayment, getLoanStatuses, projectPayoff } from './loans'

const loan: Loan = { id: 'home', name: '전세대출', balance: 1_000_000, balanceAsOf: '2026-10-31', createdAt: 1 }
const pay = (id: string, date: string, extra: Partial<Transaction>): Transaction =>
  ({ id, type: 'expense', category: '대출', description: '', amount: 300_000, date, createdAt: 1, loanId: 'home', ...extra })

it('subtracts only the principal of linked repayments made after the as-of date', () => {
  const [status] = getLoanStatuses([loan], [
    pay('before', '2026-10-25', {}),
    pay('split', '2026-11-25', { loanPrincipal: 250_000, loanInterest: 50_000 }),
    pay('whole', '2026-12-25', {}),
    pay('other', '2026-11-26', { loanId: 'car' }),
    pay('income', '2026-11-27', { type: 'income' }),
  ])
  expect(status.repaid).toBe(550_000)
  expect(status.remaining).toBe(450_000)
})

it('never reports a negative remaining principal', () => {
  const [status] = getLoanStatuses([loan], [pay('big', '2026-11-25', { amount: 2_000_000 })])
  expect(status.remaining).toBe(0)
})

it('restores repayments made after a past date', () => {
  const [status] = getLoanStatuses([loan], [pay('oct', '2026-10-25', {}), pay('nov', '2026-11-25', {})], '2026-10-20')
  expect(status.remaining).toBe(1_300_000)
})

describe('projectPayoff', () => {
  it('pays off without interest in remaining / payment months', () => {
    expect(projectPayoff(1_000_000, 0, 300_000, '2026-11')).toEqual({ months: 4, payoffYM: '2027-03', totalInterest: 0 })
  })

  it('adds monthly interest on the remaining principal', () => {
    const p = projectPayoff(10_000_000, 6, 500_000, '2026-11')!
    expect(p.months).toBe(22)
    expect(p.totalInterest).toBeGreaterThan(500_000)
    expect(p.totalInterest).toBeLessThan(600_000)
  })

  it('returns null when the payment does not cover interest', () => {
    expect(projectPayoff(100_000_000, 12, 1_000_000, '2026-11')).toBeNull()
  })
})

it('estimateMonthlyPayment averages the last three full months of linked repayments', () => {
  const txs = [pay('a', '2026-08-25', {}), pay('b', '2026-09-25', {}), pay('c', '2026-10-25', {}), pay('now', '2026-11-25', {})]
  expect(estimateMonthlyPayment('home', txs, '2026-11')).toBe(300_000)
  expect(estimateMonthlyPayment('none', txs, '2026-11')).toBeNull()
})
