import { doc, getDoc, getDocFromServer, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { AutoCategoryRule, Budget, DashboardWidgetId, Memo, RecurringTransaction, SavingsGoal, Subscription, Transaction, UserPaymentMethod } from '../types'
import { showToast } from './toast'
import { validateBackupData } from './backup'

function safeSave(key: string, value: unknown): void {
  if (!internalRestore) {
    if (restoreInProgress) throw new Error('백업 복원이 진행 중이에요. 완료 후 다시 저장해주세요.')
    recoverInterruptedRestore()
  }
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      showToast('저장 공간이 부족합니다. 오래된 내역을 삭제하거나 CSV로 내보낸 후 정리해주세요.', 5000, 'error')
    }
    throw e
  }
}

const TRANSACTIONS_KEY = 'hb_transactions'
const MEMOS_KEY = 'hb_memos'
const BUDGETS_KEY = 'hb_budgets'
const RECURRING_KEY = 'hb_recurring'
const SUBSCRIPTIONS_KEY = 'hb_subscriptions'
const GOALS_KEY = 'hb_goals'
const SETTINGS_KEY = 'hb_settings'
// Firebase 저장 실패 시 동기화되지 않은 계정·키·기준 버전을 기록 (구형 값은 'true')
const PENDING_SYNC_KEY = 'hb_pending_sync'
// Firebase 모드에서 폴백 용도로 저장한 로컬 캐시 여부를 표시
const FIREBASE_CACHE_KEY = 'hb_firebase_cache'
const RESTORE_JOURNAL_KEY = 'hb_restore_journal_v1'
const SNAPSHOT_LOCAL_KEYS = [TRANSACTIONS_KEY, MEMOS_KEY, BUDGETS_KEY, RECURRING_KEY, SUBSCRIPTIONS_KEY, GOALS_KEY, SETTINGS_KEY] as const
const RESTORE_LOCAL_KEYS = [...SNAPSHOT_LOCAL_KEYS, PENDING_SYNC_KEY, FIREBASE_CACHE_KEY]
let internalRestore = false
let restoreInProgress = false
let remoteWritesInFlight = 0

/** Roll back an interrupted multi-key replacement before exposing or writing local data. */
function recoverInterruptedRestore(): void {
  if (internalRestore) return
  const raw = localStorage.getItem(RESTORE_JOURNAL_KEY)
  if (!raw) return
  const journal: unknown = JSON.parse(raw)
  if (!journal || typeof journal !== 'object' || Array.isArray(journal)) throw new Error('복원 복구 기록을 읽을 수 없어요.')
  const values = journal as Record<string, unknown>
  for (const key of RESTORE_LOCAL_KEYS) {
    if (values[key] !== null && typeof values[key] !== 'string') throw new Error('복원 복구 기록이 올바르지 않아요.')
  }
  for (const key of RESTORE_LOCAL_KEYS) {
    if (values[key] === null) localStorage.removeItem(key)
    else localStorage.setItem(key, values[key] as string)
  }
  localStorage.removeItem(RESTORE_JOURNAL_KEY)
}

function replaceLocalSnapshot(state: AppDataSnapshot, firebaseCache: boolean): void {
  recoverInterruptedRestore()
  const original = Object.fromEntries(RESTORE_LOCAL_KEYS.map(key => [key, localStorage.getItem(key)]))
  // If there is no room for a rollback journal, abort without changing any data.
  localStorage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(original))
  internalRestore = true
  try {
    writeLocalSnapshot(state)
    localStorage.removeItem(PENDING_SYNC_KEY)
    if (firebaseCache) localStorage.setItem(FIREBASE_CACHE_KEY, 'true')
    else localStorage.removeItem(FIREBASE_CACHE_KEY)
    localStorage.removeItem(RESTORE_JOURNAL_KEY)
  } catch (error) {
    internalRestore = false
    try { recoverInterruptedRestore() } catch { /* Leave the journal for recovery on the next read. */ }
    throw error
  } finally { internalRestore = false }
}
// 오프라인 등으로 Firestore 요청이 무한 대기하는 것을 막기 위한 최대 대기 시간
const REMOTE_WRITE_TIMEOUT_MS = 9000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('remote-write-timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      }
    )
  })
}

type StorageMode = 'local' | 'firebase'

export type SwipeSensitivity = 'low' | 'medium' | 'high'

export interface AppSettings {
  payday: number | 'last' | null
  cardBillingDay: number | null
  userPaymentMethods: UserPaymentMethod[]
  customExpenseCategories: string[]
  customIncomeCategories: string[]
  transactionTemplates: import('../types').TransactionTemplate[]
  swipeSensitivity?: SwipeSensitivity
  autoCategoryRules: AutoCategoryRule[]
  hiddenWidgets: DashboardWidgetId[]
}

interface RemoteState {
  transactions: Transaction[]
  memos: Memo[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  subscriptions: Subscription[]
  goals: SavingsGoal[]
  settings: AppSettings
}

export const VERSION_KEYS = ['transactions', 'memos', 'budgets', 'recurring', 'subscriptions', 'goals', 'settings'] as const
export type RemoteVersionKey = (typeof VERSION_KEYS)[number]
type RemoteVersions = Record<RemoteVersionKey, number>
type ConflictCountDiff = Partial<Record<RemoteVersionKey, { localCount: number | null; remoteCount: number | null }>>

function valueCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length
  return null
}

