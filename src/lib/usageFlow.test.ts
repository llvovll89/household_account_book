import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { beginUsageFlow, clearUsageMeasurement, getUsageSummary, readUsageEvents, setUsageMeasurementEnabled, updateUsageFlow } from './usageFlow'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 1, 12)) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear() })

it('distinguishes successful persistence, retry errors, and closing at a specific import stage', () => {
  const entry = beginUsageFlow('entry')
  updateUsageFlow(entry, 'submit', 'persist')
  vi.advanceTimersByTime(5000)
  updateUsageFlow(entry, 'complete', 'persist')
  updateUsageFlow(entry, 'complete', 'persist')
  const retry = beginUsageFlow('entry')
  updateUsageFlow(retry, 'error', 'form')
  vi.advanceTimersByTime(8000)
  updateUsageFlow(retry, 'complete', 'persist')
  const imported = beginUsageFlow('import')
  updateUsageFlow(imported, 'step', 'mapping')
  updateUsageFlow(imported, 'abandon')
  const summary = getUsageSummary()
  expect(summary.entry).toMatchObject({ started: 2, completed: 2, closed: 0, completionRate: 100, medianMs: 6500, withErrors: 1 })
  expect(summary.import).toMatchObject({ started: 1, completed: 0, closed: 1, unfinished: 0, closedAt: { mapping: 1 } })
  expect(summary.recordedDays).toBe(1)
})

it('does not count a submitted write as completed until persistence finishes', () => {
  const id = beginUsageFlow('entry')
  updateUsageFlow(id, 'submit', 'persist')
  updateUsageFlow(id, 'error', 'persist')
  expect(getUsageSummary().entry).toMatchObject({ completed: 0, unfinished: 1, withErrors: 1 })
  updateUsageFlow(id, 'complete', 'persist')
  expect(getUsageSummary().entry.completed).toBe(1)
})

it('supports pause and deletion without resurrecting a cleared flow', () => {
  const id = beginUsageFlow('entry')
  setUsageMeasurementEnabled(false)
  updateUsageFlow(id, 'complete', 'persist')
  expect(beginUsageFlow('import')).toBeNull()
  expect(getUsageSummary().entry.completed).toBe(0)
  clearUsageMeasurement()
  setUsageMeasurementEnabled(true)
  updateUsageFlow(id, 'complete', 'persist')
  expect(readUsageEvents()).toEqual([])
})

it('strips non-allowed fields, expires old data, and never blocks usage on storage errors', () => {
  const now = Date.now()
  localStorage.setItem('hb_usage_flow_v1', JSON.stringify([
    { flowId: 'a', flow: 'entry', action: 'start', stage: 'form', at: now, amount: 999, description: 'private' },
    { flowId: 'old', flow: 'entry', action: 'start', stage: 'form', at: now - 31 * 86400000 },
    { flowId: 'bad', flow: 'entry', action: 'unknown', stage: 'form', at: now },
  ]))
  expect(readUsageEvents()).toEqual([{ flowId: 'a', flow: 'entry', action: 'start', stage: 'form', at: now }])
  const id = beginUsageFlow('import')
  updateUsageFlow(id, 'abandon')
  expect(localStorage.getItem('hb_usage_flow_v1')).not.toContain('private')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(beginUsageFlow('entry')).toBeNull()
  expect(() => updateUsageFlow(id, 'complete')).not.toThrow()
})

it('keeps the bounded history and excludes starts outside the selected period', () => {
  const old = beginUsageFlow('entry')
  updateUsageFlow(old, 'complete')
  vi.advanceTimersByTime(8 * 86400000)
  expect(getUsageSummary(7).entry.started).toBe(0)
  expect(getUsageSummary(28).entry.started).toBe(1)
  for (let i = 0; i < 610; i++) beginUsageFlow('entry')
  expect(readUsageEvents()).toHaveLength(600)
})
