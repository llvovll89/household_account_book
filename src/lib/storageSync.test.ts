import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memo, Transaction } from '../types'

vi.mock('../firebase/firebase', () => ({ db: {} }))

// 원격 문서 하나를 메모리에 두고 Firestore 트랜잭션을 흉내 낸다
const remote = vi.hoisted(() => ({ doc: undefined as Record<string, unknown> | undefined, online: true }))

vi.mock('firebase/firestore', () => {
  const read = () => {
    if (!remote.online) throw new Error('offline')
    const snapshot = remote.doc === undefined ? undefined : structuredClone(remote.doc)
    return { data: () => snapshot }
  }
  return {
    doc: vi.fn(),
    getDoc: vi.fn(async () => read()),
    getDocFromServer: vi.fn(async () => read()),
    runTransaction: vi.fn(async (_db: unknown, fn: (tx: unknown) => Promise<void>) => {
      if (!remote.online) throw new Error('offline')
      const box: { written?: Record<string, unknown> } = {}
      await fn({
        get: async () => read(),
        set: (_ref: unknown, payload: Record<string, unknown>) => { box.written = payload },
      })
      if (box.written) remote.doc = { ...(remote.doc ?? {}), ...structuredClone(box.written) }
    }),
  }
})

import {
  clearFirebaseCacheOnSignOut,
  clearLocalData,
  discardPendingSync,
  hasPendingSync,
  loadAllData,
  loadSettings,
  mergeLocalIntoFirebase,
  resetAllData,
  saveMemos,
  saveTransactions,
  setStorageContext,
} from './storage'

const TX: Transaction = { id: 'tx-1', type: 'expense', amount: 5000, category: '식비', description: '커피', date: '2026-11-01', createdAt: 1 }
const MEMO: Memo = { id: 'memo-1', title: '메모', content: '원격 메모', pinned: false, createdAt: 1, updatedAt: 1 }
const VERSIONS = { transactions: 1, memos: 1, budgets: 0, recurring: 0, subscriptions: 0, goals: 0, settings: 1 }

function seedRemote(overrides: Record<string, unknown> = {}) {
  remote.doc = {
    transactions: [],
    memos: [MEMO],
    budgets: [],
    recurring: [],
    subscriptions: [],
    goals: [],
    settings: { payday: 25, customExpenseCategories: ['간식'] },
    versions: { ...VERSIONS },
    ...overrides,
  }
}

function restartApp(uid = 'uid-a') {
  setStorageContext('firebase', uid)
}

beforeEach(() => {
  localStorage.clear()
  remote.online = true
  remote.doc = undefined
  setStorageContext('local')
})

describe('pending sync retry', () => {
  it('pushes only the keys that failed and keeps untouched remote keys', async () => {
    seedRemote()
    restartApp()
    await loadAllData()

    remote.online = false
    await expect(saveTransactions([TX])).rejects.toThrow('offline')
    expect(hasPendingSync()).toBe(true)

    remote.online = true
    restartApp()
    const data = await loadAllData()

    expect(remote.doc?.transactions).toEqual([TX])
    expect(remote.doc?.memos).toEqual([MEMO])
    expect(remote.doc?.settings).toMatchObject({ payday: 25, customExpenseCategories: ['간식'] })
    expect(data.memos).toEqual([MEMO])
    expect(data.settings.payday).toBe(25)
    expect(hasPendingSync()).toBe(false)
  })

  it('does not overwrite newer remote data when the pending key conflicts', async () => {
    seedRemote({ transactions: [] })
    restartApp()
    await loadAllData()

    remote.online = false
    await expect(saveTransactions([TX])).rejects.toThrow('offline')

    // 다른 기기가 그 사이 거래를 추가
    const otherDevice = { ...TX, id: 'tx-other', description: '다른 기기' }
    remote.online = true
    remote.doc = { ...remote.doc, transactions: [otherDevice], versions: { ...VERSIONS, transactions: 2 } }

    restartApp()
    const data = await loadAllData()

    expect(remote.doc?.transactions).toEqual([otherDevice])
    expect(data.transactions).toEqual([otherDevice])
    expect(hasPendingSync()).toBe(false)
    const backup = Object.keys(localStorage).find(key => key.startsWith('hb_backup_') && key.endsWith('hb_transactions'))
    expect(backup && JSON.parse(localStorage.getItem(backup)!)).toEqual([TX])
  })

  it('ignores a pending record that belongs to another account', async () => {
    seedRemote()
    restartApp('uid-a')
    await loadAllData()
    remote.online = false
    await expect(saveTransactions([TX])).rejects.toThrow('offline')

    remote.online = true
    seedRemote()
    restartApp('uid-b')
    await loadAllData()

    expect(remote.doc?.transactions).toEqual([])
  })

  it('treats the legacy boolean flag as unsafe: backs up local data instead of pushing it', async () => {
    seedRemote()
    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    localStorage.setItem('hb_pending_sync', 'true')

    restartApp()
    const data = await loadAllData()

    expect(remote.doc?.memos).toEqual([MEMO])
    expect(remote.doc?.transactions).toEqual([])
    expect(data.memos).toEqual([MEMO])
    expect(hasPendingSync()).toBe(false)
  })

  it('discardPendingSync lets "use remote data" load the remote state', async () => {
    seedRemote()
    restartApp()
    await loadAllData()
    remote.online = false
    await expect(saveTransactions([TX])).rejects.toThrow('offline')
    remote.online = true

    discardPendingSync()
    const data = await loadAllData()

    expect(data.transactions).toEqual([])
    expect(remote.doc?.transactions).toEqual([])
  })
})

