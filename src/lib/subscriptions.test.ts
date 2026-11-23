import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { getDaysUntilNextBilling, getSubscriptionTotals } from './subscriptions'

const sub = (extra: Partial<Subscription>): Subscription =>
  ({ id: 'x', name: 'x', amount: 10000, currency: 'KRW', billingDay: 15, category: '문화/여가', memo: '', createdAt: 1, ...extra })

describe('getDaysUntilNextBilling', () => {
  it('counts monthly subscriptions to this or next month', () => {
    expect(getDaysUntilNextBilling(sub({}), new Date(2026, 10, 10))).toBe(5)
  })

  it('counts yearly subscriptions to their billing month, rolling to next year', () => {
    expect(getDaysUntilNextBilling(sub({ cycle: 'yearly', billingMonth: 12, billingDay: 1 }), new Date(2026, 10, 23))).toBe(8)
    expect(getDaysUntilNextBilling(sub({ cycle: 'yearly', billingMonth: 3, billingDay: 1 }), new Date(2026, 10, 23))).toBe(98)
  })

  it('clamps a yearly Feb 30 billing day to the month end', () => {
    expect(getDaysUntilNextBilling(sub({ cycle: 'yearly', billingMonth: 2, billingDay: 30 }), new Date(2027, 1, 1))).toBe(27)
  })
})

describe('getSubscriptionTotals', () => {
  const list = [
    sub({ amount: 17000 }),
    sub({ amount: 120000, cycle: 'yearly', billingMonth: 1 }),
    sub({ amount: 10, currency: 'USD' }),
  ]

  it('spreads yearly plans over 12 months and converts USD with a rate', () => {
    expect(getSubscriptionTotals(list, 1400)).toEqual({ monthlyKrw: 17000 + 10000 + 14000, annualKrw: 41000 * 12, unconvertedUsd: 0 })
  })

  it('reports USD separately when no rate is set', () => {
    expect(getSubscriptionTotals(list)).toEqual({ monthlyKrw: 27000, annualKrw: 27000 * 12, unconvertedUsd: 10 })
  })
})
