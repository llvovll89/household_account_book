import type { PaymentMethod, Transaction } from '../types'

export interface CardBillingRange {
  start: string
  end: string
}

function parseYM(ym: string): { year: number; month: number } {
  const [year, month] = ym.split('-').map(Number)
  return { year, month }
}

function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}

function toPrevYM(ym: string): string {
  const { year, month } = parseYM(ym)
  if (month === 1) return `${year - 1}-12`
  return `${year}-${String(month - 1).padStart(2, '0')}`
}

function toNextYM(ym: string): string {
  const { year, month } = parseYM(ym)
  if (month === 12) return `${year + 1}-01`
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function shiftYM(ym: string, monthOffset: number): string {
  const { year, month } = parseYM(ym)
  const base = new Date(year, month - 1 + monthOffset, 1)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
}

function ymToMonthIndex(ym: string): number {
  const { year, month } = parseYM(ym)
  return year * 12 + (month - 1)
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function getCardBillingRange(statementYM: string, billingDay: number): CardBillingRange {
  const current = parseYM(statementYM)
  const previous = parseYM(toPrevYM(statementYM))

  const currentDay = clampDay(current.year, current.month, billingDay)
  const previousDay = clampDay(previous.year, previous.month, billingDay)

  const prevStatement = formatYMD(previous.year, previous.month, previousDay)
  const currentStatement = formatYMD(current.year, current.month, currentDay)

  return {
    start: addDays(prevStatement, 1),
    end: currentStatement,
  }
}

export function calculateCardDueAmount(transactions: Transaction[], statementYM: string, billingDay: number): number {
  return transactions
    .filter((t) => t.type === 'expense' && isCreditPaymentMethod(t.paymentMethod))
    .filter((t) => getStatementYMForCardExpense(t.date, getTransactionBillingDay(t, billingDay)) === statementYM)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function formatBillingRange(range: CardBillingRange): string {
  const [, sm, sd] = range.start.split('-')
  const [, em, ed] = range.end.split('-')
  return `${Number(sm)}.${sd} ~ ${Number(em)}.${ed}`
}

export function getStatementYMForCardExpense(date: string, billingDay: number): string {
  const ym = date.slice(0, 7)
  const day = Number(date.slice(8, 10))

  if (!Number.isFinite(day)) return ym
  return day <= billingDay ? ym : toNextYM(ym)
}

export function isCreditPaymentMethod(method?: PaymentMethod): boolean {
  return method === 'credit' || method === 'card'
}

function isValidBillingDay(day?: number): day is number {
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31
}

export function getTransactionBillingDay(transaction: Transaction, fallbackBillingDay: number): number {
  return isValidBillingDay(transaction.creditBillingDay) ? transaction.creditBillingDay : fallbackBillingDay
}

export type BillingStage = 'current' | 'next' | 'later' | 'past'

export function getBillingStage(currentYM: string, statementYM: string): BillingStage {
  const diff = ymToMonthIndex(statementYM) - ymToMonthIndex(currentYM)
  if (diff === 0) return 'current'
  if (diff === 1) return 'next'
  if (diff > 1) return 'later'
  return 'past'
}
