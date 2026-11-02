import type { AppDataSnapshot } from './storage'

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024
export const BACKUP_FORMAT = 'balance-plan-backup'
export interface BackupFile { format: typeof BACKUP_FORMAT; version: 1; createdAt: string; data: AppDataSnapshot }
type Reader = (value: unknown, path: string) => unknown
const invalid = (path: string): never => { throw new Error(`${path}: 백업 항목의 형식이나 값이 올바르지 않아요.`) }
const text: Reader = (v, p) => typeof v === 'string' ? v : invalid(p)
const nonempty: Reader = (v, p) => typeof v === 'string' && v.trim() ? v : invalid(p)
const bool: Reader = (v, p) => typeof v === 'boolean' ? v : invalid(p)
const money: Reader = (v, p) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : invalid(p)
const decimal: Reader = (v, p) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER ? v : invalid(p)
const range = (min: number, max: number): Reader => (v, p) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : invalid(p)
const choice = (...values: unknown[]): Reader => (v, p) => values.includes(v) ? v : invalid(p)
const optional = (read: Reader): Reader => (v, p) => v === undefined ? undefined : read(v, p)
const nullable = (read: Reader): Reader => (v, p) => v === null ? null : read(v, p)
const emptyOr = (read: Reader): Reader => (v, p) => v === '' ? '' : read(v, p)
const month: Reader = (v, p) => typeof v === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(v) && !v.startsWith('0000') ? v : invalid(p)
const date: Reader = (v, p) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000')) return invalid(p)
  const parsed = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v ? v : invalid(p)
}
const url: Reader = (v, p) => {
  if (v === '') return v
  if (typeof v !== 'string') return invalid(p)
  try { return ['http:', 'https:'].includes(new URL(v).protocol) ? v : invalid(p) } catch { return invalid(p) }
}
function object(shape: Record<string, Reader>): Reader {
  return (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid(p)
    const source = v as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, read] of Object.entries(shape)) {
      const value = read(source[key], `${p}.${key}`)
      if (value !== undefined) result[key] = value
    }
    return result
  }
}
const list = (read: Reader, unique?: (v: unknown) => string): Reader => (v, p) => {
  if (!Array.isArray(v)) return invalid(p)
  const result = v.map((item, i) => read(item, `${p}[${i}]`))
  if (unique && new Set(result.map(unique)).size !== result.length) throw new Error(`${p}: 같은 식별자의 항목이 중복되어 있어요.`)
  return result
}
const byId = (v: unknown) => (v as { id: string }).id
const type = choice('income', 'expense')
const day = range(1, 31)
const payment = { paymentMethod: optional(choice('cash', 'check', 'credit', 'card', 'transfer')), paymentMethodId: optional(text) }
const baseEntry = { id: nonempty, type, amount: money, category: nonempty, description: text, createdAt: money, ...payment }
const transaction = object({ ...baseEntry, date, dateEnd: optional(emptyOr(date)), tags: optional(list(text)), creditBillingDay: optional(day), receiptImageUrl: optional(url), loanPrincipal: optional(money), loanInterest: optional(money) })
const memo = object({ id: nonempty, title: text, content: text, pinned: bool, createdAt: money, updatedAt: money, date: optional(emptyOr(date)), dateEnd: optional(emptyOr(date)), category: optional(text) })
const budget = object({ category: nonempty, limit: money, carryover: optional(bool), yearMonth: optional(month) })
const recurring = object({ ...baseEntry, frequency: optional(choice('monthly', 'weekly', 'biweekly')), dayOfMonth: day, weekday: optional(range(0, 6)), lastAppliedMonth: emptyOr(month), lastAppliedDate: optional(emptyOr(date)), creditBillingDay: optional(day) })
const subscription = object({ id: nonempty, name: nonempty, amount: decimal, currency: choice('KRW', 'USD'), billingDay: day, category: nonempty, memo: text, color: optional(text), createdAt: money })
const goal = object({ id: nonempty, name: nonempty, targetAmount: money, currentAmount: money, emoji: text, color: text, deadline: optional(emptyOr(date)), memo: text, createdAt: money, linkedCategory: optional(text), linkedTags: optional(list(text)) })
const settings = object({
  payday: nullable((v, p) => v === 'last' ? v : day(v, p)), cardBillingDay: nullable(day),
  userPaymentMethods: list(object({ id: nonempty, type: choice('cash', 'check', 'credit', 'transfer'), label: nonempty, billingDay: optional(day) }), byId),
  customExpenseCategories: list(nonempty), customIncomeCategories: list(nonempty),
  transactionTemplates: list(object({ ...baseEntry, label: nonempty }), byId),
  swipeSensitivity: optional(choice('low', 'medium', 'high')),
  autoCategoryRules: list(object({ id: nonempty, keyword: nonempty, category: nonempty, type, enabled: bool }), byId),
  hiddenWidgets: list(choice('month-close-helper', 'subscription-alert', 'recurring-pending', 'sparkline-summary', 'today-spending', 'health-score', 'spending-pace', 'weekly-comparison', 'timeofday-spending', 'top3-expenses', 'payday-countdown', 'net-worth', 'goal-daily-needed', 'spending-spike', 'spending-savings')),
})
const snapshot = object({ transactions: list(transaction, byId), memos: list(memo, byId), budgets: list(budget, v => { const b = v as { category: string; yearMonth?: string }; return JSON.stringify([b.category, b.yearMonth ?? '']) }), recurring: list(recurring, byId), subscriptions: list(subscription, byId), goals: list(goal, byId), settings })

/** Reconstruct only known fields; reject bad records rather than silently dropping them. */
export function validateBackupData(value: unknown): AppDataSnapshot {
  const data = snapshot(value, 'data') as AppDataSnapshot
  for (const item of [...data.transactions, ...data.memos]) {
    if (item.date && item.dateEnd && item.dateEnd < item.date) invalid(`data.${item.id}.dateEnd`)
  }
  for (const item of data.recurring) {
    if (item.frequency && item.frequency !== 'monthly' && item.weekday === undefined) invalid(`data.${item.id}.weekday`)
  }
  return data
}

export function createBackup(data: AppDataSnapshot): string {
  const file: BackupFile = { format: BACKUP_FORMAT, version: 1, createdAt: new Date().toISOString(), data: validateBackupData(data) }
  const text = JSON.stringify(file, null, 2)
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 10MB 이하여야 해요.')
  return text
}

export function parseBackup(text: string): BackupFile {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 10MB 이하여야 해요.')
  let value: unknown
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('JSON 파일을 읽을 수 없어요. 잔고플랜 전체 백업 파일을 선택해주세요.') }
  if (!value || typeof value !== 'object') return invalid('file')
  const file = value as Record<string, unknown>
  if (file.format !== BACKUP_FORMAT || file.version !== 1) throw new Error('지원하지 않는 백업 형식 또는 버전이에요.')
  if (typeof file.createdAt !== 'string' || Number.isNaN(Date.parse(file.createdAt))) return invalid('createdAt')
  return { format: BACKUP_FORMAT, version: 1, createdAt: file.createdAt, data: validateBackupData(file.data) }
}
