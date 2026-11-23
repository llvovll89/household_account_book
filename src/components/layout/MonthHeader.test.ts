import { createElement, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MonthHeader } from './MonthHeader'

afterEach(() => { cleanup(); vi.useRealTimers() })

function Harness({ onOpenBilling }: { onOpenBilling: (b: 'current' | 'next') => void }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 10, 15))
  return createElement(MonthHeader, { currentDate, setCurrentDate, monthIncome: 100, monthExpense: 50, monthBalance: 50, monthCardDue: 3000, nextMonthCardDue: 0, onOpenBilling })
}

it('moves between months, returns to this month and opens card billing', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 23))
  window.scrollTo = vi.fn()
  const onOpenBilling = vi.fn()
  render(createElement(Harness, { onOpenBilling }))
  expect(screen.queryByRole('button', { name: '이번 달' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '이전 달 보기' }))
  expect(screen.getByRole('button', { name: /2026년 10월/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '이번 달' }))
  expect(screen.getByRole('button', { name: /2026년 11월/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '카드 이번 청구 내역 필터 보기' }))
  expect(onOpenBilling).toHaveBeenCalledWith('current')
})
