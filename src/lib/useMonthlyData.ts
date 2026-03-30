import { useMemo } from 'react'
import type { Transaction } from '../types'
import type { MonthlyDataPoint } from '../types'

function getRelativeYM(offset: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(ym: string) {
  return `${parseInt(ym.split('-')[1])}월`
}

/** 최근 6개월치 월별 수입/지출/잔액 데이터를 반환하는 훅 */
export function useMonthlyData(transactions: Transaction[]): MonthlyDataPoint[] {
  return useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const ym = getRelativeYM(i - 5)
      const monthly = transactions.filter((t) => t.date.startsWith(ym))
      const income = monthly.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = monthly.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { ym, label: getMonthLabel(ym), income, expense, balance: income - expense }
    })
  }, [transactions])
}
