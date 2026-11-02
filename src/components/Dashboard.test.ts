import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

vi.mock('./MonthlyDashboard', () => ({ default: () => createElement('p', null, '상세 차트 화면') }))
afterEach(cleanup)

it('opens over-budget expenses directly without mounting detailed charts', async () => {
  render(createElement(Dashboard, {
    transactions: [{ id: 'food', date: '2026-11-02', type: 'expense', amount: 20000, category: '식비', description: '점심', createdAt: 1 }],
    budgets: [{ category: '식비', limit: 10000 }], recurring: [], goals: [], subscriptions: [], userPaymentMethods: [],
    settingsVersion: 0, yearMonth: '2026-11', customExpenseCategories: [], onBudgetsChange: vi.fn(), onRecurringSave: vi.fn(),
    onApplyRecurring: vi.fn(), onOpenCategoryModal: vi.fn(), onOpenPaymentMethodsModal: vi.fn(), onEditTransaction: vi.fn(),
  }))
  fireEvent.click(screen.getByRole('button', { name: '식비 지출 보기' }))
  expect(await screen.findByRole('dialog', { name: '11월 식비 지출' })).toBeTruthy()
  expect(screen.queryByText('상세 차트 화면')).toBeNull()
})

it('keeps monthly charts unmounted until the details are opened', async () => {
  const { container } = render(createElement(Dashboard, {
    transactions: [], budgets: [], recurring: [], goals: [], subscriptions: [], userPaymentMethods: [],
    settingsVersion: 0, yearMonth: '2026-11', customExpenseCategories: [],
    onBudgetsChange: vi.fn(), onRecurringSave: vi.fn(), onApplyRecurring: vi.fn(),
    onOpenCategoryModal: vi.fn(), onOpenPaymentMethodsModal: vi.fn(),
  }))
  expect(screen.queryByText('상세 차트 화면')).toBeNull()
  const details = container.querySelector('details.home-monthly-details') as HTMLDetailsElement
  details.open = true
  fireEvent(details, new Event('toggle'))
  expect(await screen.findByText('상세 차트 화면')).toBeTruthy()
  details.open = false
  fireEvent(details, new Event('toggle'))
  await waitFor(() => expect(screen.queryByText('상세 차트 화면')).toBeNull())
})
