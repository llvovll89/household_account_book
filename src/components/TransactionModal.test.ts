import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import TransactionModal from './TransactionModal'

vi.mock('../lib/storage', () => ({ loadSettings: async () => ({ userPaymentMethods: [], cardBillingDay: 25 }) }))
vi.mock('../firebase/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('../lib/receiptStorage', () => ({ uploadReceiptImage: vi.fn() }))
vi.mock('./FancyDatePicker', () => ({ default: () => null }))
afterEach(cleanup)

it('finishes amount entry without saving and keeps the draft available to save', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  const amount = screen.getByRole('textbox', { name: '금액 (원)' })
  await waitFor(() => expect(document.activeElement).toBe(amount))
  fireEvent.change(amount, { target: { value: '12500' } })
  fireEvent.click(screen.getByRole('button', { name: '입력 완료' }))
  expect(document.activeElement).not.toBe(amount)
  expect((amount as HTMLInputElement).value).toBe('12,500')
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0].amount).toBe(12500)
})

it('validates optional loan splits and saves transfer payment details', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: '대출' }))
  fireEvent.click(screen.getByRole('button', { name: '계좌이체' }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '110000' } })
  fireEvent.click(screen.getByRole('checkbox', { name: '원금·이자 구분 (선택)' }))
  fireEvent.change(screen.getByRole('textbox', { name: '원금 (원)' }), { target: { value: '100000' } })
  fireEvent.change(screen.getByRole('textbox', { name: '이자 (원)' }), { target: { value: '5000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByRole('alert').textContent).toContain('합계를 거래 금액과')
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: '이자 (원)' }), { target: { value: '10000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ category: '대출', paymentMethod: 'transfer', amount: 110000, loanPrincipal: 100000, loanInterest: 10000 })
})

it('searches long category names and keeps the queue unsaved until Save', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn(), customExpenseCategories: ['가족을 위한 정기 생활비'], recentTransactions: [] }))
  fireEvent.change(screen.getByRole('searchbox', { name: '카테고리 검색' }), { target: { value: '가족' } })
  fireEvent.click(screen.getByRole('button', { name: '가족을 위한 정기 생활비' }))
  expect(screen.queryByRole('button', { name: '식비' })).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '20000' } })
  fireEvent.click(screen.getByRole('button', { name: '계속 입력' }))
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('저장 전 1건')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '저장 (1건)' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0]).toHaveLength(1)
})

it.each(['대출', '보험'])('saves %s as an expense without duplicate choices from old custom settings', async (category) => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, {
    onSave, onClose: vi.fn(), customExpenseCategories: ['대출', '보험'],
  }))
  const choices = screen.getAllByRole('button', { name: category })
  expect(choices).toHaveLength(1)
  fireEvent.click(choices[0])
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '150000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ category, type: 'expense', amount: 150000 })
})

it('keeps a manually selected category while entering an amount and saves the draft', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: /교통비/ }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '12500' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ category: '교통비', type: 'expense', amount: 12500 })
})

it('switching to income selects a valid income category', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: '수입' }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '10000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ type: 'income', category: '급여', amount: 10000 })
})
