import type { StockTrade, StockHolding } from '../types'

interface FifoResult {
  queues: Record<string, { qty: number; unitCost: number }[]>
  realizedPnL: Record<string, number>
  totalFees: Record<string, number>
}

function runFifo(trades: StockTrade[]): FifoResult {
  const sorted = [...trades].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt
  )
  const queues: Record<string, { qty: number; unitCost: number }[]> = {}
  const realizedPnL: Record<string, number> = {}
  const totalFees: Record<string, number> = {}

  for (const trade of sorted) {
    const { ticker, tradeType, quantity, price, fee } = trade
    if (!queues[ticker]) queues[ticker] = []
    if (!realizedPnL[ticker]) realizedPnL[ticker] = 0
    if (!totalFees[ticker]) totalFees[ticker] = 0

    totalFees[ticker] += fee

    if (tradeType === 'buy') {
      queues[ticker].push({ qty: quantity, unitCost: price + (quantity > 0 ? fee / quantity : 0) })
    } else {
      let remaining = quantity
      while (remaining > 0 && queues[ticker].length > 0) {
        const lot = queues[ticker][0]
        const used = Math.min(lot.qty, remaining)
        realizedPnL[ticker] += (price - lot.unitCost) * used - fee * (used / quantity)
        lot.qty -= used
        remaining -= used
        if (lot.qty <= 0.00001) queues[ticker].shift()
      }
    }
  }

  return { queues, realizedPnL, totalFees }
}

export function calcHoldings(trades: StockTrade[]): StockHolding[] {
  const { queues, realizedPnL, totalFees } = runFifo(trades)

  const holdings: StockHolding[] = []
  for (const ticker of Object.keys(queues)) {
    const lots = queues[ticker]
    const totalQty = lots.reduce((s, l) => s + l.qty, 0)
    if (totalQty < 0.00001) continue

    const totalCost = lots.reduce((s, l) => s + l.qty * l.unitCost, 0)
    holdings.push({
      ticker,
      quantity: totalQty,
      avgBuyPrice: totalQty > 0 ? totalCost / totalQty : 0,
      totalCost,
      realizedPnL: realizedPnL[ticker] ?? 0,
      totalFee: totalFees[ticker] ?? 0,
    })
  }

  return holdings.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

export function calcTotalRealizedPnL(trades: StockTrade[]): number {
  const { realizedPnL } = runFifo(trades)
  return Object.values(realizedPnL).reduce((s, v) => s + v, 0)
}

export function calcTotalFee(trades: StockTrade[]): number {
  return trades.reduce((s, t) => s + t.fee, 0)
}

export function calcRealizedPnLByTicker(trades: StockTrade[]): Record<string, number> {
  return runFifo(trades).realizedPnL
}
