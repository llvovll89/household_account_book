import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface Props {
  data: { value: number }[]
  color: string
  label: string
  value: string
  trend?: number | null
}

export default function SparklineCard({ data, color, label, value, trend }: Props) {
  const gradId = `spark-${label}-grad`
  return (
    <div className="flex-1 bg-[#1C1C1E] rounded-2xl p-3 min-w-0">
      <p className="text-[10px] font-semibold text-[#4E5968] mb-0.5">{label}</p>
      <p className="text-sm font-extrabold num truncate" style={{ color }}>{value}</p>
      {trend !== null && trend !== undefined && (
        <p className="text-[10px] font-bold mt-0.5" style={{ color: trend >= 0 ? '#2ACF6A' : '#F25260' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </p>
      )}
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={40}>
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
