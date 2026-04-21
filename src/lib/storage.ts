import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { Budget, Memo, RecurringTransaction, SavingsGoal, StockTrade, Subscription, Transaction } from '../types'

function safeSave(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      alert('저장 공간이 부족합니다. 오래된 내역을 삭제하거나 CSV로 내보낸 후 정리해주세요.')
    } else {
      throw e
    }
  }
}

const TRANSACTIONS_KEY = 'hb_transactions'
const MEMOS_KEY = 'hb_memos'
const BUDGETS_KEY = 'hb_budgets'
const RECURRING_KEY = 'hb_recurring'
const STOCK_TRADES_KEY = 'hb_stock_trades'
const SUBSCRIPTIONS_KEY = 'hb_subscriptions'
const GOALS_KEY = 'hb_goals'
const SETTINGS_KEY = 'hb_settings'
// Firebase 저장 실패 시 로컬에 미동기화 변경사항이 있음을 표시
const PENDING_SYNC_KEY = 'hb_pending_sync'

type StorageMode = 'local' | 'firebase'

export interface AppSettings {
  payday: number | 'last' | null
  customExpenseCategories: string[]
  customIncomeCategories: string[]
  stockWatchlist: string[]
}

interface RemoteState {
  transactions: Transaction[]
  memos: Memo[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  stockTrades: StockTrade[]
  subscriptions: Subscription[]
  goals: SavingsGoal[]
  settings: AppSettings
}

export interface AppDataSnapshot {
  transactions: Transaction[]
  memos: Memo[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  stockTrades: StockTrade[]
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
    stockTrades: number
  }
}

let storageMode: StorageMode = 'local'
let storageUid: string | null = null

const DEFAULT_SETTINGS: AppSettings = {
  payday: null,
  customExpenseCategories: [],
  customIncomeCategories: [],
  stockWatchlist: [],
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

function isStockTrade(v: unknown): v is StockTrade {
  if (!isObj(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.ticker === 'string' &&
    (v.tradeType === 'buy' || v.tradeType === 'sell') &&
    typeof v.quantity === 'number' &&
    typeof v.price === 'number'
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

function loadLocalStockTrades(): StockTrade[] {
  return parseValidArray(STOCK_TRADES_KEY, isStockTrade)
}

function loadLocalSubscriptions(): Subscription[] {
  return parseJSON(localStorage.getItem(SUBSCRIPTIONS_KEY), [])
}

function loadLocalGoals(): SavingsGoal[] {
  return parseJSON(localStorage.getItem(GOALS_KEY), [])
}

function loadLocalSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...parseJSON(localStorage.getItem(SETTINGS_KEY), {}) }
}

function hasValidPayday(value: number | 'last' | null): boolean {
  return value === 'last' || (Number.isInteger(value) && value !== null && value >= 1 && value <= 31)
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
      stockTrades: [],
      subscriptions: [],
      goals: [],
      settings: { ...DEFAULT_SETTINGS },
    }
  }

  const data = raw as Partial<RemoteState>
  const settings = data.settings && typeof data.settings === 'object'
    ? ({ ...DEFAULT_SETTINGS, ...data.settings } as AppSettings)
    : { ...DEFAULT_SETTINGS }

  return {
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    memos: Array.isArray(data.memos) ? data.memos : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    recurring: Array.isArray(data.recurring) ? data.recurring : [],
    stockTrades: Array.isArray(data.stockTrades) ? data.stockTrades : [],
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    settings,
  }
}

async function loadRemoteState(uid: string): Promise<RemoteState> {
  const snap = await getDoc(getUserDocRef(uid))
  return normalizeRemoteState(snap.data())
}

async function saveRemotePatch(uid: string, patch: Partial<RemoteState>): Promise<void> {
  try {
    await setDoc(
      getUserDocRef(uid),
      { ...patch, updatedAt: Date.now() },
      { merge: true }
    )
    localStorage.removeItem(PENDING_SYNC_KEY)
  } catch (e) {
    localStorage.setItem(PENDING_SYNC_KEY, 'true')
    throw e
  }
}

function localSnapshot(): RemoteState {
  return {
    transactions: loadLocalTransactions(),
    memos: loadLocalMemos(),
    budgets: loadLocalBudgets(),
    recurring: loadLocalRecurring(),
    stockTrades: loadLocalStockTrades(),
    subscriptions: loadLocalSubscriptions(),
    goals: loadLocalGoals(),
    settings: loadLocalSettings(),
  }
}

function txKey(t: Transaction): string {
  return [t.date, t.amount, t.type, t.category, t.description].join('|')
}

function memoKey(m: Memo): string {
  return [m.title, m.content, m.date ?? '', m.amount ?? '', m.transactionType ?? '', m.category ?? ''].join('|')
}

function recurringKey(r: RecurringTransaction): string {
  return [r.dayOfMonth, r.amount, r.category, r.type, r.description].join('|')
}

function stockKey(t: StockTrade): string {
  return [t.ticker, t.tradeType, t.quantity, t.price, t.fee, t.currency, t.date, t.note].join('|')
}

function mergeUniqueByKey<T>(base: T[], incoming: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of base) map.set(keyFn(item), item)
  for (const item of incoming) map.set(keyFn(item), item)
  return Array.from(map.values())
}

