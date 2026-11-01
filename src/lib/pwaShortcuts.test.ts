import { expect, it, vi } from 'vitest'
import { consumeEntryShortcut, pwaShortcuts } from './pwaShortcuts'

it('consumes only recognized shortcut actions and preserves unrelated URL state', () => {
  const history = { state: { saved: true }, replaceState: vi.fn() }
  expect(consumeEntryShortcut({ href: 'https://example.test/?action=income&from=home#today' }, history)).toBe('income')
  expect(history.replaceState).toHaveBeenCalledWith(history.state, '', '/?from=home#today')
  history.replaceState.mockClear()
  expect(consumeEntryShortcut({ href: 'https://example.test/?action=delete' }, history)).toBeNull()
  expect(history.replaceState).not.toHaveBeenCalled()
})

it('publishes manifest entries for each supported transaction type', () => {
  expect(pwaShortcuts.map(shortcut => new URL(shortcut.url, 'https://example.test').searchParams.get('action'))).toEqual(['expense', 'income'])
})
