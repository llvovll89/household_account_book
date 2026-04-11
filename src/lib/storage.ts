import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import type { Budget, Memo, RecurringTransaction, StockTrade, Transaction } from '../types'

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
const SETTINGS_KEY = 'hb_settings'

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
  settings: AppSettings
}

export interface AppDataSnapshot {
  transactions: Transaction[]
  memos: Memo[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  stockTrades: StockTrade[]
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

function loadLocalTransactions(): Transaction[] {
  return parseJSON(localStorage.getItem(TRANSACTIONS_KEY), [])
}

function loadLocalMemos(): Memo[] {
  return parseJSON(localStorage.getItem(MEMOS_KEY), [])
}

function loadLocalBudgets(): Budget[] {
  return parseJSON(localStorage.getItem(BUDGETS_KEY), [])
}

function loadLocalRecurring(): RecurringTransaction[] {
  return parseJSON(localStorage.getItem(RECURRING_KEY), [])
}

function loadLocalStockTrades(): StockTrade[] {
  return parseJSON(localStorage.getItem(STOCK_TRADES_KEY), [])
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
    settings,
  }
}

async function loadRemoteState(uid: string): Promise<RemoteState> {
  const snap = await getDoc(getUserDocRef(uid))
  return normalizeRemoteState(snap.data())
}

async function saveRemotePatch(uid: string, patch: Partial<RemoteState>): Promise<void> {
  await setDoc(
    getUserDocRef(uid),
    {
      ...patch,
      updatedAt: Date.now(),
    },
    { merge: true }
  )
}

function localSnapshot(): RemoteState {
  return {
    transactions: loadLocalTransactions(),
    memos: loadLocalMemos(),
    budgets: loadLocalBudgets(),
    recurring: loadLocalRecurring(),
    stockTrades: loadLocalStockTrades(),
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

  const remote = await loadRemoteState(uid)
  const merged: RemoteState = {
    transactions: mergeUniqueByKey(remote.transactions, local.transactions, txKey),
    memos: mergeUniqueByKey(remote.memos, local.memos, memoKey),
    budgets: mergeBudgets(remote.budgets, local.budgets),
    recurring: mergeRecurring(remote.recurring, local.recurring),
    stockTrades: mergeUniqueByKey(remote.stockTrades, local.stockTrades, stockKey),
    settings: mergeSettings(remote.settings, local.settings),
  }

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
    const local = localSnapshot()
    return {
      transactions: local.transactions,
      memos: local.memos,
      budgets: local.budgets,
      recurring: local.recurring,
      stockTrades: local.stockTrades,
      settings: local.settings,
    }
  }

  try {
    const remote = await loadRemoteState(getStorageUid())
    return {
      transactions: remote.transactions,
      memos: remote.memos,
      budgets: remote.budgets,
      recurring: remote.recurring,
      stockTrades: remote.stockTrades,
      settings: remote.settings,
    }
  } catch {
    // Firebase 실패 시 로컬스토리지 백업으로 폴백
    const local = localSnapshot()
    return {
      transactions: local.transactions,
      memos: local.memos,
      budgets: local.budgets,
      recurring: local.recurring,
      stockTrades: local.stockTrades,
      settings: local.settings,
    }
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
