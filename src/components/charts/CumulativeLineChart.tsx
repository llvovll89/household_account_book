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

export default function CumulativeLineChart({ transactions, yearMonth }: Props) {
  const chartData = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const today = new Date()
    const isCurrentMonth = yearMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const maxDay = isCurrentMonth ? today.getDate() : daysInMonth

    const monthlyTx = transactions.filter(t => t.date.startsWith(yearMonth))

    let cumulative = 0
    return Array.from({ length: maxDay }, (_, i) => {
      const day = i + 1
      const dayStr = `${yearMonth}-${String(day).padStart(2, '0')}`
      const dayTx = monthlyTx.filter(t => t.date === dayStr)
      const dayIncome = dayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const dayExpense = dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      cumulative += dayIncome - dayExpense
      return { day, label: `${day}일`, balance: cumulative }
    })
  }, [transactions, yearMonth])

  if (chartData.length === 0) return null

  const isPositive = chartData[chartData.length - 1].balance >= 0
  const lineColor = isPositive ? CHART_COLORS.green : CHART_COLORS.expense

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          formatter={(value) => [`${Number(value).toLocaleString()}원`, '누적 잔액']}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: lineColor }}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
