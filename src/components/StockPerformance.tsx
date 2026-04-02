import { useMemo } from 'react'
import type { StockTrade } from '../types'
import { calcRealizedPnLByTicker, calcTotalFee, calcTotalRealizedPnL } from '../lib/stockCalc'
import { fmt } from '../lib/format'

interface Props {
  trades: StockTrade[]
}

export default function StockPerformance({ trades }: Props) {
  const totalRealizedPnL = useMemo(() => calcTotalRealizedPnL(trades), [trades])
  const totalFee = useMemo(() => calcTotalFee(trades), [trades])
  const realizedByTicker = useMemo(() => calcRealizedPnLByTicker(trades), [trades])

  const monthlyCashflow = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of trades) {
      const ym = t.date.slice(0, 7)
      const signed = t.tradeType === 'sell' ? (t.price * t.quantity - t.fee) : -(t.price * t.quantity + t.fee)
      map.set(ym, (map.get(ym) ?? 0) + signed)
    }
    return Array.from(map.entries())
      .map(([ym, value]) => ({ ym, value }))
      .sort((a, b) => b.ym.localeCompare(a.ym))
      .slice(0, 6)
  }, [trades])

  const topPerformers = useMemo(() => {
    const arr = Object.entries(realizedByTicker).map(([ticker, pnl]) => ({ ticker, pnl }))
    arr.sort((a, b) => b.pnl - a.pnl)
    return {
      best: arr[0] ?? null,
      worst: arr.length > 1 ? arr[arr.length - 1] : null,
    }
  }, [realizedByTicker])

  const sellCount = trades.filter((t) => t.tradeType === 'sell').length
  const buyCount = trades.length - sellCount

  if (trades.length === 0) {
    return (
      <div className="space-y-3 tab-content">
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center">
          <p className="text-5xl mb-4">📈</p>
          <p className="font-bold text-white text-[15px]">성과 데이터가 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">거래가 쌓이면 성과분석이 표시돼요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 tab-content">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">누적 실현손익</p>
          <p className={`text-[15px] font-extrabold num ${totalRealizedPnL > 0 ? 'text-[#2ACF6A]' : totalRealizedPnL < 0 ? 'text-[#F25260]' : 'text-[#8B95A1]'}`}>
            {totalRealizedPnL >= 0 ? '+' : ''}{fmt(totalRealizedPnL)}원
          </p>
        </div>
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">누적 수수료</p>
          <p className="text-[15px] font-extrabold text-[#8B95A1] num">{fmt(totalFee)}원</p>
        </div>
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">매수/매도 건수</p>
          <p className="text-[15px] font-extrabold text-white num">{buyCount} / {sellCount}</p>
        </div>
        <div className="bg-[#1E2236] rounded-2xl px-3 py-3.5">
          <p className="text-[10px] text-[#4E5968] font-semibold mb-1">총 거래 건수</p>
          <p className="text-[15px] font-extrabold text-white num">{trades.length}건</p>
        </div>
      </div>

      <div className="bg-[#1E2236] rounded-2xl p-4 space-y-2">
        <p className="text-sm font-bold text-white">종목 기여도</p>
        {topPerformers.best ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#252A3F] px-3 py-2.5">
              <p className="text-[10px] text-[#4E5968] mb-1">최고 성과</p>
              <p className="text-sm font-bold text-white truncate">{topPerformers.best.ticker}</p>
              <p className="text-[12px] font-semibold text-[#2ACF6A] num">+{fmt(topPerformers.best.pnl)}원</p>
            </div>
            <div className="rounded-xl bg-[#252A3F] px-3 py-2.5">
              <p className="text-[10px] text-[#4E5968] mb-1">최저 성과</p>
              <p className="text-sm font-bold text-white truncate">{topPerformers.worst?.ticker ?? '-'}</p>
              <p className="text-[12px] font-semibold text-[#F25260] num">
                {topPerformers.worst ? `${fmt(topPerformers.worst.pnl)}원` : '-'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#4E5968]">실현손익 데이터가 아직 충분하지 않아요.</p>
        )}
      </div>

      <div className="bg-[#1E2236] rounded-2xl p-4">
        <p className="text-sm font-bold text-white mb-2">월간 순현금흐름 (최근 6개월)</p>
        {monthlyCashflow.length === 0 ? (
          <p className="text-sm text-[#4E5968]">표시할 데이터가 없어요.</p>
        ) : (
          <div className="space-y-2">
            {monthlyCashflow.map((item) => (
              <div key={item.ym} className="flex items-center justify-between rounded-xl bg-[#252A3F] px-3 py-2">
                <span className="text-xs font-semibold text-[#8B95A1]">{item.ym}</span>
                <span className={`text-sm font-bold num ${item.value >= 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                  {item.value >= 0 ? '+' : ''}{fmt(item.value)}원
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
