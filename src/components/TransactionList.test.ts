import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TransactionList from './TransactionList'
import type { Transaction } from '../types'

vi.mock('../lib/storage', () => ({
  loadSettings: async () => ({ userPaymentMethods: [], cardBillingDay: 25, swipeSensitivity: 'medium' }),
  saveSettings: async () => undefined,
}))
vi.mock('./ExportModal', () => ({ default: () => null }))
vi.mock('./TransactionDetailModal', () => ({ default: () => null }))

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
afterEach(cleanup)

it('filters income without opening advanced filters and restores all records', async () => {
  const transactions: Transaction[] = [
    { id: 'salary', type: 'income', amount: 3000000, category: '급여', description: '이번 달 급여', date: '2026-09-11', createdAt: 1 },
    { id: 'lunch', type: 'expense', amount: 9000, category: '식비', description: '점심 식사', date: '2026-09-11', createdAt: 2 },
  ]
  render(createElement(TransactionList, { transactions, yearMonth: '2026-09', onEdit: vi.fn(), onDelete: vi.fn() }))
  const filterButton = screen.getByRole('button', { name: /상세 필터/ })
  expect(filterButton.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: '수입' }))
  await waitFor(() => expect(screen.queryByText('점심 식사')).toBeNull())
  expect(screen.getByText('이번 달 급여')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('3,000,000원')
  expect(filterButton.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: '전체' }))
  await waitFor(() => expect(screen.getByText('점심 식사')).toBeTruthy())
})

it('searches and clears transactions while advanced filters remain collapsed', async () => {
  localStorage.setItem('hb_tx_filter_panel_open', 'false')
  const transactions: Transaction[] = [
    { id: 'coffee', type: 'expense', amount: 4500, category: '카페', description: '오후 커피', date: '2026-09-11', createdAt: 1 },
    { id: 'lunch', type: 'expense', amount: 9000, category: '식비', description: '점심 식사', date: '2026-09-11', createdAt: 2 },
  ]
  render(createElement(TransactionList, { transactions, yearMonth: '2026-09', onEdit: vi.fn(), onDelete: vi.fn() }))
  const filterButton = screen.getByRole('button', { name: /상세 필터/ })
  expect(filterButton.getAttribute('aria-expanded')).toBe('false')
  const search = screen.getByRole('searchbox', { name: '내역 검색' })
  fireEvent.change(search, { target: { value: '오후 커피' } })
  await waitFor(() => expect(screen.queryByText('점심 식사')).toBeNull())
  expect(screen.getByText('오후 커피')).toBeTruthy()
  expect(filterButton.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
  await waitFor(() => expect(screen.getByText('점심 식사')).toBeTruthy())
})
