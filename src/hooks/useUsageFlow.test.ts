import { createElement, StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useUsageFlow } from './useUsageFlow'
import { getUsageSummary, readUsageEvents, updateUsageFlow } from '../lib/usageFlow'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear() })

it('records one flow under StrictMode and counts closing before submit as abandonment', () => {
  const view = renderHook(() => useUsageFlow('entry'), { wrapper: ({ children }) => createElement(StrictMode, null, children) })
  act(() => { vi.advanceTimersByTime(1) })
  expect(getUsageSummary().entry.started).toBe(1)
  view.unmount()
  expect(getUsageSummary().entry.closed).toBe(1)
})

it('does not mark a submitted form as abandoned when its modal unmounts', () => {
  const view = renderHook(() => useUsageFlow('import'))
  act(() => view.result.current.step('preview'))
  let id: string | null = null
  act(() => { id = view.result.current.submit() })
  view.unmount()
  expect(getUsageSummary().import).toMatchObject({ closed: 0, completed: 0, unfinished: 1 })
  updateUsageFlow(id, 'complete', 'persist')
  expect(getUsageSummary().import.completed).toBe(1)
})

it('excludes editing flows and handles page exit', () => {
  const inactive = renderHook(() => useUsageFlow('entry', false))
  act(() => { inactive.result.current.submit(); vi.advanceTimersByTime(1) })
  expect(readUsageEvents()).toEqual([])
  inactive.unmount()
  const active = renderHook(() => useUsageFlow('import'))
  act(() => { active.result.current.step('mapping'); window.dispatchEvent(new Event('pagehide')) })
  expect(getUsageSummary().import.closedAt.mapping).toBe(1)
})
