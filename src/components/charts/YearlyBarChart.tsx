import type { CSSProperties } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, ReferenceLine,
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

interface YearlyTooltipEntry {
  dataKey?: string | number
  value?: number | string
}

interface YearlyTooltipProps {
  active?: boolean
  payload?: YearlyTooltipEntry[]
  label?: string | number
}

function YearlyTooltip({ active, payload, label }: YearlyTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div style={TOOLTIP_CONTENT_STYLE as CSSProperties}>
      <p style={TOOLTIP_LABEL_STYLE as CSSProperties}>{label}월</p>
      {payload.map((entry) => {
        const isIncome = entry.dataKey === 'income'
        const textColor = isIncome ? CHART_COLORS.income : CHART_COLORS.expense
        const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0)

        return (
          <p key={String(entry.dataKey)} style={{ margin: 0, color: textColor, fontSize: 12, fontWeight: 600 }}>
            {isIncome ? '수입' : '지출'}: {value.toLocaleString()}원
          </p>
        )
      })}
    </div>
  )
}

export default function YearlyBarChart({ data, currentYM }: Props) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="18%" barGap={2}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="label"
          tick={(props) => {
            const { x, y, index } = props
            const isCurrent = data[index]?.ym === currentYM
            return (
              <text x={Number(x)} y={Number(y) + 12} textAnchor="middle" fontSize={9}
                fill={isCurrent ? CHART_COLORS.textPrimary : AXIS_TICK_STYLE.fill}
                fontWeight={isCurrent ? 700 : 400}>
                {index + 1}
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
          width={38}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
        <Tooltip
          cursor={TOOLTIP_CURSOR_STYLE}
          content={<YearlyTooltip />}
        />
        <Bar dataKey="income" radius={[4, 4, 0, 0]} barSize={8} animationDuration={600}>
          {data.map((m, i) => (
            <Cell
              key={i}
              fill={CHART_COLORS.income}
              opacity={m.ym === currentYM ? 1 : (m.income > 0 || m.expense > 0) ? 0.55 : 0.2}
            />
          ))}
        </Bar>
        <Bar dataKey="expense" radius={[4, 4, 0, 0]} barSize={8} animationDuration={600}>
          {data.map((m, i) => (
            <Cell
              key={i}
              fill={CHART_COLORS.expense}
              opacity={m.ym === currentYM ? 1 : (m.income > 0 || m.expense > 0) ? 0.55 : 0.2}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
