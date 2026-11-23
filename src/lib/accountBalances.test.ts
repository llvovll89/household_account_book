import { describe, expect, it } from 'vitest'
import type { Transaction, UserPaymentMethod } from '../types'
import { getAccountBalances } from './accountBalances'

const tx = (id: string, type: 'income' | 'expense', amount: number, date: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, type, amount, category: '식비', description: '', date, createdAt: 1, ...extra })

describe('getAccountBalances', () => {
  const methods: UserPaymentMethod[] = [
    { id: 'cash', type: 'cash', label: '현금', openingBalance: 50000, balanceAsOf: '2026-11-10' },
    { id: 'salary', type: 'transfer', label: '급여통장', openingBalance: 1_000_000, balanceAsOf: '2026-11-10' },
    { id: 'living', type: 'transfer', label: '생활비통장' },
    { id: 'card', type: 'credit', label: '신용카드', billingDay: 14, openingBalance: 999 },
  ]

  it('applies only transactions after the as-of date to the opening balance', () => {
    const balances = getAccountBalances(methods, [
      tx('old', 'expense', 9000, '2026-11-09'),
      tx('lunch', 'expense', 9000, '2026-11-11'),
      tx('pay', 'income', 3_000_000, '2026-11-25', { paymentMethod: 'transfer', paymentMethodId: 'salary' }),
      tx('rent', 'expense', 500_000, '2026-11-26', { paymentMethod: 'transfer', paymentMethodId: 'salary' }),
    ])
    expect(balances.map((b) => [b.method.id, b.balance])).toEqual([['cash', 41000], ['salary', 3_500_000]])
  })

  it('skips accounts without an opening balance and credit cards', () => {
    const balances = getAccountBalances(methods, [tx('x', 'expense', 1000, '2026-11-20', { paymentMethod: 'transfer', paymentMethodId: 'living' })])
    expect(balances.map((b) => b.method.id)).toEqual(['cash', 'salary'])
  })

  it('assigns old records without an account id to the first account of the same kind', () => {
    const balances = getAccountBalances(methods, [tx('t', 'expense', 1000, '2026-11-20', { paymentMethod: 'transfer' })])
    expect(balances.find((b) => b.method.id === 'salary')?.balance).toBe(999_000)
  })
})
