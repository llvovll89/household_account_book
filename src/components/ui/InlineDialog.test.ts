import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { InlineDialog } from './InlineDialog'

afterEach(cleanup)

it('exposes a named modal dialog that closes on Escape but not on panel clicks', async () => {
  vi.useFakeTimers()
  const onClose = vi.fn()
  render(createElement(InlineDialog, {
    onClose, label: '목표 추가', containerClassName: 'fixed inset-0', children: createElement('button', null, '저장'),
  }))
  const dialog = screen.getByRole('dialog', { name: '목표 추가' })
  expect(dialog.getAttribute('aria-modal')).toBe('true')

  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  vi.runAllTimers()
  expect(onClose).not.toHaveBeenCalled()

  fireEvent.keyDown(document, { key: 'Escape' })
  vi.runAllTimers()
  expect(onClose).toHaveBeenCalledOnce()
  vi.useRealTimers()
})