export class StorageConflictError extends Error {
  conflictKeys: RemoteVersionKey[]
  expectedVersions: RemoteVersions
  remoteVersions: RemoteVersions
  countDiffs: ConflictCountDiff
  remoteUpdatedAt: number | null

  constructor(
    conflictKeys: RemoteVersionKey[],
    expectedVersions: RemoteVersions,
    remoteVersions: RemoteVersions,
    countDiffs: ConflictCountDiff = {},
    remoteUpdatedAt: number | null = null,
  ) {
    super('remote-data-conflict')
    this.name = 'StorageConflictError'
    this.conflictKeys = conflictKeys
    this.expectedVersions = expectedVersions
    this.remoteVersions = remoteVersions
    this.countDiffs = countDiffs
    this.remoteUpdatedAt = remoteUpdatedAt
  }
}

export function isStorageConflictError(error: unknown): error is StorageConflictError {
  return error instanceof StorageConflictError
}

export interface AppDataSnapshot {
  transactions: Transaction[]
  memos: Memo[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  subscriptions: Subscription[]
  goals: SavingsGoal[]
  settings: AppSettings
}

interface MergeResult {
  merged: boolean
  message: string
  counts: {
    transactions: number
    memos: number
    budgets: number
    recurring: number
    subscriptions: number
    goals: number
  }
}

let storageMode: StorageMode = 'local'
let storageUid: string | null = null
let cachedRemoteVersions: RemoteVersions | null = null

function emptyVersions(): RemoteVersions {
  return {
    transactions: 0,
    memos: 0,
    budgets: 0,
    recurring: 0,
    subscriptions: 0,
    goals: 0,
    settings: 0,
  }
}

function normalizeVersions(raw: unknown): RemoteVersions {
  const base = emptyVersions()
  if (!raw || typeof raw !== 'object') return base

  const obj = raw as Record<string, unknown>
  for (const key of VERSION_KEYS) {
    const value = obj[key]
    base[key] = Number.isInteger(value) ? Number(value) : 0
  }
  return base
}

interface PendingSync {
  uid: string
  keys: RemoteVersionKey[]
  // 저장 실패 시점에 알고 있던 원격 버전. 재전송은 이 버전과 같을 때만 커밋한다
  base: Partial<RemoteVersions>
}

function readPendingSync(): PendingSync | 'legacy' | null {
  const raw = localStorage.getItem(PENDING_SYNC_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isObj(parsed) && typeof parsed.uid === 'string' && Array.isArray(parsed.keys)) {
      const keys = parsed.keys as unknown[]
      const base: Partial<RemoteVersions> = {}
      if (isObj(parsed.base)) {
        for (const key of VERSION_KEYS) {
          if (Number.isInteger(parsed.base[key])) base[key] = Number(parsed.base[key])
        }
      }
      return { uid: parsed.uid, keys: VERSION_KEYS.filter((key) => keys.includes(key)), base }
    }
  } catch { /* 구형 플래그 */ }
  return 'legacy'
}

function markPendingSync(uid: string, keys: RemoteVersionKey[]): void {
  const current = readPendingSync()
  const same = current && current !== 'legacy' && current.uid === uid ? current : null
  const base: Partial<RemoteVersions> = { ...same?.base }
  for (const key of keys) {
    if (same?.keys.includes(key)) continue
    if (cachedRemoteVersions) base[key] = cachedRemoteVersions[key]
  }
  const next: PendingSync = {
    uid,
    keys: VERSION_KEYS.filter((key) => keys.includes(key) || !!same?.keys.includes(key)),
    base,
  }
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(next))
}

function clearPendingKeys(uid: string, keys: RemoteVersionKey[]): void {
  const current = readPendingSync()
  if (!current || current === 'legacy' || current.uid !== uid) return
  const rest = current.keys.filter((key) => !keys.includes(key))
  if (rest.length === 0) localStorage.removeItem(PENDING_SYNC_KEY)
  else localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ ...current, keys: rest }))
}

export function hasPendingSync(): boolean {
  return localStorage.getItem(PENDING_SYNC_KEY) !== null
}

/** 사용자가 원격 데이터를 선택했을 때 미동기화 기록을 버린다 */
export function discardPendingSync(): void {
  localStorage.removeItem(PENDING_SYNC_KEY)
}

function extractPatchKeys(patch: Partial<RemoteState>): RemoteVersionKey[] {
  return VERSION_KEYS.filter((key) => key in patch)
}

function emitSettingsUpdatedEvent(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hb-settings-updated'))
}

const DEFAULT_SETTINGS: AppSettings = {
  payday: null,
  cardBillingDay: null,
  userPaymentMethods: [],
  customExpenseCategories: [],
  customIncomeCategories: [],
  transactionTemplates: [],
  swipeSensitivity: 'medium',
  autoCategoryRules: [],
  hiddenWidgets: [],
}

function migrateSettings(settings: AppSettings): AppSettings {
  const normalizedSensitivity: SwipeSensitivity =
    settings.swipeSensitivity === 'low' || settings.swipeSensitivity === 'medium' || settings.swipeSensitivity === 'high'
      ? settings.swipeSensitivity
      : 'medium'

  if (!Array.isArray(settings.userPaymentMethods) || settings.userPaymentMethods.length === 0) {
    const billingDay = settings.cardBillingDay ?? 25
    return {
      ...settings,
      swipeSensitivity: normalizedSensitivity,
      userPaymentMethods: [
        { id: 'cash', type: 'cash', label: '현금' },
        { id: 'check_1', type: 'check', label: '체크카드' },
        { id: 'credit_1', type: 'credit', label: '신용카드', billingDay },
      ],
    }
  }
  return {
    ...settings,
    swipeSensitivity: normalizedSensitivity,
  }
}

