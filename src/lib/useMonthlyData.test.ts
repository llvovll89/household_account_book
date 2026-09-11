import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useMonthlyData } from './useMonthlyData'
import type { Transaction } from '../types'

it('uses the selected month across year boundaries and updates when the month changes', () => {
  const transactions: Transaction[] = [
    { id: '1', type: 'income', amount: 1000, category: '급여', description: '', date: '2025-12-01', createdAt: 1 },
    { id: '2', type: 'expense', amount: 300, category: '식비', description: '', date: '2025-12-02', createdAt: 2 },
    { id: '3', type: 'expense', amount: 100, category: '식비', description: '', date: '2026-01-02', createdAt: 3 },
  ]
  const { result, rerender } = renderHook(({ month }) => useMonthlyData(transactions, month), { initialProps: { month: '2025-12' } })
  expect(result.current.map(point => point.ym)).toEqual(['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'])
  expect(result.current[5]).toMatchObject({ label: '12월', income: 1000, expense: 300, balance: 700 })
  rerender({ month: '2026-01' })
  expect(result.current[5]).toMatchObject({ ym: '2026-01', income: 0, expense: 100, balance: -100 })
})
