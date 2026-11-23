import { describe, expect, it } from 'vitest'
import type { SavingsGoal, Transaction } from '../types'
import { getGoalAutoAmounts, getRecentLinkedTransactions } from './goals'

const goal = (id: string, link: Partial<SavingsGoal>): SavingsGoal =>
  ({ id, name: id, targetAmount: 1_000_000, currentAmount: 0, emoji: '', color: '', memo: '', createdAt: 1, ...link })
const tx = (id: string, type: 'income' | 'expense', amount: number, category: string, date: string, tags?: string[]): Transaction =>
  ({ id, type, amount, category, description: '', date, createdAt: 1, ...(tags ? { tags } : {}) })

describe('getGoalAutoAmounts', () => {
  const txs = [
    tx('s1', 'expense', 300000, '저축', '2026-09-25'),
    tx('s2', 'expense', 300000, '저축', '2026-10-25'),
    tx('trip-in', 'income', 200000, '용돈', '2026-10-01', ['여행']),
    tx('trip-out', 'expense', 50000, '식비', '2026-10-02', ['여행']),
  ]

  it('adds expenses of a linked expense category instead of dropping to zero', () => {
    expect(getGoalAutoAmounts([goal('emergency', { linkedCategory: '저축' })], txs)).toEqual({ emergency: 600000 })
  })

  it('nets income minus spending for tag-only goals and skips unlinked goals', () => {
    expect(getGoalAutoAmounts([goal('trip', { linkedTags: ['여행'] }), goal('manual', {})], txs)).toEqual({ trip: 150000 })
  })

  it('requires both category and tag when both are linked', () => {
    expect(getGoalAutoAmounts([goal('g', { linkedCategory: '식비', linkedTags: ['여행'] })], txs)).toEqual({ g: 50000 })
  })
})

it('getRecentLinkedTransactions returns the latest linked records first', () => {
  const txs = [tx('a', 'expense', 1, '저축', '2026-09-01'), tx('b', 'expense', 1, '저축', '2026-11-01'), tx('c', 'expense', 1, '식비', '2026-11-02')]
  const recent = getRecentLinkedTransactions([goal('g', { linkedCategory: '저축' })], txs, 1)
  expect(recent.g.map((t) => t.id)).toEqual(['b'])
})