function parseJSON<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

// 배열 파싱 + 아이템 단위 검증: 손상된 항목만 버리고 나머지는 살린다
function parseValidArray<T>(key: string, guard: (item: unknown) => item is T): T[] {
  recoverInterruptedRestore()
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(guard)
  } catch {
    return []
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function isTransaction(v: unknown): v is Transaction {
  if (!isObj(v)) return false
  return (
    typeof v.id === 'string' &&
    (v.type === 'income' || v.type === 'expense') &&
    typeof v.amount === 'number' && v.amount >= 0 &&
    typeof v.category === 'string' &&
    typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.date as string)
  )
}

function isMemo(v: unknown): v is Memo {
  if (!isObj(v)) return false
  return typeof v.id === 'string' && typeof v.title === 'string' && typeof v.content === 'string'
}

function isBudget(v: unknown): v is Budget {
  if (!isObj(v)) return false
  return typeof v.category === 'string' && typeof v.limit === 'number'
}

function isRecurring(v: unknown): v is RecurringTransaction {
  if (!isObj(v)) return false
  return (
    typeof v.id === 'string' &&
    (v.type === 'income' || v.type === 'expense') &&
    typeof v.amount === 'number' &&
    typeof v.dayOfMonth === 'number'
  )
}

function isSubscription(v: unknown): v is Subscription {
  if (!isObj(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.amount === 'number' &&
    typeof v.billingDay === 'number'
  )
}

function isSavingsGoal(v: unknown): v is SavingsGoal {
  if (!isObj(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.targetAmount === 'number' &&
    typeof v.currentAmount === 'number'
  )
}

function loadLocalTransactions(): Transaction[] {
  return parseValidArray(TRANSACTIONS_KEY, isTransaction)
}

function loadLocalMemos(): Memo[] {
  return parseValidArray(MEMOS_KEY, isMemo)
}

function loadLocalBudgets(): Budget[] {
  return parseValidArray(BUDGETS_KEY, isBudget)
}

function loadLocalRecurring(): RecurringTransaction[] {
  return parseValidArray(RECURRING_KEY, isRecurring)
}

function loadLocalSubscriptions(): Subscription[] {
  return parseValidArray(SUBSCRIPTIONS_KEY, isSubscription)
}

function loadLocalGoals(): SavingsGoal[] {
  return parseValidArray(GOALS_KEY, isSavingsGoal)
}

function loadLocalSettings(): AppSettings {
  recoverInterruptedRestore()
  return migrateSettings({ ...DEFAULT_SETTINGS, ...parseJSON(localStorage.getItem(SETTINGS_KEY), {}) })
}

function hasValidPayday(value: number | 'last' | null): boolean {
  return value === 'last' || (Number.isInteger(value) && value !== null && value >= 1 && value <= 31)
}
function hasValidBillingDay(value: number | null): boolean {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 31
}

function getUserDocRef(uid: string) {
  return doc(db, 'users', uid, 'app', 'default')
}

function getStorageUid(): string {
  if (!storageUid) {
    throw new Error('Firebase storage mode requires an authenticated user uid.')
  }
  return storageUid
}

function normalizeRemoteState(raw: unknown): RemoteState {
  if (!raw || typeof raw !== 'object') {
    return {
      transactions: [],
      memos: [],
      budgets: [],
      recurring: [],
      subscriptions: [],
      goals: [],
      settings: { ...DEFAULT_SETTINGS },
    }
  }

  const data = raw as Partial<RemoteState>
  const settings = migrateSettings(
    data.settings && typeof data.settings === 'object'
      ? ({ ...DEFAULT_SETTINGS, ...data.settings } as AppSettings)
      : { ...DEFAULT_SETTINGS }
  )

  return {
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    memos: Array.isArray(data.memos) ? data.memos : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    recurring: Array.isArray(data.recurring) ? data.recurring : [],
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    settings,
  }
}

/**
 * 원격 상태를 읽고, 호출자가 화면에 반영하는 키의 기준 버전만 갱신한다.
 * 일부 키만 쓰는 로드가 다른 키의 낙관적 잠금 기준을 덮어쓰지 않게 하기 위함이다.
 */
async function loadRemoteState(uid: string, refreshKeys: readonly RemoteVersionKey[] = VERSION_KEYS): Promise<RemoteState> {
  const snap = await getDoc(getUserDocRef(uid))
  const raw = snap.data()
  const versions = normalizeVersions(raw && typeof raw === 'object' ? (raw as Record<string, unknown>).versions : undefined)
  if (!cachedRemoteVersions) {
    cachedRemoteVersions = versions
  } else {
    const next = { ...cachedRemoteVersions }
    for (const key of refreshKeys) next[key] = versions[key]
    cachedRemoteVersions = next
  }
  return normalizeRemoteState(raw)
}

interface RemotePatchOptions {
  // 지정한 키는 캐시 대신 이 버전과 비교한다 (미동기화 재전송용)
  expected?: Partial<RemoteVersions>
  // false면 실패해도 미동기화 기록을 남기지 않는다
  trackPending?: boolean
}

async function saveRemotePatch(uid: string, patch: Partial<RemoteState>, options: RemotePatchOptions = {}): Promise<void> {
  if (restoreInProgress) throw new Error('백업 복원이 진행 중이에요. 완료 후 다시 저장해주세요.')
  const { expected, trackPending = true } = options
  const patchKeys = extractPatchKeys(patch)
  if (patchKeys.length === 0) return

  let committedVersions: RemoteVersions | null = null
  remoteWritesInFlight += 1
  try {
    await runTransaction(db, async (tx) => {
      const ref = getUserDocRef(uid)
      const snap = await tx.get(ref)
      const raw = snap.data() ?? {}
      const remoteVersions = normalizeVersions(
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>).versions : undefined
      )
      const expectedVersions = expected
        ? { ...remoteVersions, ...expected }
        : (cachedRemoteVersions ?? remoteVersions)

      const conflictKeys = patchKeys.filter((key) => remoteVersions[key] !== expectedVersions[key])
      if (conflictKeys.length > 0) {
        const countDiffs: ConflictCountDiff = {}
        for (const key of conflictKeys) {
          countDiffs[key] = {
            localCount: valueCount(patch[key]),
            remoteCount: valueCount((raw as Record<string, unknown>)[key]),
          }
        }
        const remoteUpdatedAtRaw = (raw as Record<string, unknown>).updatedAt
        const remoteUpdatedAt = Number.isFinite(remoteUpdatedAtRaw) ? Number(remoteUpdatedAtRaw) : null
        throw new StorageConflictError(conflictKeys, expectedVersions, remoteVersions, countDiffs, remoteUpdatedAt)
      }

      const nextVersions = { ...remoteVersions }
      for (const key of patchKeys) {
        nextVersions[key] = nextVersions[key] + 1
      }

      committedVersions = nextVersions
      tx.set(ref, { ...patch, versions: nextVersions, updatedAt: Date.now() }, { merge: true })
    })

    if (committedVersions) {
      cachedRemoteVersions = committedVersions
    }
    clearPendingKeys(uid, patchKeys)
  } catch (e) {
    if (trackPending) markPendingSync(uid, patchKeys)
    throw e
  } finally { remoteWritesInFlight -= 1 }
}

function localSnapshot(): RemoteState {
  return {
    transactions: loadLocalTransactions(),
    memos: loadLocalMemos(),
    budgets: loadLocalBudgets(),
    recurring: loadLocalRecurring(),
    subscriptions: loadLocalSubscriptions(),
    goals: loadLocalGoals(),
    settings: loadLocalSettings(),
  }
}

// 로컬스토리지를 주어진 스냅샷으로 직접 덮어쓴다 (원격 저장 시도 없이)
function writeLocalSnapshot(state: RemoteState): void {
  safeSave(TRANSACTIONS_KEY, state.transactions)
  safeSave(MEMOS_KEY, state.memos)
  safeSave(BUDGETS_KEY, state.budgets)
  safeSave(RECURRING_KEY, state.recurring)
  safeSave(SUBSCRIPTIONS_KEY, state.subscriptions)
  safeSave(GOALS_KEY, state.goals)
  safeSave(SETTINGS_KEY, state.settings)
}

function txKey(t: Transaction): string {
  return [t.date, t.amount, t.type, t.category, t.description].join('|')
}

function memoKey(m: Memo): string {
  return [m.title, m.content, m.date ?? '', m.category ?? ''].join('|')
}

function recurringKey(r: RecurringTransaction): string {
  return [r.dayOfMonth, r.amount, r.category, r.type, r.description].join('|')
}

function mergeUniqueByKey<T>(base: T[], incoming: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of base) map.set(keyFn(item), item)
  for (const item of incoming) map.set(keyFn(item), item)
  return Array.from(map.values())
}

