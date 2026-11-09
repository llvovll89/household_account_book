import type { PaymentMethod, Transaction, UserPaymentMethod } from '../types'
import { PAYMENT_METHOD_LABEL } from '../types'
import { parseYmdLocal, shiftYM, toLocalDateStr } from './format'

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

function ymToMonthIndex(ym: string): number {
  const { year, month } = parseYM(ym)
  return year * 12 + (month - 1)
}

function addDays(ymd: string, days: number): string {
  const d = parseYmdLocal(ymd)
  d.setDate(d.getDate() + days)
  return toLocalDateStr(d)
}

export function getCardBillingRange(statementYM: string, billingDay: number): CardBillingRange {
  const current = parseYM(statementYM)
  const previous = parseYM(shiftYM(statementYM, -1))

  const currentDay = clampDay(current.year, current.month, billingDay)
  const previousDay = clampDay(previous.year, previous.month, billingDay)

  const prevStatement = formatYMD(previous.year, previous.month, previousDay)
  const currentStatement = formatYMD(current.year, current.month, currentDay)

  return {
    start: addDays(prevStatement, 1),
    end: currentStatement,
  }
}

/** 거래 목록·상세와 같은 결제일 기준(resolveCardBillingDay)으로 청구월 합계를 계산한다 */
export function calculateCardDueAmount(
  transactions: Transaction[],
  statementYM: string,
  billingDay: number,
  methods: UserPaymentMethod[] = [],
): number {
  return transactions
    .filter((t) => t.type === 'expense' && isCreditPaymentMethod(t.paymentMethod))
    .filter((t) => getStatementYMForCardExpense(t.date, resolveCardBillingDay(t, methods, billingDay)) === statementYM)
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
  return day <= billingDay ? ym : shiftYM(ym, 1)
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

export function resolvePaymentMethod(
  tx: Transaction,
  methods: UserPaymentMethod[]
): { type: 'cash' | 'check' | 'credit' | 'transfer'; label: string; billingDay?: number } {
  if (tx.paymentMethodId) {
    const found = methods.find((m) => m.id === tx.paymentMethodId)
    if (found) return { type: found.type, label: found.label, billingDay: found.billingDay }
  }
  const type: 'cash' | 'check' | 'credit' | 'transfer' =
    isCreditPaymentMethod(tx.paymentMethod) ? 'credit'
    : tx.paymentMethod === 'transfer' ? 'transfer'
    : tx.paymentMethod === 'check' ? 'check'
    : 'cash'
  const label = PAYMENT_METHOD_LABEL[tx.paymentMethod ?? 'cash']
  const creditCard = methods.find((m) => m.type === 'credit')
  return { type, label, billingDay: type === 'credit' ? creditCard?.billingDay : undefined }
}

export function resolveCardBillingDay(
  tx: Transaction,
  methods: UserPaymentMethod[],
  globalFallback: number
): number {
  if (tx.paymentMethodId) {
    const found = methods.find((m) => m.id === tx.paymentMethodId)
    if (found?.billingDay && isValidBillingDay(found.billingDay)) return found.billingDay
  }
  if (isValidBillingDay(tx.creditBillingDay)) return tx.creditBillingDay
  const creditCard = methods.find((m) => m.type === 'credit')
  if (creditCard?.billingDay && isValidBillingDay(creditCard.billingDay)) return creditCard.billingDay
  return globalFallback
}
