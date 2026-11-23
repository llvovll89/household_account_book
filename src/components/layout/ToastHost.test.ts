import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ToastHost } from './ToastHost'
import { showToast } from '../../lib/toast'

afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows a toast, runs its action and hides after the duration', () => {
  vi.useFakeTimers()
  render(createElement(ToastHost))
  const undo = vi.fn()
  act(() => showToast('삭제했어요', 3000, 'info', { label: '실행 취소', onClick: undo }))
  expect(screen.getByRole('status').textContent).toContain('삭제했어요')
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }))
  expect(undo).toHaveBeenCalled()
  expect(screen.queryByRole('status')).toBeNull()
  act(() => showToast('저장 실패', 1000, 'error'))
  expect(screen.getByRole('alert')).toBeTruthy()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('alert')).toBeNull()
})
