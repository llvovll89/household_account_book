import type { Transaction, Memo, Budget, RecurringTransaction } from '../types'

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

export function loadTransactions(): Transaction[] {
  try { return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]') } catch { return [] }
}
export function saveTransactions(t: Transaction[]): void {
  safeSave(TRANSACTIONS_KEY, t)
}

export function loadMemos(): Memo[] {
  try { return JSON.parse(localStorage.getItem(MEMOS_KEY) || '[]') } catch { return [] }
}
export function saveMemos(m: Memo[]): void {
  safeSave(MEMOS_KEY, m)
}

export function loadBudgets(): Budget[] {
  try { return JSON.parse(localStorage.getItem(BUDGETS_KEY) || '[]') } catch { return [] }
}
export function saveBudgets(b: Budget[]): void {
  safeSave(BUDGETS_KEY, b)
}

const RECURRING_KEY = 'hb_recurring'
export function loadRecurring(): RecurringTransaction[] {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]') } catch { return [] }
}
export function saveRecurring(r: RecurringTransaction[]): void {
  safeSave(RECURRING_KEY, r)
}

const SETTINGS_KEY = 'hb_settings'
export interface AppSettings {
  payday: number | 'last' | null // 1-31 or 'last' for end of month
}
export function loadSettings(): AppSettings {
  try { return { payday: null, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } } catch { return { payday: null } }
}
export function saveSettings(s: AppSettings): void {
  safeSave(SETTINGS_KEY, s)
}
