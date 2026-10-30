import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import TransactionModal from './TransactionModal'
import { toLocalDateStr } from '../lib/format'

vi.mock('../lib/storage', () => ({ loadSettings: async () => ({ userPaymentMethods: [], cardBillingDay: 25 }) }))
vi.mock('../firebase/firebase', () => ({ auth: { currentUser: null } }))
vi.mock('../lib/receiptStorage', () => ({ uploadReceiptImage: vi.fn() }))
vi.mock('./FancyDatePicker', () => ({ default: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('offers an optional future rule for a corrected category, only applying it when saving', async () => {
  const onSaveRules = vi.fn(), onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onSaveRules, onClose: vi.fn(), transaction: { id: 'coffee', type: 'expense', amount: 5000, description: '스타벅스', category: '쇼핑', date: toLocalDateStr(), createdAt: 1 } }))
  fireEvent.click(screen.getByRole('button', { name: '식비', exact: true }))
  fireEvent.click(screen.getByRole('checkbox', { name: '다음에도 같은 적요에 식비 적용하기' }))
  expect(onSaveRules).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '저장', exact: true }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSaveRules).toHaveBeenCalledWith([expect.objectContaining({ keyword: '스타벅스', category: '식비', type: 'expense', enabled: true })])
})

it('does not create a rule when only the current transaction category is changed', async () => {
  const onSaveRules = vi.fn(), onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onSaveRules, onClose: vi.fn(), transaction: { id: 'coffee', type: 'expense', amount: 5000, description: '스타벅스', category: '쇼핑', date: toLocalDateStr(), createdAt: 1 } }))
  fireEvent.click(screen.getByRole('button', { name: '식비', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '저장', exact: true }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSaveRules).not.toHaveBeenCalled()
})

it('reuses a recent entry with today and a changed amount, without copying the receipt', async () => {
  const onSave = vi.fn()
  render(createElement(TransactionModal, {
    onSave, onClose: vi.fn(),
    recentTransactions: [{ id: 'lunch', type: 'expense', amount: 9000, category: '식비', description: '점심', date: '2026-01-01', createdAt: 1, paymentMethod: 'credit', paymentMethodId: 'card', receiptImageUrl: 'old-receipt' }],
    userPaymentMethods: [{ id: 'card', type: 'credit', label: '생활카드', billingDay: 12 }],
  }))
  fireEvent.click(screen.getByRole('button', { name: /점심.*식비.*생활카드.*9,000원/ }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '10000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ date: toLocalDateStr(), amount: 10000, category: '식비', description: '점심', paymentMethodId: 'card', creditBillingDay: 12 })
  expect(onSave.mock.calls[0][0][0].receiptImageUrl).not.toBe('old-receipt')
})

it('does not offer deleted payment methods or show quick entry in edit mode', () => {
  const old = { id: 'old', type: 'expense' as const, amount: 1000, category: '식비', description: '', date: '2026-01-01', createdAt: 1, paymentMethodId: 'deleted' }
  const { unmount } = render(createElement(TransactionModal, { onSave: vi.fn(), onClose: vi.fn(), recentTransactions: [old] }))
  expect(screen.queryByRole('region', { name: '최근 내역으로 빠른 입력' })).toBeNull()
  unmount()
  render(createElement(TransactionModal, { onSave: vi.fn(), onClose: vi.fn(), transaction: old, recentTransactions: [{ ...old, paymentMethodId: undefined }] }))
  expect(screen.queryByRole('region', { name: '최근 내역으로 빠른 입력' })).toBeNull()
})

it('opens touch entry without forcing the keyboard and still saves a tapped amount', async () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  const onSave = vi.fn()
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  const amount = screen.getByRole('textbox', { name: '금액 (원)' })
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '닫기' })))
  fireEvent.click(amount)
  expect(document.activeElement).toBe(amount)
  fireEvent.change(amount, { target: { value: '8000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0].amount).toBe(8000)
})

it('keeps a draft on close or Escape until the user explicitly discards it', async () => {
  const onClose = vi.fn()
  render(createElement(TransactionModal, { onSave: vi.fn(), onClose }))
  const amount = screen.getByRole('textbox', { name: '금액 (원)' })
  fireEvent.change(amount, { target: { value: '25000' } })
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  expect(screen.getByRole('alert').textContent).toContain('작성 중인 내용')
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '계속 작성' }))
  expect((amount as HTMLInputElement).value).toBe('25,000')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '저장하지 않고 닫기' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})

it('closes a blank form without asking to discard', async () => {
  const onClose = vi.fn()
  render(createElement(TransactionModal, { onSave: vi.fn(), onClose }))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(screen.queryByRole('button', { name: '계속 작성' })).toBeNull()
})

it('does not ask to discard an unchanged credit-card transaction', async () => {
  const onClose = vi.fn()
  render(createElement(TransactionModal, {
    onSave: vi.fn(), onClose,
    transaction: { id: 'existing', type: 'expense', amount: 9000, category: '식비', description: '', date: '2026-10-22', createdAt: 1, paymentMethod: 'credit', paymentMethodId: 'card' },
    userPaymentMethods: [{ id: 'card', type: 'credit', label: '생활카드', billingDay: 12 }],
  }))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(screen.queryByRole('button', { name: '계속 작성' })).toBeNull()
})

it('protects queued entries when the current amount is blank', () => {
  const onClose = vi.fn()
  render(createElement(TransactionModal, { onSave: vi.fn(), onClose }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '10000' } })
  fireEvent.click(screen.getByRole('button', { name: '계속 입력' }))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  expect(screen.getByRole('button', { name: '계속 작성' })).toBeTruthy()
  expect(onClose).not.toHaveBeenCalled()
})

it('rejects unsafe amounts while keeping the last valid value', () => {
  render(createElement(TransactionModal, { onSave: vi.fn(), onClose: vi.fn() }))
  const amount = screen.getByRole('textbox', { name: '금액 (원)' })
  fireEvent.change(amount, { target: { value: '123456789012345' } })
  expect((amount as HTMLInputElement).value).toBe('123,456,789,012,345')
  fireEvent.change(amount, { target: { value: '9999999999999999999' } })
  expect(screen.getByRole('alert').textContent).toContain('까지 입력')
  expect((amount as HTMLInputElement).value).toBe('123,456,789,012,345')
})

it('saves the previous local calendar day when Yesterday is selected', async () => {
  const onSave = vi.fn()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  render(createElement(TransactionModal, { onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: '어제' }))
  fireEvent.change(screen.getByRole('textbox', { name: '금액 (원)' }), { target: { value: '9000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ date: toLocalDateStr(yesterday), amount: 9000 })
})

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
