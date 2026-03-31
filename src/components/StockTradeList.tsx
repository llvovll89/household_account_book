import { useMemo, useState } from 'react'
import { Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import type { StockTrade } from '../types'
import { calcHoldings, calcTotalRealizedPnL, calcTotalFee } from '../lib/stockCalc'

interface Props {
  trades: StockTrade[]
  onEdit: (trade: StockTrade) => void
  onDelete: (id: string) => void
}

type Filter = 'all' | 'buy' | 'sell'

function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR') }
function fmtQty(q: number) { return q % 1 === 0 ? q.toFixed(0) : q.toFixed(4).replace(/\.?0+$/, '') }

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const wd = weekdays[d.getDay()]
  if (d.toDateString() === today.toDateString()) return `오늘 (${wd})`
  if (d.toDateString() === yesterday.toDateString()) return `어제 (${wd})`
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${wd})`
}

export default function StockTradeList({ trades, onEdit, onDelete }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const holdings = useMemo(() => calcHoldings(trades), [trades])
  const totalRealizedPnL = useMemo(() => calcTotalRealizedPnL(trades), [trades])
  const totalFee = useMemo(() => calcTotalFee(trades), [trades])
  const totalHoldingCost = useMemo(
    () => holdings.reduce((s, h) => s + h.totalCost, 0),
    [holdings]
  )

  const filtered = useMemo(() => {
    return trades
      .filter((t) => filter === 'all' || t.tradeType === filter)
      .filter((t) => !search || t.ticker.toLowerCase().includes(search.toLowerCase()) || t.note.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [trades, filter, search])

  // 날짜별 그룹
  const grouped = useMemo(() => {
    const map: Record<string, StockTrade[]> = {}
    for (const t of filtered) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  if (trades.length === 0) {
    return (
      <div className="space-y-3 tab-content">
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">📊</p>
          <p className="font-bold text-white text-[15px]">거래 내역이 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">+ 버튼으로 첫 거래를 추가해보세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 tab-content">
      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">투자 원가</p>
          <p className="text-[13px] font-extrabold text-white num leading-tight">
            {totalHoldingCost >= 10_000
              ? `${Math.round(totalHoldingCost / 10_000)}만`
              : fmt(totalHoldingCost)}
          </p>
          <p className="text-[9px] text-[#4E5968] mt-0.5">보유 중</p>
        </div>
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">실현 손익</p>
          <p className={`text-[13px] font-extrabold num leading-tight ${
            totalRealizedPnL > 0 ? 'text-[#2ACF6A]' : totalRealizedPnL < 0 ? 'text-[#F25260]' : 'text-[#8B95A1]'
          }`}>
            {totalRealizedPnL >= 0 ? '+' : ''}{Math.abs(totalRealizedPnL) >= 10_000
              ? `${(totalRealizedPnL / 10_000).toFixed(0)}만`
              : fmt(totalRealizedPnL)}
          </p>
          <p className="text-[9px] text-[#4E5968] mt-0.5">누적</p>
        </div>
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">수수료</p>
          <p className="text-[13px] font-extrabold text-[#8B95A1] num leading-tight">
            {totalFee >= 10_000
              ? `${Math.round(totalFee / 10_000)}만`
              : fmt(totalFee)}
          </p>
          <p className="text-[9px] text-[#4E5968] mt-0.5">누적</p>
        </div>
      </div>

      {/* 보유 종목 */}
      {holdings.length > 0 && (
        <div className="bg-[#1E2236] rounded-2xl px-4 py-3.5">
          <p className="text-sm font-bold text-white mb-3">보유 종목</p>
          <div className="space-y-2.5">
            {holdings.map((h) => (
              <div key={h.ticker} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#3D8EF8]/15 flex items-center justify-center shrink-0">
                  <TrendingUp size={14} className="text-[#3D8EF8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{h.ticker}</p>
                  <p className="text-[11px] text-[#4E5968]">
                    {fmtQty(h.quantity)}주 @ {fmt(h.avgBuyPrice)}원
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white num">{fmt(h.totalCost)}원</p>
                  {h.realizedPnL !== 0 && (
                    <p className={`text-[11px] font-semibold num ${h.realizedPnL > 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                      실현 {h.realizedPnL > 0 ? '+' : ''}{fmt(h.realizedPnL)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 + 검색 */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-[#1E2236] p-1 rounded-xl shrink-0">
          {(['all', 'buy', 'sell'] as Filter[]).map((f) => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === f ? 'bg-[#252A3F] text-white' : 'text-[#4E5968]'
              }`}>
              {f === 'all' ? '전체' : f === 'buy' ? '매수' : '매도'}
            </button>
          ))}
        </div>
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="종목 검색"
          className="flex-1 bg-[#1E2236] rounded-xl px-3 py-2 text-sm text-white placeholder-[#4E5968] focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/40"
        />
      </div>

      {/* 거래 내역 (날짜별 그룹) */}
      {grouped.length === 0 ? (
        <div className="bg-[#1E2236] rounded-2xl p-8 text-center">
          <p className="text-[#4E5968] text-sm">검색 결과가 없어요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([date, dayTrades]) => (
            <div key={date} className="bg-[#1E2236] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
                <span className="text-xs font-semibold text-[#4E5968]">{formatDate(date)}</span>
                <span className="text-xs font-semibold text-[#4E5968]">
                  {dayTrades.length}건
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {dayTrades.map((t) => {
                  const isBuy = t.tradeType === 'buy'
                  const total = t.price * t.quantity + t.fee
                  return (
                    <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isBuy ? 'bg-[#3D8EF8]/15' : 'bg-[#F25260]/15'
                      }`}>
                        {isBuy
                          ? <TrendingUp size={16} className="text-[#3D8EF8]" />
                          : <TrendingDown size={16} className="text-[#F25260]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-bold text-white truncate">{t.ticker}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isBuy ? 'bg-[#3D8EF8]/15 text-[#3D8EF8]' : 'bg-[#F25260]/15 text-[#F25260]'
                          }`}>
                            {isBuy ? '매수' : '매도'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#4E5968]">
                          {fmtQty(t.quantity)}주 @ {t.price.toLocaleString()}{t.currency === 'KRW' ? '원' : ` ${t.currency}`}
                          {t.fee > 0 && <span className="ml-1">· 수수료 {t.fee.toLocaleString()}원</span>}
                          {t.note && <span className="ml-1">· {t.note}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className={`text-[14px] font-bold num ${isBuy ? 'text-[#3D8EF8]' : 'text-[#F25260]'}`}>
                          {isBuy ? '+' : '-'}{total.toLocaleString()}
                          <span className="text-[11px] font-normal text-[#4E5968] ml-0.5">
                            {t.currency === 'KRW' ? '원' : t.currency}
                          </span>
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
      )}
    </div>
  )
}
