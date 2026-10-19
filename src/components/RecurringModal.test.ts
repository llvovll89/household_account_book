import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import RecurringModal from './RecurringModal'

afterEach(cleanup)
it('can attach an existing recurring payment to an automatic-transfer account', () => {
  const onSave = vi.fn()
  render(createElement(RecurringModal, { recurring: [{ id: 'r', type: 'expense', category: '보험', amount: 50000, description: '', dayOfMonth: 15, lastAppliedMonth: '', createdAt: 1 }], userPaymentMethods: [{ id: 'bank', type: 'transfer', label: '보험 자동이체 계좌' }], onSave, onClose: vi.fn() }))
  fireEvent.change(screen.getByRole('combobox', { name: '보험 정기 내역 결제수단' }), { target: { value: 'bank' } })
  fireEvent.click(screen.getByRole('button', { name: '저장하기' }))
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ paymentMethod: 'transfer', paymentMethodId: 'bank' })
})
