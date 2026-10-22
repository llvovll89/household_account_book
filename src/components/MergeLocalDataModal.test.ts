import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MergeLocalDataModal from './MergeLocalDataModal'

afterEach(cleanup)
const counts = { transactions: 1, memos: 0, budgets: 0, recurring: 0, subscriptions: 0, goals: 0 }

it('does not discard local records on Escape or backdrop clicks', async () => {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  render(createElement(MergeLocalDataModal, { counts, onCancel, onConfirm }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '병합하기' })))
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByRole('dialog'))
  expect(onCancel).not.toHaveBeenCalled()
  expect(onConfirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '삭제 후 계속' }))
  expect(onCancel).toHaveBeenCalledOnce()
})

it('only merges when the merge action is selected', () => {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  render(createElement(MergeLocalDataModal, { counts, onCancel, onConfirm }))
  fireEvent.click(screen.getByRole('button', { name: '병합하기' }))
  expect(onConfirm).toHaveBeenCalledOnce()
  expect(onCancel).not.toHaveBeenCalled()
})
