import { describe, expect, it } from 'vitest'
import { daysBetween, getPreviousPeriod, filterByRange } from './spendingRules'
import type { Transaction } from '../types'

describe('spendingRules date helpers', () => {
  it('daysBetween는 같은 날짜를 1일로 계산한다', () => {
    expect(daysBetween('2026-07-09', '2026-07-09')).toBe(1)
  })

  it('getPreviousPeriod는 월 경계에서도 동일 길이 구간을 반환한다', () => {
    const { prevStart, prevEnd } = getPreviousPeriod('2026-03-01', '2026-03-31')

    expect(prevEnd).toBe('2026-02-28')
    expect(daysBetween(prevStart, prevEnd)).toBe(31)
  })
})

describe('spendingRules range filter', () => {
  it('filterByRange는 범위 내 거래만 포함한다', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'expense', amount: 1000, category: '식비', description: '', date: '2026-07-01', createdAt: 1 },
      { id: '2', type: 'expense', amount: 2000, category: '식비', description: '', date: '2026-07-15', createdAt: 2 },
      { id: '3', type: 'expense', amount: 3000, category: '식비', description: '', date: '2026-08-01', createdAt: 3 },
    ]

    const filtered = filterByRange(txs, '2026-07-01', '2026-07-31')

    expect(filtered).toHaveLength(2)
    expect(filtered.map((t) => t.id)).toEqual(['1', '2'])
  })
})