function mergeBudgets(remote: Budget[], local: Budget[]): Budget[] {
  const map = new Map<string, Budget>()
  for (const item of remote) map.set(item.category, item)
  for (const item of local) map.set(item.category, item)
  return Array.from(map.values())
}

function mergeRecurring(remote: RecurringTransaction[], local: RecurringTransaction[]): RecurringTransaction[] {
  const byId = new Map<string, RecurringTransaction>()
  for (const item of remote) byId.set(item.id, item)
  for (const item of local) byId.set(item.id, item)
  return mergeUniqueByKey([], Array.from(byId.values()), recurringKey)
}

function mergeSettings(remote: AppSettings, local: AppSettings): AppSettings {
  return {
    payday: hasValidPayday(local.payday) ? local.payday : remote.payday,
    customExpenseCategories: local.customExpenseCategories.length > 0 ? local.customExpenseCategories : remote.customExpenseCategories,
    customIncomeCategories: local.customIncomeCategories.length > 0 ? local.customIncomeCategories : remote.customIncomeCategories,
    stockWatchlist: local.stockWatchlist.length > 0 ? local.stockWatchlist : remote.stockWatchlist,
  }
}

function backupAndClearLocalData(): void {
  const backupPrefix = `hb_backup_${Date.now()}`
  const keys = [TRANSACTIONS_KEY, MEMOS_KEY, BUDGETS_KEY, RECURRING_KEY, STOCK_TRADES_KEY, SETTINGS_KEY]

  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value === null) continue
    localStorage.setItem(`${backupPrefix}_${key}`, value)
    localStorage.removeItem(key)
  }
}

export function setStorageContext(mode: StorageMode, uid: string | null = null): void {
  storageMode = mode
  storageUid = uid
}

export interface LocalDataCounts {
  transactions: number
  memos: number
  budgets: number
  recurring: number
  stockTrades: number
}

export function getLocalDataCounts(): LocalDataCounts {
  const snapshot = localSnapshot()
  return {
    transactions: snapshot.transactions.length,
    memos: snapshot.memos.length,
    budgets: snapshot.budgets.length,
    recurring: snapshot.recurring.length,
    stockTrades: snapshot.stockTrades.length,
  }
}

export function hasLocalMigratableData(): boolean {
  const snapshot = localSnapshot()
  return (
    snapshot.transactions.length > 0
    || snapshot.memos.length > 0
    || snapshot.budgets.length > 0
    || snapshot.recurring.length > 0
    || snapshot.stockTrades.length > 0
    || hasValidPayday(snapshot.settings.payday)
    || snapshot.settings.customExpenseCategories.length > 0
    || snapshot.settings.customIncomeCategories.length > 0
    || snapshot.settings.stockWatchlist.length > 0
  )
}

export function clearLocalData(): void {
  backupAndClearLocalData()
}

export async function mergeLocalIntoFirebase(): Promise<MergeResult> {
  if (storageMode !== 'firebase') {
    return {
      merged: false,
      message: '로그인 상태에서만 병합할 수 있습니다.',
      counts: { transactions: 0, memos: 0, budgets: 0, recurring: 0, stockTrades: 0 },
    }
  }

  const uid = getStorageUid()
  const local = localSnapshot()
  if (!hasLocalMigratableData()) {
    return {
      merged: false,
      message: '로컬 데이터가 없어 병합을 건너뛰었습니다.',
      counts: { transactions: 0, memos: 0, budgets: 0, recurring: 0, stockTrades: 0 },
    }
  }

  let remote: RemoteState
  try {
    remote = await loadRemoteState(uid)
  } catch (e) {
    // Firebase 조회 실패 — 로컬 데이터는 보존되며 다음 로드 시 재시도한다
    localStorage.setItem(PENDING_SYNC_KEY, 'true')
    throw e
  }

  const merged: RemoteState = {
    transactions: mergeUniqueByKey(remote.transactions, local.transactions, txKey),
    memos: mergeUniqueByKey(remote.memos, local.memos, memoKey),
    budgets: mergeBudgets(remote.budgets, local.budgets),
    recurring: mergeRecurring(remote.recurring, local.recurring),
    stockTrades: mergeUniqueByKey(remote.stockTrades, local.stockTrades, stockKey),
    subscriptions: local.subscriptions.length > 0 ? local.subscriptions : remote.subscriptions,
    goals: local.goals.length > 0 ? local.goals : remote.goals,
    settings: mergeSettings(remote.settings, local.settings),
  }

  // saveRemotePatch 실패 시 PENDING_SYNC_KEY를 자동으로 설정하고 예외를 던진다
  await saveRemotePatch(uid, merged)
  backupAndClearLocalData()

  return {
    merged: true,
    message: '로컬 데이터를 Firebase 데이터와 병합했습니다.',
    counts: {
      transactions: merged.transactions.length,
      memos: merged.memos.length,
      budgets: merged.budgets.length,
      recurring: merged.recurring.length,
      stockTrades: merged.stockTrades.length,
    },
  }
}

