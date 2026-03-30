import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../../types'
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from '../../lib/chartTheme'

interface CategoryItem {
  cat: string
  amt: number
  pct: number
}

interface Props {
  data: CategoryItem[]
}

export default function DonutChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (data.length === 0) return null

  const active = activeIndex !== null ? data[activeIndex] : data[0]
  const activeColor = CATEGORY_COLOR[active.cat]?.text ?? '#8B95A1'

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ width: '100%', height: 200, position: 'relative' }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="75%"
              paddingAngle={3}
              dataKey="amt"
              animationDuration={600}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, index) => setActiveIndex(activeIndex === index ? null : index)}
            >
              {data.map((item, i) => {
                const color = CATEGORY_COLOR[item.cat]?.text ?? '#8B95A1'
                return (
                  <Cell
                    key={item.cat}
                    fill={color}
                    opacity={activeIndex !== null && activeIndex !== i ? 0.35 : 1}
                    stroke="transparent"
                  />
                )
              })}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(value, _name, props) => {
                const item = props.payload as CategoryItem | undefined
                return [`${Number(value).toLocaleString()}원 (${item?.pct ?? 0}%)`, item?.cat ?? '']
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* 도넛 중앙 라벨 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 22 }}>{CATEGORY_EMOJI[active.cat] ?? '📦'}</div>
          <div style={{ fontSize: 11, color: activeColor, fontWeight: 700, marginTop: 2 }}>{active.cat}</div>
          <div style={{ fontSize: 12, color: '#F1F3F6', fontWeight: 800 }}>{active.pct}%</div>
        </div>
      </div>

      {/* 범례 */}
      <div className="w-full grid grid-cols-2 gap-1.5">
        {data.map((item, i) => {
          const color = CATEGORY_COLOR[item.cat]?.text ?? '#8B95A1'
          const isActive = activeIndex === i || activeIndex === null
          return (
            <button
              key={item.cat}
              onClick={() => setActiveIndex(activeIndex === i ? null : i)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
              style={{
                backgroundColor: activeIndex === i ? CATEGORY_COLOR[item.cat]?.bg ?? 'rgba(139,149,161,0.12)' : 'transparent',
                opacity: isActive ? 1 : 0.45,
              }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-[#8B95A1] font-medium truncate">{item.cat}</span>
              <span className="text-[11px] font-bold ml-auto shrink-0" style={{ color }}>{item.pct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
