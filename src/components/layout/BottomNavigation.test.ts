import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Home, LayoutGrid } from 'lucide-react'
import BottomNavigation from './BottomNavigation'

afterEach(cleanup)

it('marks More as current for any grouped tab and opens its remembered screen', () => {
  const onLedgerTabChange = vi.fn()
  render(createElement(BottomNavigation, {
    activeTab: 'memos',
    onLedgerTabChange,
    ledgerTabs: [
      { id: 'home', label: '홈', Icon: Home },
      { id: 'subscriptions', label: '더보기', Icon: LayoutGrid, matches: ['goals', 'subscriptions', 'memos'] },
    ],
  }))
  const more = screen.getByRole('button', { name: '더보기 탭' })
  expect(more.getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('button', { name: '홈 탭' }).getAttribute('aria-current')).toBeNull()
  fireEvent.click(more)
  expect(onLedgerTabChange).toHaveBeenCalledWith('subscriptions')
})