/**
 * id 기준으로 합치고, 내용이 같은 항목은 로컬→원격 사이에서만 중복 제거한다.
 * 원격 안에 내용이 같은 정상 기록(같은 날 같은 금액 커피 2잔 등)은 그대로 보존한다.
 */
function mergeByIdThenContent<T extends { id: string }>(remote: T[], local: T[], keyFn: (item: T) => string): T[] {
  const byId = new Map(remote.map((item) => [item.id, item]))
  const remoteKeys = new Set(remote.map(keyFn))
  for (const item of local) {
    if (byId.has(item.id) || !remoteKeys.has(keyFn(item))) byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

function mergeBudgets(remote: Budget[], local: Budget[]): Budget[] {
  const map = new Map<string, Budget>()
  for (const item of remote) map.set(JSON.stringify([item.category, item.yearMonth ?? null]), item)
  for (const item of local) map.set(JSON.stringify([item.category, item.yearMonth ?? null]), item)
  return Array.from(map.values())
}

function mergeSettings(remote: AppSettings, local: AppSettings): AppSettings {
  return {
    payday: hasValidPayday(local.payday) ? local.payday : remote.payday,
    cardBillingDay: hasValidBillingDay(local.cardBillingDay) ? local.cardBillingDay : remote.cardBillingDay,
    userPaymentMethods: local.userPaymentMethods.length > 0 ? local.userPaymentMethods : remote.userPaymentMethods,
    customExpenseCategories: local.customExpenseCategories.length > 0 ? local.customExpenseCategories : remote.customExpenseCategories,
    customIncomeCategories: local.customIncomeCategories.length > 0 ? local.customIncomeCategories : remote.customIncomeCategories,
    transactionTemplates: (local.transactionTemplates?.length ?? 0) > 0 ? local.transactionTemplates : (remote.transactionTemplates ?? []),
    autoCategoryRules: (local.autoCategoryRules?.length ?? 0) > 0 ? local.autoCategoryRules : (remote.autoCategoryRules ?? []),
    hiddenWidgets: local.hiddenWidgets ?? remote.hiddenWidgets ?? [],
  }
}

function backupAndClearLocalData(): void {
  const backupPrefix = `hb_backup_${Date.now()}`
  const keys = [TRANSACTIONS_KEY, MEMOS_KEY, BUDGETS_KEY, RECURRING_KEY, SUBSCRIPTIONS_KEY, GOALS_KEY, SETTINGS_KEY]

  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value === null) continue
    localStorage.setItem(`${backupPrefix}_${key}`, value)
    localStorage.removeItem(key)
  }

  localStorage.removeItem(FIREBASE_CACHE_KEY)
  // 남은 미동기화 기록이 비워진 로컬을 원격에 밀어넣지 않도록 함께 정리
  localStorage.removeItem(PENDING_SYNC_KEY)
}