export async function loadAllData(): Promise<AppDataSnapshot> {
  if (storageMode === 'local') {
    return localSnapshot()
  }

  const uid = getStorageUid()

  // 이전 Firebase 저장 실패로 로컬에 미동기화 변경사항이 있으면,
  // 로컬 데이터를 Firebase에 먼저 밀어넣은 뒤 로드한다.
  if (localStorage.getItem(PENDING_SYNC_KEY) === 'true') {
    try {
      const local = localSnapshot()
      await saveRemotePatch(uid, local) // 성공 시 PENDING_SYNC_KEY 자동 삭제
      return local
    } catch {
      return localSnapshot()
    }
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
    return (await loadRemoteState(getStorageUid())).transactions
  } catch {
    return loadLocalTransactions()
  }
}

export async function saveTransactions(t: Transaction[]): Promise<void> {
  // 항상 로컬스토리지에 저장 (Firebase 실패 시 폴백용)
  safeSave(TRANSACTIONS_KEY, t)
  if (storageMode === 'local') return
  await saveRemotePatch(getStorageUid(), { transactions: t })
}

export async function loadMemos(): Promise<Memo[]> {
  if (storageMode === 'local') return loadLocalMemos()
  return (await loadRemoteState(getStorageUid())).memos
}

export async function saveMemos(m: Memo[]): Promise<void> {
  if (storageMode === 'local') {
    safeSave(MEMOS_KEY, m)
    return
  }
  await saveRemotePatch(getStorageUid(), { memos: m })
}

export async function loadBudgets(): Promise<Budget[]> {
  if (storageMode === 'local') return loadLocalBudgets()
  return (await loadRemoteState(getStorageUid())).budgets
}

export async function saveBudgets(b: Budget[]): Promise<void> {
  if (storageMode === 'local') {
    safeSave(BUDGETS_KEY, b)
    return
  }
  await saveRemotePatch(getStorageUid(), { budgets: b })
}

export async function loadRecurring(): Promise<RecurringTransaction[]> {
  if (storageMode === 'local') return loadLocalRecurring()
  return (await loadRemoteState(getStorageUid())).recurring
}

export async function saveRecurring(r: RecurringTransaction[]): Promise<void> {
  if (storageMode === 'local') {
    safeSave(RECURRING_KEY, r)
    return
  }
  await saveRemotePatch(getStorageUid(), { recurring: r })
}

export async function loadStockTrades(): Promise<StockTrade[]> {
  if (storageMode === 'local') return loadLocalStockTrades()
  return (await loadRemoteState(getStorageUid())).stockTrades
}

export async function saveStockTrades(trades: StockTrade[]): Promise<void> {
  if (storageMode === 'local') {
    safeSave(STOCK_TRADES_KEY, trades)
    return
  }
  await saveRemotePatch(getStorageUid(), { stockTrades: trades })
}

export async function loadSubscriptions(): Promise<Subscription[]> {
  if (storageMode === 'local') return loadLocalSubscriptions()
  try {
    return (await loadRemoteState(getStorageUid())).subscriptions
  } catch {
    return loadLocalSubscriptions()
  }
}

export async function saveSubscriptions(subs: Subscription[]): Promise<void> {
  safeSave(SUBSCRIPTIONS_KEY, subs)
  if (storageMode === 'local') return
  await saveRemotePatch(getStorageUid(), { subscriptions: subs })
}

export async function loadGoals(): Promise<SavingsGoal[]> {
  if (storageMode === 'local') return loadLocalGoals()
  try {
    return (await loadRemoteState(getStorageUid())).goals
  } catch {
    return loadLocalGoals()
  }
}

export async function saveGoals(goals: SavingsGoal[]): Promise<void> {
  safeSave(GOALS_KEY, goals)
  if (storageMode === 'local') return
  await saveRemotePatch(getStorageUid(), { goals })
}

export async function loadSettings(): Promise<AppSettings> {
  if (storageMode === 'local') return loadLocalSettings()
  return (await loadRemoteState(getStorageUid())).settings
}

export async function saveSettings(s: AppSettings): Promise<void> {
  if (storageMode === 'local') {
    safeSave(SETTINGS_KEY, s)
    return
  }
  await saveRemotePatch(getStorageUid(), { settings: s })
}
