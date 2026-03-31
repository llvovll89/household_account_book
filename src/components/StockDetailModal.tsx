import { useMemo } from 'react'
import { ChevronLeft, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import type { StockTrade, StockHolding } from '../types'
import { fmt, fmtQty, formatDate } from '../lib/format'

interface Props {
  ticker: string
  trades: StockTrade[]
  holding: StockHolding | null
  onEdit: (trade: StockTrade) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function StockDetailModal({ ticker, trades, holding, onEdit, onDelete, onClose }: Props) {
  const sorted = useMemo(
    () => [...trades].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [trades]
  )

  // 날짜별 그룹
  const grouped = useMemo(() => {
    const map: Record<string, StockTrade[]> = {}
    for (const t of sorted) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [sorted])

  const totalBought = trades.filter(t => t.tradeType === 'buy').reduce((s, t) => s + t.quantity, 0)
  const totalSold = trades.filter(t => t.tradeType === 'sell').reduce((s, t) => s + t.quantity, 0)
  const totalFee = trades.reduce((s, t) => s + t.fee, 0)
  const pnlColor = !holding || holding.realizedPnL === 0
    ? 'text-[#8B95A1]'
    : holding.realizedPnL > 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'

  return (
    <div className="fixed inset-0 bg-[#181818] z-50 overflow-y-auto">
      {/* 헤더 */}
      <div className="sticky top-0 bg-[#0D0F14] z-10 px-4 pt-5 pb-3 border-b border-white/[0.06]">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1E2236] flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={18} className="text-[#8B95A1]" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-extrabold text-white truncate">{ticker}</h2>
            <p className="text-[11px] text-[#4E5968]">종목 상세</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* 보유 현황 카드 */}
        {holding ? (
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-xs font-semibold text-[#4E5968] mb-4 uppercase tracking-wide">보유 현황</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-[#4E5968] mb-0.5">보유 수량</p>
                <p className="text-[22px] font-extrabold text-white num">{fmtQty(holding.quantity)}<span className="text-sm font-semibold text-[#4E5968] ml-1">주</span></p>
              </div>
              <div>
                <p className="text-[11px] text-[#4E5968] mb-0.5">평균 매수단가</p>
                <p className="text-[22px] font-extrabold text-white num">{fmt(holding.avgBuyPrice)}<span className="text-sm font-semibold text-[#4E5968] ml-1">원</span></p>
              </div>
              <div>
                <p className="text-[11px] text-[#4E5968] mb-0.5">취득 원가</p>
                <p className="text-[16px] font-bold text-white num">{fmt(holding.totalCost)}<span className="text-xs text-[#4E5968] ml-1">원</span></p>
              </div>
              <div>
                <p className="text-[11px] text-[#4E5968] mb-0.5">실현 손익</p>
                <p className={`text-[16px] font-bold num ${pnlColor}`}>
                  {holding.realizedPnL >= 0 ? '+' : ''}{fmt(holding.realizedPnL)}<span className="text-xs text-[#4E5968] ml-1">원</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* 전량 매도된 경우 */
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-xs font-semibold text-[#4E5968] mb-3 uppercase tracking-wide">거래 요약</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-[#4E5968] mb-0.5">총 매수 수량</p>
                <p className="text-[16px] font-bold text-white num">{fmtQty(totalBought)}<span className="text-xs text-[#4E5968] ml-1">주</span></p>
              </div>
              <div>
                <p className="text-[11px] text-[#4E5968] mb-0.5">총 매도 수량</p>
                <p className="text-[16px] font-bold text-white num">{fmtQty(totalSold)}<span className="text-xs text-[#4E5968] ml-1">주</span></p>
              </div>
            </div>
            <p className="text-xs text-[#4E5968] mt-3 text-center">전량 매도 완료</p>
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3">
            <p className="text-[10px] text-[#4E5968] mb-1">총 거래</p>
            <p className="text-[15px] font-extrabold text-white">{trades.length}<span className="text-xs font-normal text-[#4E5968] ml-0.5">건</span></p>
          </div>
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3">
            <p className="text-[10px] text-[#4E5968] mb-1">매수 / 매도</p>
            <p className="text-[13px] font-extrabold text-white">
              <span className="text-[#3D8EF8]">{trades.filter(t => t.tradeType === 'buy').length}</span>
              <span className="text-[#4E5968]"> / </span>
              <span className="text-[#F25260]">{trades.filter(t => t.tradeType === 'sell').length}</span>
            </p>
          </div>
          <div className="bg-[#1E2236] rounded-2xl px-3 py-3">
            <p className="text-[10px] text-[#4E5968] mb-1">누적 수수료</p>
            <p className="text-[13px] font-extrabold text-[#8B95A1] num">
              {totalFee >= 10_000 ? `${Math.round(totalFee / 10_000)}만` : fmt(totalFee)}
            </p>
          </div>
        </div>

        {/* 거래 내역 */}
        <div>
          <p className="text-sm font-bold text-white px-1 mb-2">거래 내역</p>
          <div className="space-y-2">
            {grouped.map(([date, dayTrades]) => (
              <div key={date} className="bg-[#1E2236] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
                  <span className="text-xs font-semibold text-[#4E5968]">{formatDate(date)}</span>
                  <span className="text-xs font-semibold text-[#4E5968]">{dayTrades.length}건</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {dayTrades.map((t) => {
                    const isBuy = t.tradeType === 'buy'
                    const total = t.price * t.quantity + t.fee
                    return (
                      <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isBuy ? 'bg-[#3D8EF8]/15' : 'bg-[#F25260]/15'}`}>
                          {isBuy
                            ? <TrendingUp size={16} className="text-[#3D8EF8]" />
                            : <TrendingDown size={16} className="text-[#F25260]" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isBuy ? 'bg-[#3D8EF8]/15 text-[#3D8EF8]' : 'bg-[#F25260]/15 text-[#F25260]'}`}>
                              {isBuy ? '매수' : '매도'}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#8B95A1] mt-0.5">
                            {fmtQty(t.quantity)}주 @ {t.price.toLocaleString()}{t.currency === 'KRW' ? '원' : ` ${t.currency}`}
                            {t.fee > 0 && <span className="ml-1">· 수수료 {t.fee.toLocaleString()}원</span>}
                            {t.note && <span className="ml-1">· {t.note}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <p className={`text-[14px] font-bold num ${isBuy ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                            {isBuy ? '+' : '-'}{total.toLocaleString()}
                            <span className="text-[11px] font-normal text-[#4E5968] ml-0.5">{t.currency === 'KRW' ? '원' : t.currency}</span>
                          </p>
                          <div className="hidden group-hover:flex items-center gap-1 ml-1">
                            <button
                              onClick={() => onEdit(t)}
                              className="w-6 h-6 rounded-lg bg-[#252A3F] flex items-center justify-center text-[#8B95A1] hover:text-white transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={() => onDelete(t.id)}
                              className="w-6 h-6 rounded-lg bg-[#252A3F] flex items-center justify-center text-[#8B95A1] hover:text-[#F25260] transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
