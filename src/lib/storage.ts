import type { Transaction, Memo, Budget, RecurringTransaction } from '../types'

const TRANSACTIONS_KEY = 'hb_transactions'
const MEMOS_KEY = 'hb_memos'
const BUDGETS_KEY = 'hb_budgets'

export function loadTransactions(): Transaction[] {
  try { return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]') } catch { return [] }
}
export function saveTransactions(t: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(t))
}

export function loadMemos(): Memo[] {
  try { return JSON.parse(localStorage.getItem(MEMOS_KEY) || '[]') } catch { return [] }
}
export function saveMemos(m: Memo[]): void {
  localStorage.setItem(MEMOS_KEY, JSON.stringify(m))
}

export function loadBudgets(): Budget[] {
  try { return JSON.parse(localStorage.getItem(BUDGETS_KEY) || '[]') } catch { return [] }
}
export function saveBudgets(b: Budget[]): void {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(b))
}

const RECURRING_KEY = 'hb_recurring'
export function loadRecurring(): RecurringTransaction[] {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]') } catch { return [] }
}
export function saveRecurring(r: RecurringTransaction[]): void {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(r))
}

const SETTINGS_KEY = 'hb_settings'
export interface AppSettings {
  payday: number | null // 1-31
}
export function loadSettings(): AppSettings {
  try { return { payday: null, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } } catch { return { payday: null } }
}
export function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}