// 지정한 키의 로컬 값을 hb_backup_* 으로 복사해 둔다 (원격에 반영하지 못한 변경 보존용)
function backupLocalKeys(keys: readonly RemoteVersionKey[]): void {
  const backupPrefix = `hb_backup_${Date.now()}`
  for (const key of keys) {
    const localKey = SNAPSHOT_LOCAL_KEYS[VERSION_KEYS.indexOf(key)]
    const value = localStorage.getItem(localKey)
    if (value !== null) localStorage.setItem(`${backupPrefix}_${localKey}`, value)
  }
}

/** 로그아웃 시 이전 계정의 Firebase 캐시를 지운다. 로컬 모드에서 만든 데이터는 남긴다. */
export function clearFirebaseCacheOnSignOut(): void {
  localStorage.removeItem(PENDING_SYNC_KEY)
  if (localStorage.getItem(FIREBASE_CACHE_KEY) !== 'true') return
  for (const key of SNAPSHOT_LOCAL_KEYS) localStorage.removeItem(key)
  localStorage.removeItem(FIREBASE_CACHE_KEY)
}

function markFirebaseCacheLocalData(): void {
  localStorage.setItem(FIREBASE_CACHE_KEY, 'true')
}

function markUserLocalData(): void {
  localStorage.removeItem(FIREBASE_CACHE_KEY)
}

export function setStorageContext(mode: StorageMode, uid: string | null = null): void {
  storageMode = mode
  storageUid = uid
  cachedRemoteVersions = null
}

// ─── 스토리지 사용량 ────────────────────────────────────────────────

/** localStorage 사용량(bytes) 반환. 브라우저 한도는 약 5MB */
export function getLocalStorageUsageBytes(): number {
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) ?? ''
    const val = localStorage.getItem(key) ?? ''
    total += (key.length + val.length) * 2 // UTF-16: 문자당 2바이트
  }
  return total
}

// ─── 내역 아카이브 ────────────────────────────────────────────────

/**
 * CSV로 내보낸 거래 ID만 로컬 스토리지에서 삭제한다.
 * Firebase 모드에서도 로컬 스토리지를 직접 조작하며,
 * 호출 전에 반드시 CSV 내보내기를 완료해야 한다.
 *
 * @returns 삭제된 건수
 */
export async function archiveTransactionsByIds(transactionIds: readonly string[]): Promise<number> {
  const ids = new Set(transactionIds)
  if (ids.size === 0) return 0
  const all = loadLocalTransactions()
  const keep = all.filter(t => !ids.has(t.id))
  const removed = all.length - keep.length
  if (removed === 0) return 0

  safeSave(TRANSACTIONS_KEY, keep)

  if (storageMode === 'firebase') {
    try {
      await saveRemotePatch(getStorageUid(), { transactions: keep })
    } catch {
      // saveRemotePatch가 미동기화 기록을 남기므로 다음 로드 때 재전송된다
    }
  }

  return removed
}

export interface LocalDataCounts {
  transactions: number
  memos: number
  budgets: number
  recurring: number
  subscriptions: number
  goals: number
}

export function getLocalDataCounts(): LocalDataCounts {
  const snapshot = localSnapshot()
  return {
    transactions: snapshot.transactions.length,
    memos: snapshot.memos.length,
    budgets: snapshot.budgets.length,
    recurring: snapshot.recurring.length,
    subscriptions: snapshot.subscriptions.length,
    goals: snapshot.goals.length,
  }
}

export function hasLocalMigratableData(): boolean {
  const snapshot = localSnapshot()

  // Firebase 모드에서 저장된 로컬 캐시는 병합 대상이 아니다.
  // 다만 Firebase 캐시로 저장하지 않는 데이터가 있으면 병합 대상으로 본다.
  if (localStorage.getItem(FIREBASE_CACHE_KEY) === 'true') {
    return (
      snapshot.memos.length > 0
      || snapshot.budgets.length > 0
      || snapshot.recurring.length > 0
      || snapshot.subscriptions.length > 0
      || snapshot.goals.length > 0
      || hasValidPayday(snapshot.settings.payday)
      || hasValidBillingDay(snapshot.settings.cardBillingDay)
      || snapshot.settings.customExpenseCategories.length > 0
      || snapshot.settings.customIncomeCategories.length > 0
    )
  }

  return (
    snapshot.transactions.length > 0
    || snapshot.memos.length > 0
    || snapshot.budgets.length > 0
    || snapshot.recurring.length > 0
    || snapshot.subscriptions.length > 0
    || snapshot.goals.length > 0
    || hasValidPayday(snapshot.settings.payday)
    || hasValidBillingDay(snapshot.settings.cardBillingDay)
    || snapshot.settings.customExpenseCategories.length > 0
    || snapshot.settings.customIncomeCategories.length > 0
  )
}

