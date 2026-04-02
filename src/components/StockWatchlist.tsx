import { useMemo, useState } from 'react'
import { Plus, Star, Trash2, TrendingUp } from 'lucide-react'
import type { StockTrade } from '../types'
import { calcHoldings } from '../lib/stockCalc'
import { fmt, fmtQty } from '../lib/format'

interface Props {
  trades: StockTrade[]
  watchlist: string[]
  onAdd: (ticker: string) => void
  onRemove: (ticker: string) => void
}

export default function StockWatchlist({ trades, watchlist, onAdd, onRemove }: Props) {
  const [inputTicker, setInputTicker] = useState('')
  const holdings = useMemo(() => calcHoldings(trades), [trades])

  const watchItems = useMemo(() => {
    return watchlist.map((ticker) => {
      const h = holdings.find((item) => item.ticker === ticker)
      const tradeCount = trades.filter((t) => t.ticker === ticker).length
      return { ticker, holding: h ?? null, tradeCount }
    })
  }, [holdings, trades, watchlist])

  function handleAdd() {
    const ticker = inputTicker.trim().toUpperCase()
    if (!ticker) return
    onAdd(ticker)
    setInputTicker('')
  }

  return (
    <div className="space-y-3 tab-content">
      <div className="bg-[#1E2236] rounded-2xl p-3">
        <p className="text-sm font-bold text-white mb-2">관심종목 추가</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputTicker}
            onChange={(e) => setInputTicker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="예: AAPL, 삼성전자"
            className="flex-1 bg-[#252A3F] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4E5968] focus:outline-none"
          />
          <button
            onClick={handleAdd}
            className="w-10 h-10 rounded-xl bg-[#F5BE3A] text-[#0D0F14] flex items-center justify-center font-bold"
            aria-label="관심종목 추가"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {watchItems.length === 0 ? (
        <div className="bg-[#1E2236] rounded-3xl p-10 text-center">
          <p className="text-4xl mb-3">⭐</p>
          <p className="font-bold text-white text-[15px]">관심종목이 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">종목을 추가해 빠르게 모아보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {watchItems.map((item) => (
            <div key={item.ticker} className="bg-[#1E2236] rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F5BE3A]/15 flex items-center justify-center shrink-0">
                <Star size={16} className="text-[#F5BE3A]" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{item.ticker}</p>
                {item.holding ? (
                  <p className="text-[11px] text-[#8B95A1]">보유 {fmtQty(item.holding.quantity)}주 · 원가 {fmt(item.holding.totalCost)}원</p>
                ) : (
                  <p className="text-[11px] text-[#4E5968]">보유 없음 · 거래 {item.tradeCount}건</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-[#252A3F] flex items-center justify-center">
                  <TrendingUp size={12} className="text-[#3D8EF8]" />
                </div>
                <button
                  onClick={() => onRemove(item.ticker)}
                  className="w-7 h-7 rounded-lg bg-[#252A3F] flex items-center justify-center text-[#8B95A1] hover:text-[#F25260] transition-colors"
                  aria-label={`${item.ticker} 삭제`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
