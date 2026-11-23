import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RecurringTransaction } from '../types'

vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))
import { useRecurringAutoApply } from './useRecurringAutoApply'
import { showToast } from '../lib/toast'

const rent: RecurringTransaction = { id: 'rent', type: 'expense', category: '주거비', amount: 500000, description: '월세', dayOfMonth: 1, lastAppliedMonth: '2026-10', createdAt: 1 }

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 5)) })
afterEach(() => vi.useRealTimers())

it('asks once for due items by default and applies them on confirm', async () => {
  const handleApplyRecurring = vi.fn(async () => true)
  const { result, rerender } = renderHook((props: { recurring: RecurringTransaction[] }) =>
    useRecurringAutoApply({ authReady: true, isSyncing: false, recurring: props.recurring, handleApplyRecurring }), { initialProps: { recurring: [rent] } })
  expect(result.current.showAutoApplyModal).toBe(true)
  expect(result.current.autoApplyPending).toEqual([rent])
  rerender({ recurring: [{ ...rent }] })
  expect(handleApplyRecurring).not.toHaveBeenCalled()
  await act(async () => { await result.current.confirmAutoApply() })
  expect(handleApplyRecurring).toHaveBeenCalledWith([rent], '2026-11')
  expect(result.current.showAutoApplyModal).toBe(false)
  expect(showToast).toHaveBeenCalledWith(expect.stringContaining('정기 항목 1건 등록'))
})

it('applies right away in always mode and shows the result only when saved', async () => {
  localStorage.setItem('hb_recurring_auto_apply_mode', 'always')
  const handleApplyRecurring = vi.fn(async () => true)
  const { result } = renderHook(() => useRecurringAutoApply({ authReady: true, isSyncing: false, recurring: [rent], handleApplyRecurring }))
  await waitFor(() => expect(result.current.showAutoApplyResultModal).toBe(true))
  expect(result.current.autoApplyResultItems).toEqual([rent])
})

it('does nothing after being suppressed, e.g. right after a backup restore', () => {
  const handleApplyRecurring = vi.fn(async () => true)
  const { result, rerender } = renderHook((props: { ready: boolean }) =>
    useRecurringAutoApply({ authReady: props.ready, isSyncing: false, recurring: [rent], handleApplyRecurring }), { initialProps: { ready: false } })
  act(() => result.current.suppressAutoApply())
  rerender({ ready: true })
  expect(result.current.showAutoApplyModal).toBe(false)
})
