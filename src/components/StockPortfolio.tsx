import { useMemo, useState } from 'react'
import { TrendingUp, ChevronRight } from 'lucide-react'
import type { StockTrade } from '../types'
import { calcHoldings, calcTotalRealizedPnL, calcTotalFee } from '../lib/stockCalc'
import { fmt, fmtQty } from '../lib/format'
import StockDetailModal from './StockDetailModal'

interface Props {
  trades: StockTrade[]
  onEdit: (trade: StockTrade) => void
  onDelete: (id: string) => void
}

type SortKey = 'costDesc' | 'pnlDesc' | 'nameAsc'

export default function StockPortfolio({ trades, onEdit, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('costDesc')
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const holdings = useMemo(() => calcHoldings(trades), [trades])
  const totalRealizedPnL = useMemo(() => calcTotalRealizedPnL(trades), [trades])
  const totalFee = useMemo(() => calcTotalFee(trades), [trades])
  const totalHoldingCost = useMemo(() => holdings.reduce((s, h) => s + h.totalCost, 0), [holdings])

  const sortedHoldings = useMemo(() => {
    const next = [...holdings]
    if (sortKey === 'costDesc') {
      next.sort((a, b) => b.totalCost - a.totalCost)
    } else if (sortKey === 'pnlDesc') {
      next.sort((a, b) => b.realizedPnL - a.realizedPnL)
    } else {
      next.sort((a, b) => a.ticker.localeCompare(b.ticker))
    }
    return next
  }, [holdings, sortKey])

  if (trades.length === 0) {
    return (
      <div className="space-y-3 tab-content">
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">🧭</p>
          <p className="font-bold text-white text-[15px]">포트폴리오 데이터가 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">+ 버튼으로 거래를 추가하면 자동으로 구성돼요</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3 tab-content">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
            <p className="text-[10px] text-[#4E5968] font-semibold mb-1">총 투자원가</p>
            <p className="text-[15px] font-extrabold text-white num">{fmt(totalHoldingCost)}원</p>
          </div>
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
            <p className="text-[10px] text-[#4E5968] font-semibold mb-1">실현 손익</p>
            <p className={`text-[15px] font-extrabold num ${
              totalRealizedPnL > 0 ? 'text-[#2ACF6A]' : totalRealizedPnL < 0 ? 'text-[#F25260]' : 'text-[#8B95A1]'
            }`}>
              {totalRealizedPnL >= 0 ? '+' : ''}{fmt(totalRealizedPnL)}원
            </p>
          </div>
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
            <p className="text-[10px] text-[#4E5968] font-semibold mb-1">누적 수수료</p>
            <p className="text-[15px] font-extrabold text-[#8B95A1] num">{fmt(totalFee)}원</p>
          </div>
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
            <p className="text-[10px] text-[#4E5968] font-semibold mb-1">보유 종목</p>
            <p className="text-[15px] font-extrabold text-white num">{holdings.length}개</p>
          </div>
        </div>

        <div className="bg-[#1E2236] rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-white">보유 비중</p>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-[#252A3F] text-[11px] font-semibold text-[#C8D1DC] rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="costDesc">원가 큰 순</option>
              <option value="pnlDesc">실현손익 순</option>
              <option value="nameAsc">이름 순</option>
            </select>
          </div>

          <div className="space-y-2">
            {sortedHoldings.map((h) => {
              const weight = totalHoldingCost > 0 ? (h.totalCost / totalHoldingCost) * 100 : 0
              const pnlColor = h.realizedPnL > 0 ? 'text-[#2ACF6A]' : h.realizedPnL < 0 ? 'text-[#F25260]' : 'text-[#8B95A1]'
              return (
                <button
                  key={h.ticker}
                  onClick={() => setSelectedTicker(h.ticker)}
                  className="w-full text-left rounded-xl bg-[#252A3F] px-3 py-2.5 active:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#3D8EF8]/15 flex items-center justify-center shrink-0">
                      <TrendingUp size={14} className="text-[#3D8EF8]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{h.ticker}</p>
                      <p className="text-[11px] text-[#8B95A1]">{fmtQty(h.quantity)}주 · 평단 {fmt(h.avgBuyPrice)}원</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white num">{fmt(h.totalCost)}원</p>
                      <p className={`text-[11px] font-semibold num ${pnlColor}`}>실현 {h.realizedPnL >= 0 ? '+' : ''}{fmt(h.realizedPnL)}</p>
                    </div>
                    <ChevronRight size={14} className="text-[#4E5968]" />
                  </div>

                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-black/25 overflow-hidden">
                      <div className="h-full rounded-full bg-[#3D8EF8]" style={{ width: `${Math.max(2, Math.min(weight, 100))}%` }} />
                    </div>
                    <p className="text-[10px] text-[#8B95A1] mt-1 text-right">비중 {weight.toFixed(1)}%</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {selectedTicker && (
        <StockDetailModal
          ticker={selectedTicker}
          trades={trades.filter(t => t.ticker === selectedTicker)}
          holding={holdings.find(h => h.ticker === selectedTicker) ?? null}
          onEdit={(t) => { setSelectedTicker(null); onEdit(t) }}
          onDelete={(id) => { onDelete(id) }}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </>
  )
}
