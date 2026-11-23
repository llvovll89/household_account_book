import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TransfersModal } from './TransfersModal'

afterEach(cleanup)

const methods = [
  { id: 'salary', type: 'transfer' as const, label: '급여통장' },
  { id: 'living', type: 'transfer' as const, label: '생활비' },
  { id: 'card', type: 'credit' as const, label: '현대카드', billingDay: 14 },
]

it('records a card payment from an account and validates the pair and amount', () => {
  const onSave = vi.fn()
  render(createElement(TransfersModal, { methods, transfers: [], onSave, onClose: vi.fn() }))
  expect(screen.queryByRole('option', { name: '현대카드' })).toBeNull()
  fireEvent.change(screen.getByLabelText('받은 곳'), { target: { value: 'salary' } })
  fireEvent.change(screen.getByLabelText('금액 (원)'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: '이체 추가' }))
  expect(screen.getByRole('alert').textContent).toBe('보낸 곳과 받은 곳이 같아요.')
  fireEvent.change(screen.getByLabelText('받은 곳'), { target: { value: 'card' } })
  fireEvent.change(screen.getByLabelText('금액 (원)'), { target: { value: '450,000' } })
  fireEvent.click(screen.getByRole('button', { name: '이체 추가' }))
  expect(screen.getByText('급여통장 → 현대카드')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave.mock.calls[0][0]).toEqual([expect.objectContaining({ fromId: 'salary', toId: 'card', amount: 450000 })])
})
