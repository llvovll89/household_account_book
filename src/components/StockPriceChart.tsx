import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ChartRange } from '../lib/stockPriceApi'
import useStockChart from '../hooks/useStockChart'
import { fmtPrice } from '../lib/format'

const RANGES: { label: string; value: ChartRange }[] = [
  { label: '1일', value: '1d' },
  { label: '1주', value: '5d' },
  { label: '1달', value: '1mo' },
  { label: '3달', value: '3mo' },
  { label: '1년', value: '1y' },
]

interface TooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  currency: string
}

function ChartTooltip({ active, payload, label, currency }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D0F14] border border-white/10 rounded-xl px-3 py-2">
      <p className="text-[10px] text-[#4E5968] mb-0.5">{label}</p>
      <p className="text-[13px] font-bold text-white num">{fmtPrice(payload[0].value, currency)}</p>
    </div>
  )
}

interface Props {
  ticker: string
}

export default function StockPriceChart({ ticker }: Props) {
  const [range, setRange] = useState<ChartRange>('1d')
  const { chartData, loading, error } = useStockChart(ticker, range)

  const lastPrice = chartData?.points.at(-1)?.price ?? 0
  const isPositive = lastPrice >= (chartData?.prevClose ?? lastPrice)
  const lineColor = isPositive ? '#2ACF6A' : '#F25260'
  const gradientId = `grad-${ticker.replace(/[^a-zA-Z0-9]/g, '')}`
  const currency = chartData?.currency ?? 'KRW'

  // Y축 포맷: KRW는 만/천 단위 축약, USD는 $ 표기
  const formatY = (v: number) => {
    if (currency === 'USD') return `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}`
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
    if (v >= 10_000) return `${(v / 1_000).toFixed(0)}K`
    return String(v)
  }

  return (
    <div className="bg-[#1E2236] rounded-3xl p-4">
      {/* 기간 탭 */}
      <div className="flex gap-1 mb-4">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              range === r.value
                ? 'bg-[#F5BE3A] text-[#0D0F14]'
                : 'text-[#4E5968] hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 차트 */}
      {loading && !chartData ? (
        <div className="h-44 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#F5BE3A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="h-44 flex items-center justify-center">
          <p className="text-[#4E5968] text-sm text-center">차트를 불러올 수 없어요<br /><span className="text-[11px]">{error}</span></p>
        </div>
      ) : !chartData || chartData.points.length === 0 ? (
        <div className="h-44 flex items-center justify-center">
          <p className="text-[#4E5968] text-sm">데이터가 없어요 (장 마감 후일 수 있어요)</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={176}>
          <AreaChart data={chartData.points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* 전일 종가 기준선 */}
            {chartData.prevClose > 0 && (
              <ReferenceLine
                y={chartData.prevClose}
                stroke="#4E5968"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            <XAxis
              dataKey="time"
              tick={{ fill: '#4E5968', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#4E5968', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatY}
              width={42}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* 전일 종가 표시 */}
      {chartData && chartData.prevClose > 0 && (
        <p className="text-[10px] text-[#4E5968] text-right mt-1">
          전일 종가 {fmtPrice(chartData.prevClose, currency)}
        </p>
      )}
    </div>
  )
}
