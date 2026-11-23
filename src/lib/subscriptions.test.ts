import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { getDaysUntilNextBilling, getSubscriptionTotals, syncSubscriptionRecurring } from './subscriptions'

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

describe('syncSubscriptionRecurring', () => {
  const today = new Date(2026, 10, 20)
  const base = sub({ id: 's', name: '넷플릭스', amount: 17000, billingDay: 25 })
  const ids = () => 'r1'

  it('creates a linked monthly recurring item that waits for this month when the day is ahead', () => {
    const { subscription, recurring } = syncSubscriptionRecurring(base, true, [], today, ids)
    expect(subscription.recurringId).toBe('r1')
    expect(recurring).toEqual([expect.objectContaining({ id: 'r1', type: 'expense', amount: 17000, description: '넷플릭스', dayOfMonth: 25, lastAppliedMonth: '2026-10' })])
  })

  it('treats this month as done when the billing day already passed', () => {
    const { recurring } = syncSubscriptionRecurring({ ...base, billingDay: 5 }, true, [], today, ids)
    expect(recurring[0].lastAppliedMonth).toBe('2026-11')
  })

  it('updates the linked item and removes it when turned off or switched to USD', () => {
    const linked = syncSubscriptionRecurring(base, true, [], today, ids)
    const updated = syncSubscriptionRecurring({ ...linked.subscription, amount: 18000 }, true, linked.recurring, today, ids)
    expect(updated.recurring).toEqual([expect.objectContaining({ id: 'r1', amount: 18000, lastAppliedMonth: '2026-10' })])
    const usd = syncSubscriptionRecurring({ ...updated.subscription, currency: 'USD' }, true, updated.recurring, today, ids)
    expect(usd.recurring).toEqual([])
    expect(usd.subscription.recurringId).toBeUndefined()
  })
})
