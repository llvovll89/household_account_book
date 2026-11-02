import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import WeeklyReview from './WeeklyReview'
afterEach(() => { cleanup(); vi.useRealTimers() })

it('opens the exact week across a month boundary and requests category budget editing only on click', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 1, 12))
  const onViewExpenses = vi.fn(), onAdjustBudget = vi.fn()
  render(createElement(WeeklyReview, { transactions: [
    { id: 'a', date: '2026-10-31', type: 'expense', amount: 9000, category: '식비', description: '', createdAt: 1 },
    { id: 'b', date: '2026-11-01', type: 'expense', amount: 2000, category: '교통비', description: '', createdAt: 2 },
  ], onViewExpenses, onAdjustBudget }))
  fireEvent.click(screen.getByText('이번 주 기록 돌아보기'))
  expect(onAdjustBudget).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '이번 주 지출 보기' }))
  expect(onViewExpenses).toHaveBeenCalledWith({ start: '2026-10-26', end: '2026-11-01' })
  fireEvent.click(screen.getByRole('button', { name: '식비 지출만 보기' }))
  expect(onViewExpenses).toHaveBeenCalledWith({ start: '2026-10-26', end: '2026-11-01' }, '식비')
  fireEvent.click(screen.getByRole('button', { name: '이번 달 식비 예산 조정' }))
  expect(onAdjustBudget).toHaveBeenCalledWith('식비')
})

it('offers recording instead of category actions when there are no expenses', () => {
  const onAdd = vi.fn()
  render(createElement(WeeklyReview, { transactions: [], onAdd, onViewExpenses: vi.fn(), onAdjustBudget: vi.fn() }))
  fireEvent.click(screen.getByText('이번 주 기록 돌아보기'))
  expect(screen.queryByRole('button', { name: /예산 조정/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '오늘 내역 기록하기' }))
  expect(onAdd).toHaveBeenCalledOnce()
})
