import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJI } from '../../types'
import type { ParsedRow } from '../../lib/bankParser'

interface PreviewRow extends ParsedRow {
  category: string
  skip: boolean
  isDuplicate: boolean
}

interface Props {
  row: PreviewRow
  onClose: () => void
  onUpdate: (patch: Partial<PreviewRow>) => void
}

export default function PreviewRowDetailModal({ row, onClose, onUpdate }: Props) {
  const isIncome = row.type === 'income'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-100" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] border-t border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>
        <div className="px-6 pt-3 pb-8 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isIncome ? 'bg-[#3D8EF8]/15' : 'bg-[#F25260]/15'}`}>
                {isIncome
                  ? <TrendingUp size={18} className="text-[#3D8EF8]" />
                  : <TrendingDown size={18} className="text-[#F25260]" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#4E5968]">{row.date}</p>
                <p className={`text-xl font-extrabold num ${isIncome ? 'text-[#3D8EF8]' : 'text-white'}`}>
                  {isIncome ? '+' : '-'}{row.amount.toLocaleString()}원
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
              <X size={15} className="text-[#8B95A1]" />
            </button>
          </div>

          {row.description && (
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3">
              <p className="text-[10px] font-semibold text-[#4E5968] mb-1">적요</p>
              <p className="text-sm text-white break-all">{row.description}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold text-[#4E5968] mb-2">카테고리</p>
            <div className="grid grid-cols-4 gap-2">
              {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ category: c })}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl text-[10px] font-semibold transition-all ${
                    row.category === c ? 'bg-[#3D8EF8] text-white' : 'bg-[#252A3F] text-[#8B95A1] hover:bg-[#2D3352]'
                  }`}
                >
                  <span className="text-base">{CATEGORY_EMOJI[c]}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { onUpdate({ skip: true }); onClose() }}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${row.skip ? 'bg-[#F25260]/20 text-[#F25260]' : 'bg-[#252A3F] text-[#8B95A1] hover:bg-[#2D3352]'}`}
            >
              제외
            </button>
            <button
              onClick={() => { onUpdate({ skip: false }); onClose() }}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${!row.skip ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'bg-[#252A3F] text-[#8B95A1] hover:bg-[#2D3352]'}`}
            >
              포함
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