export function clearLocalData(): void {
  backupAndClearLocalData()
}

/**
 * 로컬(및 로그인 상태라면 Firebase 원격) 데이터와 설정을 앱 최초 상태로 되돌린다.
 * clearLocalData와 달리 hb_backup_* 백업을 남기지 않고 완전히 삭제한다.
 */
export async function resetAllData(): Promise<void> {
  // 원격 초기화가 확정된 뒤에만 로컬을 지운다. 실패 시 로컬 데이터와 화면이 어긋나지 않게 한다.
  if (storageMode === 'firebase') {
    const uid = getStorageUid()
    // 캐시된 버전을 지워 현재 원격 버전을 그대로 기준점으로 삼는다 → 충돌 없이 항상 덮어써진다
    cachedRemoteVersions = null
    // 오프라인 상태 등으로 Firestore 트랜잭션이 무한 대기하면 초기화 모달이 영원히
    // busy 상태로 남아 화면 전체를 가리게 되므로, 일정 시간 후 강제로 실패 처리한다
    await withTimeout(
      saveRemotePatch(uid, {
        transactions: [],
        memos: [],
        budgets: [],
        recurring: [],
        subscriptions: [],
        goals: [],
        settings: { ...DEFAULT_SETTINGS },
      }, { trackPending: false }),
      REMOTE_WRITE_TIMEOUT_MS
    )
  }

  for (const key of SNAPSHOT_LOCAL_KEYS) localStorage.removeItem(key)
  localStorage.removeItem(FIREBASE_CACHE_KEY)
  localStorage.removeItem(PENDING_SYNC_KEY)

  emitSettingsUpdatedEvent()
}

export async function mergeLocalIntoFirebase(): Promise<MergeResult> {
  if (storageMode !== 'firebase') {
    return {
      merged: false,
      message: '로그인 상태에서만 병합할 수 있습니다.',
      counts: { transactions: 0, memos: 0, budgets: 0, recurring: 0, subscriptions: 0, goals: 0 },
    }
  }

  const uid = getStorageUid()
  const local = localSnapshot()
  if (!hasLocalMigratableData()) {
    return {
      merged: false,
      message: '로컬 데이터가 없어 병합을 건너뛰었습니다.',
      counts: { transactions: 0, memos: 0, budgets: 0, recurring: 0, subscriptions: 0, goals: 0 },
    }
  }

  // 조회 실패 시 로컬 데이터는 그대로 남아 다음 로그인 때 다시 병합을 묻는다.
  // 미동기화 기록을 남기면 로컬 전용 데이터가 원격 전체를 덮어쓰므로 남기지 않는다.
  const remote = await loadRemoteState(uid)

  const merged: RemoteState = {
    transactions: mergeByIdThenContent(remote.transactions, local.transactions, txKey),
    memos: mergeByIdThenContent(remote.memos, local.memos, memoKey),
    budgets: mergeBudgets(remote.budgets, local.budgets),
    recurring: mergeByIdThenContent(remote.recurring, local.recurring, recurringKey),
    subscriptions: mergeUniqueByKey(remote.subscriptions, local.subscriptions, (s) => s.id),
    goals: mergeUniqueByKey(remote.goals, local.goals, (g) => g.id),
    settings: mergeSettings(remote.settings, local.settings),
  }

  try {
    // saveRemotePatch 실패 시 PENDING_SYNC_KEY를 자동으로 설정하고 예외를 던진다
    await saveRemotePatch(uid, merged)
  } catch (e) {
    // 원격 저장은 실패했지만 병합 결과 자체는 유효하므로, 로컬을 병합 전(local-only)
    // 스냅샷이 아닌 병합된 스냅샷으로 갱신해둔다. 이렇게 해야 다음 로드 시
    // PENDING_SYNC_KEY 재시도 경로가 로컬-only 데이터로 원격을 덮어쓰지 않는다.
    writeLocalSnapshot(merged)
    throw e
  }
  backupAndClearLocalData()

  return {
    merged: true,
    message: '로컬 데이터를 Firebase 데이터와 병합했습니다.',
    counts: {
      transactions: merged.transactions.length,
      memos: merged.memos.length,
      budgets: merged.budgets.length,
      recurring: merged.recurring.length,
      subscriptions: merged.subscriptions.length,
      goals: merged.goals.length,
    },
  }
}

/**
 * 이전 저장 실패로 남은 변경을 원격에 재전송한다.
 * - 실패한 키만, 실패 당시 기준 버전과 같을 때만 커밋한다.
 * - 그 사이 다른 기기가 바꾼 키(충돌)는 로컬 값을 백업으로 옮기고 원격을 따른다.
 * - 다른 계정의 기록이나 키 정보가 없는 구형 플래그는 백업만 하고 버린다.
 */
