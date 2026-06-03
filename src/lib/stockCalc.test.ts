import { describe, expect, it } from 'vitest'
import type { StockTrade } from '../types'
import { calcHoldings, calcRealizedPnLByTicker, calcTotalFee, calcTotalRealizedPnL } from './stockCalc'

function makeTrade(partial: Partial<StockTrade>): StockTrade {
  return {
    id: partial.id ?? 't',
    ticker: partial.ticker ?? 'AAPL',
    tradeType: partial.tradeType ?? 'buy',
    quantity: partial.quantity ?? 1,
    price: partial.price ?? 100,
    fee: partial.fee ?? 0,
    currency: partial.currency ?? 'USD',
    date: partial.date ?? '2026-01-01',
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? 1,
  }
}

describe('stockCalc', () => {
  it('FIFO 기준으로 보유수량/평균단가/실현손익을 계산한다', () => {
    const trades: StockTrade[] = [
      makeTrade({ id: 'b1', tradeType: 'buy', quantity: 10, price: 100, fee: 10, date: '2026-01-01', createdAt: 1 }),
      makeTrade({ id: 'b2', tradeType: 'buy', quantity: 5, price: 120, fee: 5, date: '2026-01-02', createdAt: 2 }),
      makeTrade({ id: 's1', tradeType: 'sell', quantity: 8, price: 130, fee: 8, date: '2026-01-03', createdAt: 3 }),
    ]

    const holdings = calcHoldings(trades)
    expect(holdings).toHaveLength(1)

    const aapl = holdings[0]
    expect(aapl.ticker).toBe('AAPL')
    expect(aapl.quantity).toBeCloseTo(7)
    expect(aapl.totalCost).toBeCloseTo(807)
    expect(aapl.avgBuyPrice).toBeCloseTo(115.285714, 5)
    expect(aapl.realizedPnL).toBeCloseTo(224)
    expect(aapl.totalFee).toBeCloseTo(23)

    expect(calcTotalRealizedPnL(trades)).toBeCloseTo(224)
    expect(calcRealizedPnLByTicker(trades)).toEqual({ AAPL: 224 })
    expect(calcTotalFee(trades)).toBe(23)
  })

  it('여러 종목은 ticker 오름차순으로 반환한다', () => {
    const trades: StockTrade[] = [
      makeTrade({ id: 'b2', ticker: 'MSFT', tradeType: 'buy', quantity: 1, price: 300, date: '2026-01-02', createdAt: 2 }),
      makeTrade({ id: 'b1', ticker: 'AAPL', tradeType: 'buy', quantity: 1, price: 100, date: '2026-01-01', createdAt: 1 }),
    ]

    const holdings = calcHoldings(trades)
    expect(holdings.map((h) => h.ticker)).toEqual(['AAPL', 'MSFT'])
  })

  it('보유수량보다 많은 매도는 남은 큐까지만 소진하고 음수 보유를 만들지 않는다', () => {
    const trades: StockTrade[] = [
      makeTrade({ id: 'b1', tradeType: 'buy', quantity: 2, price: 100, fee: 0, date: '2026-01-01', createdAt: 1 }),
      makeTrade({ id: 's1', tradeType: 'sell', quantity: 5, price: 110, fee: 5, date: '2026-01-02', createdAt: 2 }),
    ]

    const holdings = calcHoldings(trades)
    expect(holdings).toHaveLength(0)
    expect(calcTotalRealizedPnL(trades)).toBeCloseTo(18)
  })
})
