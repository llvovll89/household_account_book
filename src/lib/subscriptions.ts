import type { RecurringTransaction, Subscription } from '../types'
import { shiftYM, toYearMonth } from './format'
import { getDaysUntilMonthDay } from './recurringSchedule'

export function isYearly(s: Pick<Subscription, 'cycle'>): boolean {
  return s.cycle === 'yearly'
}

/** 다음 결제일까지 남은 일수 (오늘이면 0). 연간 구독은 결제월·결제일 기준, 없는 날짜는 말일로 맞춘다 */
export function getDaysUntilNextBilling(s: Pick<Subscription, 'billingDay' | 'cycle' | 'billingMonth'>, today: Date): number {
  if (!isYearly(s)) return getDaysUntilMonthDay(s.billingDay, today)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const month = (s.billingMonth ?? 1) - 1
  const occurrence = (year: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(s.billingDay, lastDay))
  }
  let next = occurrence(start.getFullYear())
  if (next < start) next = occurrence(start.getFullYear() + 1)
  return Math.round((next.getTime() - start.getTime()) / 86_400_000)
}

/** 한 달 기준 원화 금액. USD는 환율이 있을 때만 환산하고, 없으면 null */
export function getMonthlyKrw(s: Pick<Subscription, 'amount' | 'currency' | 'cycle'>, usdKrwRate?: number): number | null {
  const krw = s.currency === 'USD' ? (usdKrwRate ? s.amount * usdKrwRate : null) : s.amount
  if (krw === null) return null
  return Math.round(isYearly(s) ? krw / 12 : krw)
}

export interface SubscriptionTotals {
  /** 한 달 기준 원화 합계 (연간 구독은 12로 나눔, 환산 가능한 USD 포함) */
  monthlyKrw: number
  annualKrw: number
  /** 환율이 없어 합계에서 빠진 USD 구독의 월 기준 합계 */
  unconvertedUsd: number
}

export function getSubscriptionTotals(subscriptions: Subscription[], usdKrwRate?: number): SubscriptionTotals {
  let monthlyKrw = 0
  let unconvertedUsd = 0
  for (const s of subscriptions) {
    const krw = getMonthlyKrw(s, usdKrwRate)
    if (krw === null) unconvertedUsd += isYearly(s) ? s.amount / 12 : s.amount
    else monthlyKrw += krw
  }
  return { monthlyKrw, annualKrw: monthlyKrw * 12, unconvertedUsd: Math.round(unconvertedUsd * 100) / 100 }
}

/** 매달·원화 구독만 정기 내역으로 자동 기록할 수 있다 (정기 내역은 월간·원화 기준) */
export function canAutoRecord(s: Pick<Subscription, 'cycle' | 'currency'>): boolean {
  return !isYearly(s) && s.currency === 'KRW'
}

/**
 * 구독의 '자동 기록' 설정에 맞춰 연결된 정기 내역을 만들거나 고치거나 지운다.
 * 새로 연결할 때 이번 달 결제일이 이미 지났으면 이번 달은 적용된 것으로 둔다 (이미 직접 적었을 수 있어 중복 방지).
 */
export function syncSubscriptionRecurring(
  sub: Subscription,
  autoRecord: boolean,
  recurring: RecurringTransaction[],
  today: Date,
  newId: () => string,
): { subscription: Subscription; recurring: RecurringTransaction[] } {
  const linked = sub.recurringId ? recurring.find((r) => r.id === sub.recurringId) : undefined
  if (!autoRecord || !canAutoRecord(sub)) {
    const { recurringId: _removed, ...rest } = sub
    void _removed
    return { subscription: rest, recurring: linked ? recurring.filter((r) => r.id !== linked.id) : recurring }
  }
  const fields = { type: 'expense' as const, category: sub.category, amount: sub.amount, description: sub.name, dayOfMonth: sub.billingDay }
  if (linked) {
    return { subscription: sub, recurring: recurring.map((r) => (r.id === linked.id ? { ...r, ...fields } : r)) }
  }
  const thisYM = toYearMonth(today)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const passed = today.getDate() >= Math.min(sub.billingDay, lastDay)
  const lastAppliedMonth = passed ? thisYM : shiftYM(thisYM, -1)
  const created: RecurringTransaction = { id: newId(), ...fields, frequency: 'monthly', lastAppliedMonth, createdAt: Date.now() }
  return { subscription: { ...sub, recurringId: created.id }, recurring: [...recurring, created] }
}
