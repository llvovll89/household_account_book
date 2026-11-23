import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../lib/storage', () => ({
  discardPendingSync: vi.fn(),
  hasPendingSync: vi.fn(() => false),
  isStorageConflictError: (e: unknown) => e instanceof Error && e.message === 'conflict',
}))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))

import { useSyncPersistence } from './useSyncPersistence'
import { showToast } from '../lib/toast'

beforeEach(() => { localStorage.clear(); vi.mocked(showToast).mockClear() })

it('queues a failed save, marks pending sync, and clears it after a successful retry', async () => {
  const hydrateData = vi.fn(async () => {})
  const { result } = renderHook(() => useSyncPersistence({ hydrateData }))
  let attempts = 0
  const task = vi.fn(async () => { attempts += 1; if (attempts === 1) throw new Error('offline') })

  act(() => result.current.persist(task, '거래 저장에 실패했습니다.', 'transactions'))
  await waitFor(() => {
    expect(result.current.failedPersistTasks).toHaveLength(1)
    expect(result.current.hasPendingSync).toBe(true)
  })
  expect(showToast).toHaveBeenCalledWith('거래 저장에 실패했습니다.')

  act(() => result.current.retryFailedPersistTasks())
  // 재시도 결과는 여러 상태 갱신으로 나뉘어 반영되므로 모두 끝날 때까지 기다린다
  await waitFor(() => {
    expect(result.current.failedPersistTasks).toHaveLength(0)
    expect(result.current.hasPendingSync).toBe(false)
    expect(result.current.lastSyncSuccessAt).not.toBeNull()
  })
  expect(task).toHaveBeenCalledTimes(2)
})

it('opens the conflict modal with the conflicting scopes', async () => {
  const { result } = renderHook(() => useSyncPersistence({ hydrateData: vi.fn(async () => {}) }))
  const conflict = Object.assign(new Error('conflict'), { conflictKeys: ['budgets'], expectedVersions: {}, remoteVersions: {}, countDiffs: {}, remoteUpdatedAt: null })
  act(() => result.current.persist(async () => { throw conflict }, '예산 저장 실패', 'budgets'))
  await waitFor(() => expect(result.current.showSyncConflictModal).toBe(true))
  expect(result.current.conflictKeys).toEqual(['budgets'])
})
