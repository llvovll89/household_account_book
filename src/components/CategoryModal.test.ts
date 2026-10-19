import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CategoryModal from './CategoryModal'

afterEach(cleanup)
it('previews affected records, allows cancellation and passes the chosen destination only on save', () => {
  const onSave = vi.fn()
  render(createElement(CategoryModal, { customExpenseCategories: ['주택'], customIncomeCategories: [], onSave, onClose: vi.fn(), usage: { transactions: [{ id: 'one', type: 'expense', category: '주택', amount: 10, date: '2026-10-01', description: '', createdAt: 1 }], recurring: [], rules: [], templates: [], budgets: [], subscriptions: [], goals: [] } }))
  fireEvent.click(screen.getByRole('button', { name: '주택 카테고리 삭제' }))
  expect(screen.getByText('거래').parentElement?.textContent).toBe('거래1건')
  fireEvent.click(screen.getByRole('button', { name: '삭제 취소' }))
  expect(screen.getByRole('button', { name: '주택 카테고리 삭제' })).toBeTruthy()
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '주택 카테고리 삭제' }))
  fireEvent.change(screen.getByLabelText('이동할 카테고리'), { target: { value: '주거비' } })
  fireEvent.click(screen.getByRole('button', { name: '이동 후 삭제' }))
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave).toHaveBeenCalledWith([], [], { expense: { 주택: '주거비' }, income: {} })
})
it('closes on Escape and keeps newly built-in custom names intact on save', async () => {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(createElement(CategoryModal, { customExpenseCategories: ['보험'], customIncomeCategories: [], onSave, onClose }))
  expect(screen.queryByRole('button', { name: '보험 카테고리 삭제' })).toBeNull()
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(onSave).not.toHaveBeenCalled()
})
