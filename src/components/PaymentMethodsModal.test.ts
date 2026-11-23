import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PaymentMethodsModal from './PaymentMethodsModal'
import { toLocalDateStr } from '../lib/format'

afterEach(cleanup)

it('saves a cash balance as of today and rejects non-numeric balances', () => {
  const onSave = vi.fn()
  render(createElement(PaymentMethodsModal, { userPaymentMethods: [{ id: 'cash', type: 'cash', label: '현금' }], onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: '현금 잔액 수정' }))
  const input = screen.getByLabelText('오늘 기준 잔액 (선택)')
  fireEvent.change(input, { target: { value: '잔액' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 완료' }))
  expect(screen.getByRole('alert').textContent).toBe('잔액은 숫자로 입력하세요.')
  fireEvent.change(input, { target: { value: '52,000' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 완료' }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave.mock.calls[0][0]).toContainEqual({ id: 'cash', type: 'cash', label: '현금', openingBalance: 52000, balanceAsOf: toLocalDateStr() })
})
