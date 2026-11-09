import { describe, expect, it } from 'vitest'
import { daysBetween, getPreviousPeriod, filterByRange, generateSuggestions } from './spendingRules'
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

describe('generateSuggestions over-budget rule', () => {
  const expense = (amount: number, date = '2026-11-05') => ({ id: `t${amount}${date}`, type: 'expense' as const, amount, category: '식비', description: '', date, createdAt: 1 })
  const overBudget = (s: ReturnType<typeof generateSuggestions>) => s.find(x => x.id === 'over_budget')

  it('reports the overage against the prorated budget of a partial month', () => {
    // 10일 기간의 환산 예산 100,000원 대비 150,000원 지출
    const s = overBudget(generateSuggestions([expense(150000)], [], [], [{ category: '식비', limit: 300000 }], '2026-11-01', '2026-11-10'))
    expect(s?.title).toBe('식비 예산을 50% 초과했어요')
    expect(s?.savingHint).toBe('50,000원 초과')
  })

  it('scales the budget up for periods longer than a month', () => {
    // 90일 기간이면 월 예산 300,000원의 3배까지는 초과가 아니다
    expect(overBudget(generateSuggestions([expense(600000)], [], [], [{ category: '식비', limit: 300000 }], '2026-08-12', '2026-11-09'))).toBeUndefined()
  })

  it('uses the budget override of the period month instead of mixing every month', () => {
    const budgets = [{ category: '식비', limit: 100000 }, { category: '식비', limit: 500000, yearMonth: '2026-11' }]
    expect(overBudget(generateSuggestions([expense(200000)], [], [], budgets, '2026-11-01', '2026-11-30'))).toBeUndefined()
  })
})
