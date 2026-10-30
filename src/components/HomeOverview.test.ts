import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HomeOverview from './HomeOverview'
import type { Transaction } from '../types'
import { toLocalDateStr } from '../lib/format'

afterEach(cleanup)
const today = toLocalDateStr()
const transaction = (overrides: Partial<Transaction>): Transaction => ({ id: 'a', type: 'expense', category: '식비', amount: 9000, description: '점심', date: today, createdAt: 1, ...overrides })

it('counts only budgeted categories, includes carryover, and offers recording and budget actions', () => {
  const onAdd = vi.fn(), onBudget = vi.fn()
  render(createElement(HomeOverview, {
    transactions: [transaction({}), transaction({ id: 'b', category: '쇼핑', amount: 50000 })],
    budgets: [{ category: '식비', limit: 30000 }], carryoverAmounts: { 식비: 10000 }, yearMonth: today.slice(0, 7), onAdd, onBudget, onReview: vi.fn(),
  }))
  expect(screen.getByText('31,000')).toBeTruthy()
  expect(screen.getByText('설정한 1개 카테고리 기준 · 이월 포함')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /내역 기록하기/ }))
  fireEvent.click(screen.getByRole('button', { name: /카테고리별 예산 확인/ }))
  expect(onAdd).toHaveBeenCalledOnce()
  expect(onBudget).toHaveBeenCalledOnce()
})

it('does not present missing records as a zero-spending achievement or invent an unset budget', () => {
  render(createElement(HomeOverview, { transactions: [], budgets: [], carryoverAmounts: {}, yearMonth: today.slice(0, 7), onBudget: vi.fn(), onReview: vi.fn() }))
  expect(screen.getByText(/아직 오늘 기록이 없어요/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /예산 설정하기/ })).toBeTruthy()
  expect(screen.queryByText(/무지출/)).toBeNull()
})

it('shows the selected historical month and opens the relevant monthly details', () => {
  const onReview = vi.fn()
  render(createElement(HomeOverview, { transactions: [transaction({ date: '2020-01-01' })], budgets: [], carryoverAmounts: {}, yearMonth: '2020-01', onBudget: vi.fn(), onReview, attention: '정기 내역 1건' }))
  expect(screen.getByRole('heading', { name: '1월 최근 기록' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /월간 상세 열기/ }))
  expect(onReview).toHaveBeenCalledOnce()
})
