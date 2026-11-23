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

it('opens management to select records and cancels without deleting', () => {
  const onBulkDelete = vi.fn()
  render(createElement(TransactionList, {
    transactions: [{ id: 'lunch', type: 'expense', amount: 9000, category: '식비', description: '점심 식사', date: '2026-09-11', createdAt: 1 }],
    yearMonth: '2026-09', onEdit: vi.fn(), onDelete: vi.fn(), onBulkDelete,
  }))
  expect((screen.getByText('관리').closest('details') as HTMLDetailsElement).open).toBe(false)
  fireEvent.click(screen.getByText('관리'))
  fireEvent.click(screen.getByRole('button', { name: '선택' }))
  const row = screen.getByText('점심 식사').closest('[role="button"]')
  expect(row).toBeTruthy()
  fireEvent.click(row!)
  expect(screen.getByText('1개 선택됨')).toBeTruthy()
  fireEvent.click(screen.getByText('선택 취소'))
  expect(screen.queryByText('1개 선택됨')).toBeNull()
  expect(onBulkDelete).not.toHaveBeenCalled()
})

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

it('lists every card expense in the current statement, including last month purchases after the billing day', async () => {
  localStorage.setItem('hb_tx_billing_filter', 'current')
  const card = { type: 'expense' as const, category: '쇼핑', paymentMethod: 'credit' as const, creditBillingDay: 15, createdAt: 1 }
  render(createElement(TransactionList, {
    transactions: [
      { ...card, id: 'oct', amount: 50000, description: '10월 결제분', date: '2026-10-20' },
      { ...card, id: 'nov', amount: 30000, description: '11월 결제분', date: '2026-11-03' },
    ],
    yearMonth: '2026-11', onEdit: vi.fn(), onDelete: vi.fn(),
  }))
  await waitFor(() => expect(screen.getByText('10월 결제분')).toBeTruthy())
  expect(screen.getByText('11월 결제분')).toBeTruthy()
})

it('finds records from other months only when searching all periods', async () => {
  const transactions: Transaction[] = [
    { id: 'old', type: 'expense', amount: 17000, category: '문화/여가', description: '넷플릭스 작년', date: '2025-11-05', createdAt: 1 },
    { id: 'now', type: 'expense', amount: 17000, category: '문화/여가', description: '넷플릭스 이번달', date: '2026-11-05', createdAt: 2 },
  ]
  render(createElement(TransactionList, { transactions, yearMonth: '2026-11', onEdit: vi.fn(), onDelete: vi.fn() }))
  fireEvent.change(screen.getByRole('searchbox', { name: '내역 검색' }), { target: { value: '넷플릭스' } })
  await screen.findByText(/검색됨/)
  // 검색어가 하이라이트로 쪼개지므로 화면 전체 글자로 확인한다
  const shown = () => document.body.textContent ?? ''
  expect(shown()).toContain('이번달')
  expect(shown()).not.toContain('작년')
  fireEvent.click(screen.getByRole('button', { name: '전체 기간' }))
  await waitFor(() => expect(shown()).toContain('작년'))
  expect(shown()).toContain('이번달')
})
