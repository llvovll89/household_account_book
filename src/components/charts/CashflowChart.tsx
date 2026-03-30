import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MonthlyDataPoint } from '../../types'
import {
  CHART_COLORS, TOOLTIP_CONTENT_STYLE, TOOLTIP_CURSOR_STYLE,
  TOOLTIP_LABEL_STYLE, GRID_PROPS, AXIS_TICK_STYLE, fmtKRW,
} from '../../lib/chartTheme'

interface Props {
  data: MonthlyDataPoint[]
}

export default function CashflowChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cf-income-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="cf-expense-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtKRW}
          width={44}
        />
        <Tooltip
          contentStyle={TOOLTIP_CONTENT_STYLE}
          cursor={TOOLTIP_CURSOR_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={(value, name) => {
            const labels: Record<string, string> = { income: '수입', expense: '지출', balance: '순잔액' }
            return [`${Number(value).toLocaleString()}원`, labels[String(name)] ?? String(name)]
          }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke={CHART_COLORS.income}
          strokeWidth={2}
          fill="url(#cf-income-grad)"
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.income }}
          animationDuration={600}
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke={CHART_COLORS.expense}
          strokeWidth={2}
          fill="url(#cf-expense-grad)"
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.expense }}
          animationDuration={600}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={CHART_COLORS.green}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS.green, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: CHART_COLORS.green }}
          animationDuration={600}
          strokeDasharray="5 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
