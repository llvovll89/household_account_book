import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import TransactionModal from './TransactionModal'

vi.mock('../lib/storage', () => ({ loadSettings: async () => ({ userPaymentMethods: [], cardBillingDay: 25 }) }))
vi.mock('../firebase/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('../lib/receiptStorage', () => ({ uploadReceiptImage: vi.fn() }))
vi.mock('./FancyDatePicker', () => ({ default: () => null }))
afterEach(cleanup)

it('keeps a manually selected category while entering an amount and saves the draft', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: /교통비/ }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '12500' } })
  fireEvent.click(screen.getByRole('button', { name: '지출 추가' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ category: '교통비', type: 'expense', amount: 12500 })
})

it('switching to income selects a valid income category', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: '수입' }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '10000' } })
  fireEvent.click(screen.getByRole('button', { name: '수입 추가' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ type: 'income', category: '급여', amount: 10000 })
})
