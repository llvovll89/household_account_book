import { useMemo } from 'react'
import type { Transaction, MonthlyDataPoint } from '../types'
import { toLocalDateStr } from './format'

/** 선택한 달까지 최근 6개월의 수입·지출을 한 번에 집계한다. */
export function useMonthlyData(transactions: Transaction[], yearMonth = toLocalDateStr().slice(0, 7)): MonthlyDataPoint[] {
  return useMemo(() => {
    const [year, month] = yearMonth.split('-').map(Number)
    const points = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(year, month - 6 + i, 1)
      const ym = toLocalDateStr(date).slice(0, 7)
      return { ym, label: `${date.getMonth() + 1}월`, income: 0, expense: 0, balance: 0 }
    })
    const byMonth = new Map(points.map(point => [point.ym, point]))
    for (const transaction of transactions) {
      const point = byMonth.get(transaction.date.slice(0, 7))
      if (!point) continue
      point[transaction.type] += transaction.amount
      point.balance = point.income - point.expense
    }
    return points
  }, [transactions, yearMonth])
}
