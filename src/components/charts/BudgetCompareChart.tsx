import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Budget, Transaction } from '../../types'
import { CATEGORY_EMOJI } from '../../types'
import { fmtShort as fmt } from '../../lib/format'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  yearMonth: string
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  const budget = payload.find((p) => p.name === '예산')?.value ?? 0
  const actual = payload.find((p) => p.name === '지출')?.value ?? 0
  const pct = budget > 0 ? Math.round((actual / budget) * 100) : null
  return (
    <div className="bg-[#2C2C2E] border border-white/10 rounded-xl p-3 text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-[#8B95A1]">예산 <span className="text-white font-bold">{fmt(budget)}원</span></p>
      <p className="text-[#8B95A1]">지출 <span className={`font-bold ${actual > budget && budget > 0 ? 'text-[#F25260]' : 'text-[#3D8EF8]'}`}>{fmt(actual)}원</span></p>
      {pct !== null && <p className="text-[#8B95A1] mt-0.5">달성률 <span className={`font-bold ${pct > 100 ? 'text-[#F25260]' : 'text-[#2ACF6A]'}`}>{pct}%</span></p>}
    </div>
  )
}

export default function BudgetCompareChart({ transactions, budgets, yearMonth }: Props) {
  const monthTx = transactions.filter((t) => t.date.startsWith(yearMonth) && t.type === 'expense')

  const data = budgets
    .map((b) => {
      const actual = monthTx.filter((t) => t.category === b.category).reduce((s, t) => s + t.amount, 0)
      return { category: b.category, budget: b.limit, actual, over: actual > b.limit }
    })
    .sort((a, b) => b.budget - a.budget)

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[#4E5968]">
        <p className="text-sm">예산이 설정되지 않았습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={data.length * 52 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }} barCategoryGap="28%">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="category"
            width={68}
            tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
              <text x={Number(x)} y={Number(y)} dy={4} textAnchor="end" fill="#8B95A1" fontSize={11}>
                {CATEGORY_EMOJI[payload.value] ?? ''} {payload.value}
              </text>
            )}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="budget" name="예산" fill="rgba(255,255,255,0.08)" radius={[0, 4, 4, 0]} barSize={10} />
          <Bar dataKey="actual" name="지출" radius={[0, 4, 4, 0]} barSize={10}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.over ? 'rgba(242,82,96,0.7)' : 'rgba(61,142,248,0.7)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-white/10" />
          <span className="text-[11px] text-[#8B95A1]">예산</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#3D8EF8]/70" />
          <span className="text-[11px] text-[#8B95A1]">지출 (정상)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#F25260]/70" />
          <span className="text-[11px] text-[#8B95A1]">지출 (초과)</span>
        </div>
      </div>

      {/* 카테고리별 달성률 */}
      <div className="space-y-2 mt-2">
        {data.map((d) => {
          const pct = d.budget > 0 ? Math.min(Math.round((d.actual / d.budget) * 100), 200) : 0
          const displayPct = d.budget > 0 ? Math.round((d.actual / d.budget) * 100) : 0
          const critical = displayPct >= 120
          return (
            <div key={d.category} className={`space-y-1 rounded-xl px-2 py-1.5 transition-colors ${d.over ? 'bg-[#F25260]/8' : ''}`}>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8B95A1]">{CATEGORY_EMOJI[d.category]} {d.category}</span>
                <div className="flex items-center gap-1">
                  {critical && <span className="text-[10px]">⚠️</span>}
                  <span className={`text-xs font-bold num ${d.over ? 'text-[#F25260]' : 'text-[#2ACF6A]'}`}>
                    {displayPct}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${d.over ? 'bg-[#F25260]' : 'bg-[#3D8EF8]'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
