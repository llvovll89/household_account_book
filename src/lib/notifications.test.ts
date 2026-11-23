import { expect, it } from 'vitest'
import type { Transaction } from '../types'
import { buildNotifications } from './notifications'

const today = new Date(2026, 10, 23, 21, 0)
const base = { transactions: [] as Transaction[], budgets: [], recurring: [], subscriptions: [], userPaymentMethods: [], today }
const tx = (date: string, amount = 1000, category = '식비'): Transaction => ({ id: date + amount, type: 'expense', amount, category, description: '', date, createdAt: 1 })

it('lists payments due today or tomorrow, highest priority first', () => {
  const list = buildNotifications({
    ...base,
    transactions: [tx('2026-11-23')],
    subscriptions: [
      { id: 'n', name: '넷플릭스', amount: 17000, currency: 'KRW', billingDay: 24, category: '문화/여가', memo: '', createdAt: 1 },
      { id: 'far', name: '멀리', amount: 1, currency: 'KRW', billingDay: 30, category: '문화/여가', memo: '', createdAt: 1 },
    ],
    recurring: [{ id: 'rent', type: 'expense', category: '주거비', amount: 500000, description: '월세', dayOfMonth: 23, lastAppliedMonth: '2026-10', createdAt: 1 }],
    userPaymentMethods: [{ id: 'card', type: 'credit', label: '현대카드', billingDay: 24 }],
  })
  expect(list.map((n) => n.title)).toEqual(['월세 오늘 나가요', '넷플릭스 결제 내일', '현대카드 결제일 내일'])
})

it('warns at 80% and 100% of a budget with month-stage ids', () => {
  const list = buildNotifications({ ...base, transactions: [tx('2026-11-23', 85000)], budgets: [{ category: '식비', limit: 100000 }] })
  expect(list).toEqual([expect.objectContaining({ id: 'budget:식비:2026-11:80', title: '식비 예산 85% 사용' })])
})

it('reminds after two days without records but not for new users', () => {
  expect(buildNotifications({ ...base, transactions: [tx('2026-11-20')] }).map((n) => n.title)).toEqual(['3일째 기록이 없어요'])
  expect(buildNotifications(base)).toEqual([])
})