async function flushPendingSync(uid: string): Promise<void> {
  const pending = readPendingSync()
  if (!pending) return
  if (pending === 'legacy' || pending.uid !== uid) {
    if (pending === 'legacy') backupLocalKeys(VERSION_KEYS)
    localStorage.removeItem(PENDING_SYNC_KEY)
    return
  }

  let keys = pending.keys.filter((key) => localStorage.getItem(SNAPSHOT_LOCAL_KEYS[VERSION_KEYS.indexOf(key)]) !== null)
  while (keys.length > 0) {
    const local = localSnapshot()
    const patch = Object.fromEntries(keys.map((key) => [key, local[key]])) as Partial<RemoteState>
    try {
      await saveRemotePatch(uid, patch, { expected: pending.base, trackPending: false })
      break
    } catch (e) {
      if (!isStorageConflictError(e)) throw e
      backupLocalKeys(e.conflictKeys)
      keys = keys.filter((key) => !e.conflictKeys.includes(key))
    }
  }
  localStorage.removeItem(PENDING_SYNC_KEY)
}

export async function loadAllData(): Promise<AppDataSnapshot> {
  if (restoreInProgress) throw new Error('백업 복원이 진행 중이에요.')
  if (storageMode === 'local') {
    return localSnapshot()
  }

  const uid = getStorageUid()

  try {
    await flushPendingSync(uid)
  } catch {
    // 여전히 오프라인 — 미동기화 기록은 남겨 두고 로컬 캐시로 표시한다
    return localSnapshot()
  }

  try {
    return await loadRemoteState(uid)
  } catch {
    return localSnapshot()
  }
}

export async function loadTransactions(): Promise<Transaction[]> {
  if (storageMode === 'local') return loadLocalTransactions()
  try {
    return (await loadRemoteState(getStorageUid(), ['transactions'])).transactions
  } catch {
    return loadLocalTransactions()
  }
}

export async function saveTransactions(t: Transaction[]): Promise<void> {
  // 항상 로컬스토리지에 저장 (Firebase 실패 시 폴백용)
  safeSave(TRANSACTIONS_KEY, t)
  if (storageMode === 'local') {
    markUserLocalData()
    return
  }
  markFirebaseCacheLocalData()
  await saveRemotePatch(getStorageUid(), { transactions: t })
}

export async function loadMemos(): Promise<Memo[]> {
  if (storageMode === 'local') return loadLocalMemos()
  try {
    return (await loadRemoteState(getStorageUid(), ['memos'])).memos
  } catch {
    return loadLocalMemos()
  }
}

export async function saveMemos(m: Memo[]): Promise<void> {
  safeSave(MEMOS_KEY, m)
  if (storageMode === 'local') {
    markUserLocalData()
    return
  }
  markFirebaseCacheLocalData()
  await saveRemotePatch(getStorageUid(), { memos: m })
}

export async function loadBudgets(): Promise<Budget[]> {
  if (storageMode === 'local') return loadLocalBudgets()
  try {
    return (await loadRemoteState(getStorageUid(), ['budgets'])).budgets
  } catch {
    return loadLocalBudgets()
  }
}

export async function saveBudgets(b: Budget[]): Promise<void> {
  safeSave(BUDGETS_KEY, b)
  if (storageMode === 'local') {
    markUserLocalData()
    return
  }
  markFirebaseCacheLocalData()
  await saveRemotePatch(getStorageUid(), { budgets: b })
}

export async function loadRecurring(): Promise<RecurringTransaction[]> {
  if (storageMode === 'local') return loadLocalRecurring()
  try {
    return (await loadRemoteState(getStorageUid(), ['recurring'])).recurring
  } catch {
    return loadLocalRecurring()
  }
}

export async function saveRecurring(r: RecurringTransaction[]): Promise<void> {
  safeSave(RECURRING_KEY, r)
  if (storageMode === 'local') {
    markUserLocalData()
    return
  }
  markFirebaseCacheLocalData()
  await saveRemotePatch(getStorageUid(), { recurring: r })
}

export async function loadSubscriptions(): Promise<Subscription[]> {
  if (storageMode === 'local') return loadLocalSubscriptions()
  try {
    return (await loadRemoteState(getStorageUid(), ['subscriptions'])).subscriptions
  } catch {
    return loadLocalSubscriptions()
  }
}

export async function saveSubscriptions(subs: Subscription[]): Promise<void> {
  safeSave(SUBSCRIPTIONS_KEY, subs)
  if (storageMode === 'local') {
    markUserLocalData()
    return
  }
  markFirebaseCacheLocalData()
  await saveRemotePatch(getStorageUid(), { subscriptions: subs })
}

export async function loadGoals(): Promise<SavingsGoal[]> {
  if (storageMode === 'local') return loadLocalGoals()
  try {
    return (await loadRemoteState(getStorageUid(), ['goals'])).goals
  } catch {
    return loadLocalGoals()
  }
}

export async function saveGoals(goals: SavingsGoal[]): Promise<void> {
  safeSave(GOALS_KEY, goals)
  if (storageMode === 'local') {
    markUserLocalData()
    return
  }
  markFirebaseCacheLocalData()
  await saveRemotePatch(getStorageUid(), { goals })
}

export async function loadSettings(): Promise<AppSettings> {
  if (storageMode === 'local') return loadLocalSettings()
  return (await loadRemoteState(getStorageUid(), ['settings'])).settings
}

