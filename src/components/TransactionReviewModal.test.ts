import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import TransactionReviewModal from './TransactionReviewModal'
import type { Transaction } from '../types'
afterEach(cleanup)
const tx: Transaction = { id: 'food', date: '2026-11-02', category: '식비', description: '점심', amount: 9000, type: 'expense', createdAt: 1 }
it('shows only the requested expense scope and edits the original record without changing it', () => {
  const onEdit = vi.fn(), onClose = vi.fn()
  localStorage.setItem('hb_tx_type_filter', 'income')
  render(createElement(TransactionReviewModal, { scope: { title: '식비 지출', start: '2026-11-01', end: '2026-11-30', category: '식비' }, transactions: [tx, { ...tx, id: 'other', category: '교통비', description: '버스' }, { ...tx, id: 'income', type: 'income', description: '환급' }, { ...tx, id: 'previous', date: '2026-10-31', description: '전월' }], onEdit, onClose }))
  expect(screen.queryByText('버스')).toBeNull()
  expect(screen.queryByText('환급')).toBeNull()
  expect(screen.queryByText('전월')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '2026-11-02 점심 9,000원 내역 수정' }))
  expect(onEdit).toHaveBeenCalledWith(tx)
  expect(onClose).toHaveBeenCalledOnce()
  expect(localStorage.getItem('hb_tx_type_filter')).toBe('income')
})
