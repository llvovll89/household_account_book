import { expect, it } from 'vitest'
import type { Loan, Transaction } from '../types'
import { getLoanStatuses } from './loans'

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
