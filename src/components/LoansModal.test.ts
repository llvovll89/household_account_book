import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LoansModal } from './LoansModal'
import { toLocalDateStr } from '../lib/format'

afterEach(cleanup)

it('adds a loan with today as the as-of date and keeps the date when only the name changes', () => {
  const onSave = vi.fn()
  const loan = { id: 'car', name: '자동차', balance: 5_000_000, balanceAsOf: '2026-01-01', createdAt: 1 }
  render(createElement(LoansModal, { statuses: [{ loan, repaid: 1_000_000, remaining: 4_000_000 }], onSave, onClose: vi.fn() }))

  fireEvent.click(screen.getByRole('button', { name: '자동차 수정' }))
  fireEvent.change(screen.getByLabelText('대출 이름'), { target: { value: '자동차 할부' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 완료' }))

  fireEvent.click(screen.getByRole('button', { name: /대출 추가/ }))
  fireEvent.change(screen.getByLabelText('대출 이름'), { target: { value: '전세대출' } })
  fireEvent.change(screen.getByLabelText('오늘 기준 남은 원금 (원)'), { target: { value: '80,000,000' } })
  fireEvent.click(screen.getByRole('button', { name: '추가 완료' }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))

  const saved = onSave.mock.calls[0][0]
  expect(saved[0]).toEqual({ ...loan, name: '자동차 할부' })
  expect(saved[1]).toMatchObject({ name: '전세대출', balance: 80_000_000, balanceAsOf: toLocalDateStr() })
})

it('saves an optional rate and monthly payment, and rejects an invalid rate', () => {
  const onSave = vi.fn()
  render(createElement(LoansModal, { statuses: [], onSave, onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: /대출 추가/ }))
  fireEvent.change(screen.getByLabelText('대출 이름'), { target: { value: '신용대출' } })
  fireEvent.change(screen.getByLabelText('오늘 기준 남은 원금 (원)'), { target: { value: '5000000' } })
  fireEvent.change(screen.getByLabelText('연이율 % (선택)'), { target: { value: '120' } })
  fireEvent.click(screen.getByRole('button', { name: '추가 완료' }))
  expect(screen.getByRole('alert').textContent).toContain('연이율')
  fireEvent.change(screen.getByLabelText('연이율 % (선택)'), { target: { value: '5.5' } })
  fireEvent.change(screen.getByLabelText('월 상환액 (선택)'), { target: { value: '300,000' } })
  fireEvent.click(screen.getByRole('button', { name: '추가 완료' }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ name: '신용대출', annualRate: 5.5, monthlyPayment: 300000 })
})
