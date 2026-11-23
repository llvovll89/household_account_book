import { describe, expect, it } from 'vitest'
import type { Transaction, UserPaymentMethod } from '../types'
import { getAccountBalances, summarizeNetWorth } from './accountBalances'

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

it('summarizeNetWorth subtracts remaining loan principal from account balances', () => {
  const method = { id: 'a', type: 'transfer' as const, label: '통장' }
  expect(summarizeNetWorth([{ method, balance: 3_000_000 }, { method, balance: -200_000 }], [1_000_000, 500_000]))
    .toEqual({ accountTotal: 2_800_000, loanTotal: 1_500_000, netWorth: 1_300_000 })
})

it('computes balances at a past or future date around the as-of date', () => {
  const methods: UserPaymentMethod[] = [{ id: 'bank', type: 'transfer', label: '통장', openingBalance: 1_000_000, balanceAsOf: '2026-11-10' }]
  const txs = [
    tx('oct', 'income', 300_000, '2026-10-25', { paymentMethod: 'transfer', paymentMethodId: 'bank' }),
    tx('nov', 'expense', 100_000, '2026-11-05', { paymentMethod: 'transfer', paymentMethodId: 'bank' }),
    tx('dec', 'expense', 50_000, '2026-12-03', { paymentMethod: 'transfer', paymentMethodId: 'bank' }),
  ]
  const at = (d: string) => getAccountBalances(methods, txs, d)[0].balance
  expect(at('2026-10-31')).toBe(1_100_000)
  expect(at('2026-10-20')).toBe(800_000)
  expect(at('2026-11-30')).toBe(1_000_000)
  expect(at('2026-12-31')).toBe(950_000)
})

it('moves money between accounts with transfers and treats card payments as leaving the account', () => {
  const methods: UserPaymentMethod[] = [
    { id: 'salary', type: 'transfer', label: '급여통장', openingBalance: 1_000_000, balanceAsOf: '2026-11-10' },
    { id: 'living', type: 'transfer', label: '생활비', openingBalance: 0, balanceAsOf: '2026-11-10' },
    { id: 'card', type: 'credit', label: '카드', billingDay: 14 },
  ]
  const transfers = [
    { id: 't1', date: '2026-11-15', amount: 300_000, fromId: 'salary', toId: 'living', createdAt: 1 },
    { id: 't2', date: '2026-12-14', amount: 200_000, fromId: 'salary', toId: 'card', createdAt: 1 },
    { id: 'old', date: '2026-11-01', amount: 999, fromId: 'salary', toId: 'living', createdAt: 1 },
  ]
  const now = getAccountBalances(methods, [], undefined, transfers)
  expect(now.map((b) => [b.method.id, b.balance])).toEqual([['salary', 500_000], ['living', 300_000]])
  const nov = getAccountBalances(methods, [], '2026-11-30', transfers)
  expect(nov.map((b) => b.balance)).toEqual([700_000, 300_000])
})
