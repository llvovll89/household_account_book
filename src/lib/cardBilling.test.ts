import { describe, expect, it } from 'vitest'
import {
  calculateCardDueAmount,
  getBillingStage,
  getCardBillingRange,
  getStatementYMForCardExpense,
  resolveCardBillingDay,
  shiftYM,
} from './cardBilling'
import type { Transaction, UserPaymentMethod } from '../types'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    type: 'expense',
    amount: 1000,
    category: '식비',
    description: '',
    date: '2026-07-01',
    createdAt: 1,
    paymentMethod: 'credit',
    ...overrides,
  }
}

describe('cardBilling', () => {
  it('statement 월의 청구 기간 시작/종료일을 계산한다', () => {
    const range = getCardBillingRange('2026-07', 25)

    expect(range).toEqual({ start: '2026-06-26', end: '2026-07-25' })
  })

  it('billingDay가 말일보다 크면 말일로 보정한다(2월)', () => {
    const range = getCardBillingRange('2026-03', 31)

    expect(range).toEqual({ start: '2026-03-01', end: '2026-03-31' })
  })

  it('결제일 기준으로 거래의 청구월을 계산한다', () => {
    expect(getStatementYMForCardExpense('2026-07-10', 10)).toBe('2026-07')
    expect(getStatementYMForCardExpense('2026-07-11', 10)).toBe('2026-08')
  })

  it('calculateCardDueAmount는 카드 지출만 해당 청구월로 합산한다', () => {
    const transactions: Transaction[] = [
      tx({ id: '1', amount: 10000, date: '2026-07-10', paymentMethod: 'credit' }),
      tx({ id: '2', amount: 20000, date: '2026-07-11', paymentMethod: 'credit' }),
      tx({ id: '3', amount: 30000, date: '2026-07-15', paymentMethod: 'cash' }),
      tx({ id: '4', type: 'income', amount: 40000, date: '2026-07-20', paymentMethod: 'credit' }),
    ]

    const julyDue = calculateCardDueAmount(transactions, '2026-07', 10)
    const augustDue = calculateCardDueAmount(transactions, '2026-08', 10)

    expect(julyDue).toBe(10000)
    expect(augustDue).toBe(20000)
  })

  it('resolveCardBillingDay는 결제수단 billingDay를 우선 사용한다', () => {
    const methods: UserPaymentMethod[] = [
      { id: 'cash', type: 'cash', label: '현금' },
      { id: 'credit_1', type: 'credit', label: '신용카드', billingDay: 12 },
    ]

    const day = resolveCardBillingDay(
      tx({ paymentMethodId: 'credit_1', creditBillingDay: 20 }),
      methods,
      25,
    )

    expect(day).toBe(12)
  })

  it('shiftYM과 getBillingStage가 월 이동/단계를 올바르게 반환한다', () => {
    expect(shiftYM('2026-12', 1)).toBe('2027-01')
    expect(getBillingStage('2026-07', '2026-07')).toBe('current')
    expect(getBillingStage('2026-07', '2026-08')).toBe('next')
    expect(getBillingStage('2026-07', '2026-10')).toBe('later')
    expect(getBillingStage('2026-07', '2026-06')).toBe('past')
  })
})
