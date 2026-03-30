import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

interface Props {
  category: string
  emoji: string
  spent: number
  limit: number
  color: string
}

function fmt(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return n.toLocaleString()
}

export default function BudgetGauge({ category, emoji, spent, limit, color }: Props) {
  const pct = Math.min((spent / limit) * 100, 100)
  const isOver = spent > limit
  const displayColor = isOver ? '#F25260' : color

  const data = [
    { value: pct, fill: displayColor },
  ]
  const trackData = [{ value: 100, fill: 'rgba(255,255,255,0.05)' }]

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: 80, height: 80, position: 'relative' }}>
        <ResponsiveContainer width="100%" height={80}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            startAngle={210}
            endAngle={-30}
            barSize={8}
            data={trackData}
          >
            <RadialBar dataKey="value" cornerRadius={4} background={false} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0 }}>
          <ResponsiveContainer width="100%" height={80}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              startAngle={210}
              endAngle={-30}
              barSize={8}
              data={data}
            >
              <RadialBar dataKey="value" cornerRadius={4} background={false} animationDuration={600} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        {/* 중앙 텍스트 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16 }}>{emoji}</div>
          <div style={{ fontSize: 10, color: displayColor, fontWeight: 700, marginTop: 1 }}>
            {Math.round(pct)}%
          </div>
        </div>
      </div>
      <p className="text-[10px] font-semibold text-[#8B95A1] text-center leading-tight">{category}</p>
      <p className="text-[10px] num text-center" style={{ color: displayColor }}>
        {fmt(spent)}<span className="text-[#4E5968]">/{fmt(limit)}</span>
      </p>
    </div>
  )
}
