import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import {
  CHART_COLORS, TOOLTIP_CONTENT_STYLE, TOOLTIP_CURSOR_STYLE,
  TOOLTIP_LABEL_STYLE, AXIS_TICK_STYLE,
} from '../../lib/chartTheme'

interface WeekdayItem {
  label: string
  total: number
  count: number
}

interface Props {
  data: WeekdayItem[]
}

export default function WeekdayBarChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const topIdx = data.reduce((maxI, d, i) => d.total > data[maxI].total ? i : maxI, 0)

  function getBarColor(i: number): string {
    if (data[i].total === 0) return 'rgba(139,149,161,0.1)'
    if (i === topIdx && data[i].total > 0) return CHART_COLORS.income
    if (i === 0 || i === 6) return 'rgba(242,82,96,0.5)'
    return 'rgba(139,149,161,0.25)'
  }

  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="20%">
        <XAxis
          dataKey="label"
          tick={(props) => {
            const { x, y, index } = props
            const isTop = index === topIdx && data[index].total > 0
            const isWeekend = index === 0 || index === 6
            const fill = isTop
              ? CHART_COLORS.income
              : isWeekend
              ? 'rgba(242,82,96,0.7)'
              : AXIS_TICK_STYLE.fill
            return (
              <text x={Number(x)} y={Number(y) + 12} textAnchor="middle" fontSize={11} fill={fill} fontWeight={isTop ? 700 : 400}>
                {data[index]?.label}
              </text>
            )
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={[0, maxTotal * 1.15]} />
        <Tooltip
          contentStyle={TOOLTIP_CONTENT_STYLE}
          cursor={TOOLTIP_CURSOR_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={(value, _name, props) => {
            const item = props.payload as WeekdayItem | undefined
            return [
              `${Number(value).toLocaleString()}원 (${item?.count ?? 0}건)`,
              `${item?.label ?? ''}요일 지출`,
            ]
          }}
        />
        <Bar
          dataKey="total"
          radius={[6, 6, 0, 0]}
          animationDuration={600}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          onClick={(_, index) => setActiveIndex(activeIndex === index ? null : index)}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={getBarColor(i)}
              opacity={activeIndex !== null && activeIndex !== i ? 0.6 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
