import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NotificationCenter } from './NotificationCenter'
import { toLocalDateStr } from '../lib/format'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows a badge, lists notifications and remembers dismissed ones', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 23, 9))
  const props = {
    transactions: [{ id: 't', type: 'expense' as const, amount: 85000, category: '식비', description: '', date: toLocalDateStr(), createdAt: 1 }],
    budgets: [{ category: '식비', limit: 100000 }], recurring: [], subscriptions: [], userPaymentMethods: [],
  }
  const { unmount } = render(createElement(NotificationCenter, props))
  fireEvent.click(screen.getByRole('button', { name: '알림 1개' }))
  expect(screen.getByRole('dialog', { name: '알림' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '식비 예산 85% 사용 알림 확인' }))
  expect(screen.getByText('새 알림이 없어요')).toBeTruthy()
  unmount()
  render(createElement(NotificationCenter, props))
  expect(screen.getByRole('button', { name: '알림' })).toBeTruthy()
})
