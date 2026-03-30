import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MonthlyDataPoint } from '../../types'
import {
  CHART_COLORS, TOOLTIP_CONTENT_STYLE, TOOLTIP_CURSOR_STYLE,
  TOOLTIP_LABEL_STYLE, GRID_PROPS, AXIS_TICK_STYLE, fmtKRW,
} from '../../lib/chartTheme'

interface Props {
  data: MonthlyDataPoint[]
  currentYM: string
}

export default function TrendAreaChart({ data, currentYM }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="trend-income-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trend-expense-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="label"
          tick={(props) => {
            const { x, y, payload } = props
            const ym = data.find(d => d.label === payload.value)?.ym
            const isCurrent = ym === currentYM
            return (
              <text x={Number(x)} y={Number(y) + 12} textAnchor="middle" fontSize={10}
                fill={isCurrent ? CHART_COLORS.textPrimary : AXIS_TICK_STYLE.fill}
                fontWeight={isCurrent ? 700 : 400}>
                {payload.value}
              </text>
            )
          }}
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
          formatter={(value, name) => [
            `${Number(value).toLocaleString()}원`,
            name === 'income' ? '수입' : '지출',
          ]}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke={CHART_COLORS.income}
          strokeWidth={2}
          fill="url(#trend-income-grad)"
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.income }}
          animationDuration={600}
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke={CHART_COLORS.expense}
          strokeWidth={2}
          fill="url(#trend-expense-grad)"
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.expense }}
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
