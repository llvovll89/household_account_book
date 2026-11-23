import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../lib/storage', () => ({ loadSettings: async () => ({}), saveSettings: async () => {} }))
import SubscriptionView from './SubscriptionView'

afterEach(cleanup)

it('creates a linked recurring item when auto-record is on and removes it with the subscription', () => {
  const onChange = vi.fn()
  const onRecurringChange = vi.fn()
  const { rerender } = render(createElement(SubscriptionView, { subscriptions: [], onChange, recurring: [], onRecurringChange }))
  fireEvent.click(screen.getByRole('button', { name: '구독 추가' }))
  fireEvent.change(screen.getByPlaceholderText('예: 넷플릭스, 유튜브 프리미엄'), { target: { value: '넷플릭스' } })
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '17000' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /자동 기록/ }))
  fireEvent.click(screen.getByRole('button', { name: '추가하기' }))
  const saved = onChange.mock.calls[0][0][0]
  const created = onRecurringChange.mock.calls[0][0]
  expect(created).toEqual([expect.objectContaining({ id: saved.recurringId, description: '넷플릭스', amount: 17000 })])

  rerender(createElement(SubscriptionView, { subscriptions: [saved], onChange, recurring: created, onRecurringChange }))
  fireEvent.click(screen.getByRole('button', { name: '넷플릭스 구독 삭제' }))
  fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  expect(onRecurringChange).toHaveBeenLastCalledWith([])
})
