import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('../firebase/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), getDocFromServer: vi.fn(), runTransaction: vi.fn() }))
import { getDocFromServer, runTransaction } from 'firebase/firestore'
import { loadAllData, loadBackupState, restoreAllData, saveTransactions, setStorageContext, VERSION_KEYS } from './storage'
import { backupFixture } from '../test/backupFixture'

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); setStorageContext('local') })

it('replaces all local sections and preserves unrelated device preferences', async () => {
  localStorage.setItem('hb_theme', 'dark')
  const before = await loadBackupState()
  const data = backupFixture()
  expect(await restoreAllData(data, before.token)).toEqual({ data, cacheSaved: true })
  expect(await loadAllData()).toEqual(data)
  expect(localStorage.getItem('hb_restore_journal_v1')).toBeNull()
  expect(localStorage.getItem('hb_theme')).toBe('dark')
})

it('rejects a stale local preview, changed account, and invalid data before writing', async () => {
  const before = await loadBackupState()
  await saveTransactions(backupFixture().transactions)
  await expect(restoreAllData(backupFixture(), before.token)).rejects.toThrow('바뀌었어요')
  const current = await loadBackupState()
  setStorageContext('firebase', 'other')
  await expect(restoreAllData(backupFixture(), current.token)).rejects.toThrow('계정')
  await expect(restoreAllData({ ...backupFixture(), memos: undefined } as never, current.token)).rejects.toThrow('memos')
  expect(runTransaction).not.toHaveBeenCalled()
})

it('rolls back every original value when a local write fails halfway through', async () => {
  localStorage.setItem('hb_transactions', '[]')
  const before = await loadBackupState()
  const original = { ...localStorage }
  const set = Storage.prototype.setItem
  let failed = false
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'hb_budgets' && !failed) { failed = true; throw new DOMException('full', 'QuotaExceededError') }
    return set.call(this, key, value)
  })
  await expect(restoreAllData(backupFixture(), before.token)).rejects.toThrow('full')
  expect({ ...localStorage }).toEqual(original)
  expect((await loadAllData()).transactions).toEqual([])
})

it('aborts without mutation if a rollback journal cannot be stored', async () => {
  const before = await loadBackupState()
  const set = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'hb_restore_journal_v1') throw new Error('journal full')
    return set.call(this, key, value)
  })
  await expect(restoreAllData(backupFixture(), before.token)).rejects.toThrow('journal full')
  expect(localStorage.length).toBe(0)
})

it('recovers an interrupted replacement before the next ordinary read or save', async () => {
  const keys = ['hb_transactions', 'hb_memos', 'hb_budgets', 'hb_recurring', 'hb_subscriptions', 'hb_goals', 'hb_settings', 'hb_pending_sync', 'hb_firebase_cache']
  localStorage.setItem('hb_restore_journal_v1', JSON.stringify(Object.fromEntries(keys.map(k => [k, k === 'hb_transactions' ? '[]' : null]))))
  localStorage.setItem('hb_transactions', JSON.stringify(backupFixture().transactions))
  localStorage.setItem('hb_budgets', JSON.stringify(backupFixture().budgets))
  expect((await loadAllData()).transactions).toEqual([])
  expect(localStorage.getItem('hb_budgets')).toBeNull()
  expect(localStorage.getItem('hb_restore_journal_v1')).toBeNull()
})

function serverPreview() {
  const data = backupFixture()
  const versions = Object.fromEntries(VERSION_KEYS.map(key => [key, 3]))
  const raw = { ...data, versions }
  vi.mocked(getDocFromServer).mockResolvedValue({ data: () => raw } as never)
  setStorageContext('firebase', 'uid')
  return raw
}

it('replaces all server sections in one version-checked transaction then updates the cache', async () => {
  const raw = serverPreview()
  const preview = await loadBackupState()
  const set = vi.fn()
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ data: () => raw }), set } as never))
  const data = { ...backupFixture(), transactions: [] }
  await restoreAllData(data, preview.token)
  expect(runTransaction).toHaveBeenCalledTimes(1)
  const patch = set.mock.calls[0][1]
  expect(set.mock.calls[0][2]).toEqual({ mergeFields: [...VERSION_KEYS, 'versions', 'updatedAt'] })
  for (const key of VERSION_KEYS) { expect(patch[key]).toEqual(data[key]); expect(patch.versions[key]).toBe(4) }
  expect(localStorage.getItem('hb_transactions')).toBe('[]')
  expect(localStorage.getItem('hb_firebase_cache')).toBe('true')
  expect(localStorage.getItem('hb_pending_sync')).toBeNull()
})

it.each(['version', 'unversioned-content', 'offline'])('keeps local data and pending-sync flag untouched after %s failure', async reason => {
  const raw = serverPreview()
  const preview = await loadBackupState()
  const original = JSON.stringify(backupFixture().transactions)
  localStorage.setItem('hb_transactions', original)
  const set = vi.fn()
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
    if (reason === 'offline') throw new Error('offline')
    const changed = reason === 'version' ? { ...raw, versions: { ...raw.versions, goals: 4 } } : { ...raw, goals: [] }
    return callback({ get: async () => ({ data: () => changed }), set } as never)
  })
  await expect(restoreAllData(backupFixture(), preview.token)).rejects.toThrow()
  expect(set).not.toHaveBeenCalled()
  expect(localStorage.getItem('hb_transactions')).toBe(original)
  expect(localStorage.getItem('hb_pending_sync')).toBeNull()
})

it('requires a successful server read and refuses unsynced writes for a server preview', async () => {
  serverPreview()
  localStorage.setItem('hb_pending_sync', 'true')
  await expect(loadBackupState()).rejects.toThrow('동기화')
  expect(getDocFromServer).not.toHaveBeenCalled()
  localStorage.removeItem('hb_pending_sync')
  vi.mocked(getDocFromServer).mockRejectedValue(new Error('offline'))
  await expect(loadBackupState()).rejects.toThrow('offline')
  expect(runTransaction).not.toHaveBeenCalled()
})

it('does not silently omit malformed saved local records from a full backup', async () => {
  localStorage.setItem('hb_transactions', '[{"id":"broken"}]')
  await expect(loadBackupState()).rejects.toThrow('data.transactions')
})

it('reports a successful server commit even when the optional local cache cannot be updated', async () => {
  const raw = serverPreview()
  const preview = await loadBackupState()
  const set = vi.fn()
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ data: () => raw }), set } as never))
  const originalSet = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'hb_restore_journal_v1') throw new Error('full')
    return originalSet.call(this, key, value)
  })
  expect((await restoreAllData(backupFixture(), preview.token)).cacheSaved).toBe(false)
  expect(set).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem('hb_pending_sync')).toBeNull()
})

it('blocks concurrent ordinary writes during a server replacement', async () => {
  const raw = serverPreview()
  const preview = await loadBackupState()
  let finish!: () => void
  const paused = new Promise<void>(resolve => { finish = resolve })
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => { await paused; return callback({ get: async () => ({ data: () => raw }), set: vi.fn() } as never) })
  const restoring = restoreAllData(backupFixture(), preview.token)
  await expect(saveTransactions([])).rejects.toThrow('복원이 진행 중')
  await expect(loadBackupState()).rejects.toThrow('동기화')
  finish(); await restoring
})
