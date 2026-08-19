import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { Transaction } from '../../types'
import {
  CHART_COLORS, TOOLTIP_CONTENT_STYLE, TOOLTIP_CURSOR_STYLE,
  TOOLTIP_LABEL_STYLE, GRID_PROPS, AXIS_TICK_STYLE, fmtKRW,
} from '../../lib/chartTheme'

interface Props {
  transactions: Transaction[]
  yearMonth: string
}

interface DayData {
  day: number
  label: string
  balance: number | undefined
  projected: number | undefined
}

export default function CumulativeLineChart({ transactions, yearMonth }: Props) {
  const { chartData, hasProjection, lineColor } = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const today = new Date()
    const isCurrentMonth = yearMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const maxDay = isCurrentMonth ? today.getDate() : daysInMonth

    const monthlyTx = transactions.filter(t => t.date.startsWith(yearMonth))

    let cumulative = 0
    const actualDays: DayData[] = Array.from({ length: maxDay }, (_, i) => {
      const day = i + 1
      const dayStr = `${yearMonth}-${String(day).padStart(2, '0')}`
      const dayTx = monthlyTx.filter(t => t.date === dayStr)
      const dayIncome = dayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const dayExpense = dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      cumulative += dayIncome - dayExpense
      return { day, label: `${day}일`, balance: cumulative, projected: undefined }
    })

    const lastBalance = actualDays[actualDays.length - 1]?.balance ?? 0
    const color = lastBalance >= 0 ? CHART_COLORS.green : CHART_COLORS.expense

    if (!isCurrentMonth || maxDay >= daysInMonth) {
      return { chartData: actualDays, hasProjection: false, lineColor: color }
    }

    // 오늘 지점을 실제·예측 양쪽에 연결 (bridge point)
    if (actualDays.length > 0) {
      actualDays[actualDays.length - 1] = { ...actualDays[actualDays.length - 1], projected: lastBalance }
    }

    const avgDailyChange = maxDay > 0 ? lastBalance / maxDay : 0
    const projectionDays: DayData[] = Array.from({ length: daysInMonth - maxDay }, (_, i) => ({
      day: maxDay + i + 1,
      label: `${maxDay + i + 1}일`,
      balance: undefined,
      projected: lastBalance + avgDailyChange * (i + 1),
    }))

    return { chartData: [...actualDays, ...projectionDays], hasProjection: true, lineColor: color }
  }, [transactions, yearMonth])

  if (chartData.length === 0) return (
    <div className="py-6 text-center">
      <p className="text-sm text-[#4E5968]">이번 달 내역이 없어요</p>
    </div>
  )

  return (
    <>
    <div role="img" aria-label={`이번 달 누적 잔액 추이 선 차트${hasProjection ? ' (이후 예측 포함)' : ''}`}>
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK_STYLE}
          axisLine={false}
          tickLine={false}
          interval={Math.floor(chartData.length / 5)}
        />
        <YAxis
          tick={AXIS_TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtKRW}
          width={44}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={TOOLTIP_CONTENT_STYLE}
          cursor={TOOLTIP_CURSOR_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={(value, name) => [
            `${Number(value).toLocaleString()}원`,
            name === 'projected' ? '예측 잔액' : '누적 잔액',
          ]}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: lineColor }}
          animationDuration={600}
          connectNulls={false}
        />
        {hasProjection && (
          <Line
            type="monotone"
            dataKey="projected"
            stroke={lineColor}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            strokeOpacity={0.45}
            dot={false}
            activeDot={{ r: 3, fill: lineColor }}
            animationDuration={600}
            connectNulls={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
    </div>
    {hasProjection && (
      <div className="flex items-center justify-end gap-4 mt-1 pr-3">
        <div className="flex items-center gap-1">
          <div className="w-5 h-0.5" style={{ backgroundColor: lineColor }} />
          <span className="text-[9px] text-[#4E5968]">실제</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width={20} height={6}>
            <line x1="0" y1="3" x2="20" y2="3" stroke={lineColor} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.5} />
          </svg>
          <span className="text-[9px] text-[#4E5968]">예측</span>
        </div>
      </div>
    )}
    </>
  )
}
