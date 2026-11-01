import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import UsageInsightsModal from './UsageInsightsModal'
import { beginUsageFlow, isUsageMeasurementEnabled, updateUsageFlow } from '../lib/usageFlow'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shows local completion metrics and supports pause and clearing without modifying transactions', () => {
  localStorage.setItem('hb_transactions', '["untouched"]')
  const id = beginUsageFlow('entry')
  updateUsageFlow(id, 'complete', 'persist')
  render(createElement(UsageInsightsModal, { onClose: vi.fn() }))
  expect(screen.getByText('100%')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: '사용 흐름 측정' }))
  expect(isUsageMeasurementEnabled()).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '측정 기록 지우기' }))
  expect(screen.queryByText('100%')).toBeNull()
  expect(localStorage.getItem('hb_transactions')).toBe('["untouched"]')
})

it('exports only a summary without per-flow IDs or transaction fields', async () => {
  const create = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:test')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(createElement(UsageInsightsModal, { onClose: vi.fn() }))
  fireEvent.click(screen.getByRole('button', { name: '요약 내보내기' }))
  expect(create).toHaveBeenCalledOnce()
  const blob = create.mock.calls[0][0]
  expect(blob.type).toBe('application/json')
  const text = await new Promise<string>(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })
  expect(Object.keys(JSON.parse(text))).toEqual(['days', 'recordedDays', 'entry', 'import'])
  expect(text).not.toContain('flowId')
  expect(text).not.toContain('description')
})
