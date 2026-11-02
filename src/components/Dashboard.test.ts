import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

vi.mock('./MonthlyDashboard', () => ({ default: () => createElement('p', null, '상세 차트 화면') }))

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
