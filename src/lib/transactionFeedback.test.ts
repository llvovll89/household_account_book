import { expect, it } from 'vitest'
import { getTransactionFeedback } from './transactionFeedback'
import type { Transaction } from '../types'

const item: Transaction = { id: 'a', type: 'expense', category: '식비', amount: 9000, date: '2026-10-12', description: '', createdAt: 1 }

it('uses the saved month override and includes carryover consistently with home', () => {
  const budgets = [{ category: '식비', limit: 10000 }, { category: '식비', limit: 30000, carryover: true, yearMonth: '2026-10' }]
  const next = [item, { ...item, id: 'previous', amount: 20000, date: '2026-09-12' }]
  expect(getTransactionFeedback([item], next, budgets)).toContain('2026년 10월 식비 예산이 31,000원 남았어요.')
})

it('reports over-budget and edited totals without counting the old amount twice', () => {
  const edited = { ...item, amount: 12000 }
  expect(getTransactionFeedback([edited], [edited], [{ category: '식비', limit: 10000 }], true)).toBe('식비 12,000원을 수정했어요.\n2026년 10월 식비 예산을 2,000원 초과했어요.')
})

it('uses only recorded expenses on that date when no category budget exists', () => {
  const next = [item, { ...item, id: 'other', category: '교통비', amount: 1000 }, { ...item, id: 'income', type: 'income' as const, amount: 50000 }, { ...item, id: 'day', date: '2026-10-13', amount: 20000 }]
  expect(getTransactionFeedback([item], next, [])).toContain('2026.10.12 기록한 지출은 10,000원이에요.')
})

it('does not invent budget feedback for income or mixed batches', () => {
  expect(getTransactionFeedback([{ ...item, type: 'income' }], [], [])).not.toContain('예산')
  expect(getTransactionFeedback([item, item], [], [])).toBe('2건의 내역을 기록했어요.')
})
