import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../../lib/storage', () => ({ discardPendingSync: vi.fn(), hasPendingSync: () => false, isStorageConflictError: () => false }))
import { SyncStatusBar } from './SyncStatusBar'
import type { useSyncPersistence } from '../../hooks/useSyncPersistence'

afterEach(cleanup)

type Sync = ReturnType<typeof useSyncPersistence>
const base = {
  isOnline: true, hasPendingSync: false, failedPersistTasks: [], lastRetryReasons: {}, isRetryingPersist: false,
  retryProgress: null, lastSyncSuccessAt: null, syncClock: Date.now(), conflictKeys: [],
  getScopesByReasons: () => [], retryFailedPersistTasks: vi.fn(), showSyncStatusDetails: false,
  setShowSyncStatusDetails: vi.fn(), setShowSyncConflictModal: vi.fn(), setShowSyncRecoveryGuideModal: vi.fn(),
} as unknown as Sync

it('renders nothing while online with nothing pending', () => {
  const { container } = render(createElement(SyncStatusBar, { sync: base }))
  expect(container.textContent).toBe('')
})

it('explains the offline state with pending saves', () => {
  render(createElement(SyncStatusBar, { sync: { ...base, isOnline: false, hasPendingSync: true } as Sync }))
  expect(screen.getByText(/오프라인 · 저장 대기/)).toBeTruthy()
})