describe('local data lifecycle', () => {
  it('clearLocalData also clears a stale pending record so nothing empty is pushed', async () => {
    seedRemote({ transactions: [TX] })
    restartApp()
    await loadAllData()
    remote.online = false
    await expect(saveMemos([])).rejects.toThrow('offline')
    remote.online = true

    clearLocalData()
    const data = await loadAllData()

    expect(hasPendingSync()).toBe(false)
    expect(remote.doc?.memos).toEqual([MEMO])
    expect(data.transactions).toEqual([TX])
  })

  it('clears the Firebase cache on sign-out but keeps data created in local mode', async () => {
    seedRemote()
    restartApp()
    await loadAllData()
    await saveTransactions([TX])

    clearFirebaseCacheOnSignOut()
    setStorageContext('local')
    expect((await loadAllData()).transactions).toEqual([])

    await saveTransactions([{ ...TX, id: 'local-only' }])
    clearFirebaseCacheOnSignOut()
    expect((await loadAllData()).transactions.map(t => t.id)).toEqual(['local-only'])
  })
})

describe('merge and optimistic locking', () => {
  it('keeps remote transactions with identical content but different ids', async () => {
    const coffeeA = { ...TX, id: 'a' }
    const coffeeB = { ...TX, id: 'b' }
    seedRemote({ transactions: [coffeeA, coffeeB] })
    localStorage.setItem('hb_transactions', JSON.stringify([{ ...TX, id: 'local', description: '점심' }]))

    restartApp()
    await mergeLocalIntoFirebase()

    expect((remote.doc?.transactions as Transaction[]).map(t => t.id).sort()).toEqual(['a', 'b', 'local'])
  })

  it('still drops a local copy that duplicates a remote transaction', async () => {
    seedRemote({ transactions: [{ ...TX, id: 'remote' }] })
    localStorage.setItem('hb_transactions', JSON.stringify([{ ...TX, id: 'local-copy' }]))

    restartApp()
    await mergeLocalIntoFirebase()

    expect((remote.doc?.transactions as Transaction[]).map(t => t.id)).toEqual(['remote'])
  })

  it('a partial load does not refresh the base version of other keys', async () => {
    seedRemote()
    restartApp()
    await loadAllData()

    // 다른 기기가 메모를 추가
    remote.doc = { ...remote.doc, memos: [MEMO, { ...MEMO, id: 'memo-2' }], versions: { ...VERSIONS, memos: 2 } }

    await loadSettings()
    await expect(saveMemos([{ ...MEMO, content: '오래된 화면에서 편집' }])).rejects.toMatchObject({ name: 'StorageConflictError' })
    expect((remote.doc?.memos as Memo[]).map(m => m.id)).toEqual(['memo-1', 'memo-2'])
  })
})

describe('resetAllData in Firebase mode', () => {
  it('keeps local data and leaves no pending record when the remote reset fails', async () => {
    seedRemote({ transactions: [TX] })
    restartApp()
    await loadAllData()
    await saveTransactions([TX])

    remote.online = false
    await expect(resetAllData()).rejects.toThrow()

    expect(JSON.parse(localStorage.getItem('hb_transactions')!)).toEqual([TX])
    expect(hasPendingSync()).toBe(false)
  })
})
