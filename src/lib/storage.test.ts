import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../types'

vi.mock('../firebase/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
}))

import { getDoc, runTransaction } from 'firebase/firestore'
import {
  archiveTransactionsBefore,
  clearLocalData,
  getLocalStorageUsageBytes,
  hasLocalMigratableData,
  loadSettings,
  mergeLocalIntoFirebase,
  resetAllData,
  StorageConflictError,
  saveTransactions,
  setStorageContext,
} from './storage'

const TX: Transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 12000,
  category: '식비',
  description: '점심',
  date: '2026-06-01',
  createdAt: 1710000000000,
}

const MEMO = {
  id: 'memo-1',
  title: '메모',
  content: '내용',
  pinned: false,
  createdAt: 1710000000000,
  updatedAt: 1710000000000,
}

function writeDefaultSettings(overrides?: Record<string, unknown>) {
  localStorage.setItem('hb_settings', JSON.stringify({
    payday: null,
    cardBillingDay: null,
    userPaymentMethods: [],
    customExpenseCategories: [],
    customIncomeCategories: [],
    transactionTemplates: [],
    ...overrides,
  }))
}

describe('storage util', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setStorageContext('local')
  })

  it('로컬 캐시 플래그가 없으면 거래내역만 있어도 병합 대상이다', () => {
    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    expect(hasLocalMigratableData()).toBe(true)
  })

  it('Firebase 캐시 플래그가 있으면 거래내역만으로는 병합 대상이 아니다', () => {
    localStorage.setItem('hb_firebase_cache', 'true')
    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    expect(hasLocalMigratableData()).toBe(false)
  })

  it('Firebase 캐시 플래그가 있어도 메모 같은 사용자 데이터가 있으면 병합 대상이다', () => {
    localStorage.setItem('hb_firebase_cache', 'true')
    localStorage.setItem('hb_memos', JSON.stringify([MEMO]))
    expect(hasLocalMigratableData()).toBe(true)
  })

  it('clearLocalData는 주요 키를 정리하고 백업 키를 남긴다', () => {
    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    localStorage.setItem('hb_memos', JSON.stringify([MEMO]))
    localStorage.setItem('hb_firebase_cache', 'true')

    clearLocalData()

    expect(localStorage.getItem('hb_transactions')).toBeNull()
    expect(localStorage.getItem('hb_memos')).toBeNull()
    expect(localStorage.getItem('hb_firebase_cache')).toBeNull()

    const backupKeys = Object.keys(localStorage).filter((key) => key.startsWith('hb_backup_'))
    expect(backupKeys.length).toBeGreaterThan(0)
  })

  it('localStorage 사용량은 0보다 큰 바이트를 반환한다', () => {
    localStorage.setItem('hb_settings', JSON.stringify({ payday: 25 }))
    expect(getLocalStorageUsageBytes()).toBeGreaterThan(0)
  })

  it('loadSettings는 swipeSensitivity 기본값을 medium으로 보장한다', async () => {
    localStorage.setItem('hb_settings', JSON.stringify({ payday: 25 }))

    const settings = await loadSettings()
    expect(settings.swipeSensitivity).toBe('medium')
  })

  it('loadSettings는 잘못된 swipeSensitivity 값을 medium으로 보정한다', async () => {
    localStorage.setItem('hb_settings', JSON.stringify({ swipeSensitivity: 'invalid' }))

    const settings = await loadSettings()
    expect(settings.swipeSensitivity).toBe('medium')
  })

  it('mergeLocalIntoFirebase는 로컬/원격 데이터를 병합한 뒤 로컬 키를 정리한다', async () => {
    setStorageContext('firebase', 'uid-1')

    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    localStorage.setItem('hb_memos', JSON.stringify([MEMO]))
    writeDefaultSettings({ customExpenseCategories: ['간식'] })

    const remote = {
      transactions: [
        {
          ...TX,
          id: 'tx-remote',
          description: '저녁',
          date: '2026-06-03',
        },
      ],
      memos: [],
      budgets: [{ category: '식비', limit: 300000 }],
      recurring: [],
      subscriptions: [],
      goals: [],
      settings: {
        payday: 25,
        cardBillingDay: 25,
        userPaymentMethods: [],
        customExpenseCategories: [],
        customIncomeCategories: [],
        transactionTemplates: [],
      },
    }

    vi.mocked(getDoc).mockResolvedValue({
      data: () => remote,
    } as never)

    let committedPayload: Record<string, unknown> | null = null

    vi.mocked(runTransaction).mockImplementation(async (_db, updateFn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          data: () => ({
            ...remote,
            versions: {
              transactions: 0,
              memos: 0,
              budgets: 0,
              recurring: 0,
              subscriptions: 0,
              goals: 0,
              settings: 0,
            },
          }),
        }),
        set: vi.fn((_ref, payload) => {
          committedPayload = payload as Record<string, unknown>
        }),
      }

      await updateFn(tx as never)
    })

    const result = await mergeLocalIntoFirebase()

    expect(result.merged).toBe(true)
    expect(result.counts.transactions).toBe(2)
    expect(result.counts.memos).toBe(1)

    expect(committedPayload).not.toBeNull()
    if (!committedPayload) throw new Error('committed payload should exist')
    const payloadRecord = committedPayload as Record<string, unknown>
    expect((payloadRecord['transactions'] as unknown[]).length).toBe(2)
    expect((payloadRecord['memos'] as unknown[]).length).toBe(1)
    expect(((payloadRecord['settings'] as Record<string, unknown>)['customExpenseCategories'] as unknown[])).toEqual(['간식'])

    expect(localStorage.getItem('hb_transactions')).toBeNull()
    expect(localStorage.getItem('hb_memos')).toBeNull()
    expect(localStorage.getItem('hb_firebase_cache')).toBeNull()

    const backupKeys = Object.keys(localStorage).filter((key) => key.startsWith('hb_backup_'))
    expect(backupKeys.length).toBeGreaterThan(0)
  })

  it('archiveTransactionsBefore는 Firebase 저장 실패 시에도 로컬 삭제 후 pending_sync를 남긴다', async () => {
    setStorageContext('firebase', 'uid-1')

    localStorage.setItem('hb_transactions', JSON.stringify([
      { ...TX, id: 'tx-old', date: '2026-06-01' },
      { ...TX, id: 'tx-new', date: '2026-06-20' },
    ]))

    vi.mocked(runTransaction).mockRejectedValue(new Error('firebase down'))

    const removed = await archiveTransactionsBefore('2026-06-15')

    expect(removed).toBe(1)
    const saved = JSON.parse(localStorage.getItem('hb_transactions') ?? '[]')
    expect(saved).toHaveLength(1)
    expect(saved[0].id).toBe('tx-new')
    expect(localStorage.getItem('hb_pending_sync')).toBe('true')
  })

  it('saveTransactions는 충돌 오류 시 pending_sync를 남기고 로컬 데이터는 유지한다', async () => {
    setStorageContext('firebase', 'uid-1')

    const conflict = new StorageConflictError(
      ['transactions'],
      {
        transactions: 1,
        memos: 0,
        budgets: 0,
        recurring: 0,
        subscriptions: 0,
        goals: 0,
        settings: 0,
      },
      {
        transactions: 2,
        memos: 0,
        budgets: 0,
        recurring: 0,
        subscriptions: 0,
        goals: 0,
        settings: 0,
      },
    )

    vi.mocked(runTransaction).mockRejectedValue(conflict)

    await expect(saveTransactions([{ ...TX, id: 'tx-conflict' }])).rejects.toBe(conflict)

    const cached = JSON.parse(localStorage.getItem('hb_transactions') ?? '[]')
    expect(cached).toHaveLength(1)
    expect(cached[0].id).toBe('tx-conflict')
    expect(localStorage.getItem('hb_pending_sync')).toBe('true')
    expect(localStorage.getItem('hb_firebase_cache')).toBe('true')
  })

  it('mergeLocalIntoFirebase는 충돌 오류를 전달하고 로컬 데이터를 삭제하지 않는다', async () => {
    setStorageContext('firebase', 'uid-1')
    localStorage.setItem('hb_transactions', JSON.stringify([{ ...TX, id: 'tx-local-only' }]))
    writeDefaultSettings()

    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        transactions: [],
        memos: [],
        budgets: [],
        recurring: [],
        subscriptions: [],
        goals: [],
        settings: {
          payday: null,
          cardBillingDay: null,
          userPaymentMethods: [],
          customExpenseCategories: [],
          customIncomeCategories: [],
          transactionTemplates: [],
        },
      }),
    } as never)

    const conflict = new StorageConflictError(
      ['transactions'],
      {
        transactions: 0,
        memos: 0,
        budgets: 0,
        recurring: 0,
        subscriptions: 0,
        goals: 0,
        settings: 0,
      },
      {
        transactions: 1,
        memos: 0,
        budgets: 0,
        recurring: 0,
        subscriptions: 0,
        goals: 0,
        settings: 0,
      },
    )

    vi.mocked(runTransaction).mockRejectedValue(conflict)

    await expect(mergeLocalIntoFirebase()).rejects.toBe(conflict)
    expect(localStorage.getItem('hb_transactions')).not.toBeNull()
    expect(localStorage.getItem('hb_pending_sync')).toBe('true')
  })

  it('mergeLocalIntoFirebase는 원격 저장 실패 시 로컬을 병합된(원격+로컬) 데이터로 갱신한다', async () => {
    setStorageContext('firebase', 'uid-1')
    localStorage.setItem('hb_transactions', JSON.stringify([{ ...TX, id: 'tx-local-only' }]))
    writeDefaultSettings()

    const remoteTx = { ...TX, id: 'tx-remote-only', description: '저녁', date: '2026-06-03' }
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        transactions: [remoteTx],
        memos: [],
        budgets: [],
        recurring: [],
        subscriptions: [],
        goals: [],
        settings: {
          payday: null,
          cardBillingDay: null,
          userPaymentMethods: [],
          customExpenseCategories: [],
          customIncomeCategories: [],
          transactionTemplates: [],
        },
      }),
    } as never)

    // 병합 자체(트랜잭션 읽기)는 성공하지만, 최종 원격 쓰기(runTransaction)가 네트워크 문제로 실패하는 상황
    vi.mocked(runTransaction).mockRejectedValue(new Error('network down'))

    await expect(mergeLocalIntoFirebase()).rejects.toThrow('network down')

    // 실패 이전의 "로컬 전용" 스냅샷이 아니라, 원격+로컬이 합쳐진 스냅샷이 로컬에 남아야
    // 이후 pending_sync 재시도가 원격 데이터를 로컬-only 값으로 덮어쓰지 않는다.
    const saved = JSON.parse(localStorage.getItem('hb_transactions') ?? '[]')
    expect(saved).toHaveLength(2)
    expect(saved.map((t: Transaction) => t.id).sort()).toEqual(['tx-local-only', 'tx-remote-only'])
    expect(localStorage.getItem('hb_pending_sync')).toBe('true')
  })

  it('resetAllData(로컬 모드)는 모든 키를 지우고 백업 키를 남기지 않는다', async () => {
    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    localStorage.setItem('hb_memos', JSON.stringify([MEMO]))
    localStorage.setItem('hb_budgets', JSON.stringify([{ category: '식비', limit: 100000 }]))
    localStorage.setItem('hb_recurring', JSON.stringify([]))
    localStorage.setItem('hb_subscriptions', JSON.stringify([]))
    localStorage.setItem('hb_goals', JSON.stringify([]))
    writeDefaultSettings({ customExpenseCategories: ['간식'] })
    localStorage.setItem('hb_firebase_cache', 'true')
    localStorage.setItem('hb_pending_sync', 'true')

    await resetAllData()

    expect(localStorage.getItem('hb_transactions')).toBeNull()
    expect(localStorage.getItem('hb_memos')).toBeNull()
    expect(localStorage.getItem('hb_budgets')).toBeNull()
    expect(localStorage.getItem('hb_recurring')).toBeNull()
    expect(localStorage.getItem('hb_subscriptions')).toBeNull()
    expect(localStorage.getItem('hb_goals')).toBeNull()
    expect(localStorage.getItem('hb_settings')).toBeNull()
    expect(localStorage.getItem('hb_firebase_cache')).toBeNull()
    expect(localStorage.getItem('hb_pending_sync')).toBeNull()

    const backupKeys = Object.keys(localStorage).filter((key) => key.startsWith('hb_backup_'))
    expect(backupKeys).toHaveLength(0)

    const settings = await loadSettings()
    expect(settings.customExpenseCategories).toEqual([])
  })

  it('resetAllData(Firebase 모드)는 모든 필드를 빈 값으로 덮어쓰고 충돌 없이 커밋된다', async () => {
    setStorageContext('firebase', 'uid-1')
    localStorage.setItem('hb_transactions', JSON.stringify([TX]))
    writeDefaultSettings({ customExpenseCategories: ['간식'] })

    let committedPayload: Record<string, unknown> | null = null

    vi.mocked(runTransaction).mockImplementation(async (_db, updateFn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          data: () => ({
            transactions: [TX],
            versions: {
              transactions: 3,
              memos: 1,
              budgets: 0,
              recurring: 0,
              subscriptions: 0,
              goals: 0,
              settings: 2,
            },
          }),
        }),
        set: vi.fn((_ref, payload) => {
          committedPayload = payload as Record<string, unknown>
        }),
      }

      await updateFn(tx as never)
    })

    await expect(resetAllData()).resolves.toBeUndefined()

    expect(committedPayload).not.toBeNull()
    if (!committedPayload) throw new Error('committed payload should exist')
    const payloadRecord = committedPayload as Record<string, unknown>
    expect(payloadRecord['transactions']).toEqual([])
    expect(payloadRecord['memos']).toEqual([])
    expect(payloadRecord['budgets']).toEqual([])
    expect(payloadRecord['recurring']).toEqual([])
    expect(payloadRecord['subscriptions']).toEqual([])
    expect(payloadRecord['goals']).toEqual([])
    expect((payloadRecord['settings'] as Record<string, unknown>)['customExpenseCategories']).toEqual([])

    expect(localStorage.getItem('hb_transactions')).toBeNull()
    expect(localStorage.getItem('hb_settings')).toBeNull()
  })
})