export async function saveSettings(s: AppSettings): Promise<void> {
  if (storageMode === 'local') {
    safeSave(SETTINGS_KEY, s)
    markUserLocalData()
    emitSettingsUpdatedEvent()
    return
  }
  // Firebase 모드의 설정은 로컬에 캐시하지 않아 재전송할 값이 없으므로 미동기화 기록을 남기지 않는다
  await saveRemotePatch(getStorageUid(), { settings: s }, { trackPending: false })
  emitSettingsUpdatedEvent()
}

export interface BackupState {
  data: AppDataSnapshot
  target: string
  token: {
    mode: StorageMode
    uid: string | null
    localStamp?: string
    versions?: RemoteVersions
    remoteStamp?: string
  }
}

function assertBackupReady(mode: StorageMode, uid: string | null): void {
  if (storageMode !== mode || storageUid !== uid) throw new Error('저장소 또는 계정이 바뀌었어요. 파일을 다시 선택해주세요.')
  if (restoreInProgress || remoteWritesInFlight > 0 || (mode === 'firebase' && hasPendingSync())) {
    throw new Error('저장 또는 동기화할 변경사항이 있어요. 동기화를 마친 뒤 다시 시도해주세요.')
  }
}

function localBackupStamp(): string {
  return JSON.stringify(RESTORE_LOCAL_KEYS.map(key => localStorage.getItem(key)))
}

function strictBackupState(raw: Record<string, unknown>): AppDataSnapshot {
  const defaults = { transactions: [], memos: [], budgets: [], recurring: [], subscriptions: [], goals: [], settings: DEFAULT_SETTINGS }
  const state = Object.fromEntries(VERSION_KEYS.map(key => [key, raw[key] === undefined ? defaults[key] : raw[key]]))
  if (!isObj(state.settings)) throw new Error('설정 데이터를 읽을 수 없어요.')
  state.settings = migrateSettings({ ...DEFAULT_SETTINGS, ...state.settings } as AppSettings)
  return validateBackupData(state)
}

/** Read a coherent saved snapshot. Never sync pending local writes or silently fall back from the server. */
export async function loadBackupState(): Promise<BackupState> {
  const mode = storageMode
  const uid = storageUid
  assertBackupReady(mode, uid)
  recoverInterruptedRestore()
  if (mode === 'local') {
    const raw = Object.fromEntries(VERSION_KEYS.map((key, i) => {
      const value = localStorage.getItem(SNAPSHOT_LOCAL_KEYS[i])
      return [key, value === null ? undefined : JSON.parse(value)]
    }))
    return { data: strictBackupState(raw), target: '이 기기', token: { mode, uid, localStamp: localBackupStamp() } }
  }
  const snap = await withTimeout(getDocFromServer(getUserDocRef(getStorageUid())), REMOTE_WRITE_TIMEOUT_MS)
  assertBackupReady(mode, uid)
  const raw = snap.data() ?? {}
  const data = strictBackupState(raw)
  return { data, target: '로그인한 계정', token: { mode, uid, versions: normalizeVersions(raw.versions), remoteStamp: JSON.stringify(data) } }
}

/** Replace all seven sections together, conditional on the exact target shown in the preview. */
export async function restoreAllData(input: AppDataSnapshot, token: BackupState['token']): Promise<{ data: AppDataSnapshot; cacheSaved: boolean }> {
  const data = validateBackupData(input)
  assertBackupReady(token.mode, token.uid)
  recoverInterruptedRestore()
  if (token.mode === 'local' && localBackupStamp() !== token.localStamp) throw new Error('미리보기 이후 기기의 데이터가 바뀌었어요. 파일을 다시 선택해주세요.')
  restoreInProgress = true
  let cacheSaved = true
  try {
    if (token.mode === 'local') {
      replaceLocalSnapshot(data, false)
    } else {
      const uid = getStorageUid()
      let committedVersions: RemoteVersions | null = null
      await runTransaction(db, async tx => {
        if (storageMode !== token.mode || storageUid !== token.uid) throw new Error('복원 대상 계정이 바뀌었어요.')
        const ref = getUserDocRef(uid)
        const snap = await tx.get(ref)
        const raw = snap.data() ?? {}
        const versions = normalizeVersions(raw.versions)
        if (!token.versions || VERSION_KEYS.some(key => versions[key] !== token.versions![key]) || JSON.stringify(strictBackupState(raw)) !== token.remoteStamp) {
          throw new Error('다른 기기에서 데이터가 바뀌었어요. 파일을 다시 선택하고 변경 내용을 확인해주세요.')
        }
        if (storageMode !== token.mode || storageUid !== token.uid) throw new Error('복원 대상 계정이 바뀌었어요.')
        const nextVersions = { ...versions }
        for (const key of VERSION_KEYS) nextVersions[key] += 1
        // Replace the settings map as a whole too; recursive merge could retain old optional settings.
        tx.set(ref, { ...data, versions: nextVersions, updatedAt: Date.now() }, { mergeFields: [...VERSION_KEYS, 'versions', 'updatedAt'] })
        committedVersions = nextVersions
      })
      if (storageMode === token.mode && storageUid === token.uid) {
        cachedRemoteVersions = committedVersions
        try { replaceLocalSnapshot(data, true) } catch { cacheSaved = false }
      } else { throw new Error('처음 선택한 계정에는 복원이 완료됐지만 계정이 바뀌었어요. 창을 닫고 현재 계정을 다시 확인해주세요.') }
    }
  } finally { restoreInProgress = false }
  emitSettingsUpdatedEvent()
  return { data, cacheSaved }
}
