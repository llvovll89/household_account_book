import type { Subscription } from '../types'
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
