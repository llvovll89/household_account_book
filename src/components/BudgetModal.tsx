import { useState } from 'react'
import { X } from 'lucide-react'
import type { Budget } from '../types'
import { EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'

interface Props {
  budgets: Budget[]
  customExpenseCategories?: string[]
  onSave: (budgets: Budget[]) => void
  onClose: () => void
}

export default function BudgetModal({ budgets, customExpenseCategories = [], onSave, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    budgets.forEach((b) => { m[b.category] = b.limit.toLocaleString() })
    return m
  })
  const [carryoverMap, setCarryoverMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    budgets.forEach((b) => { m[b.category] = b.carryover ?? false })
    return m
  })

  function handleChange(cat: string, val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setValues((prev) => ({ ...prev, [cat]: digits ? Number(digits).toLocaleString() : '' }))
  }

  function handleSave() {
    const result: Budget[] = []
    for (const [category, raw] of Object.entries(values)) {
      const limit = parseInt(raw.replace(/,/g, ''), 10)
      if (limit > 0) result.push({ category, limit, carryover: carryoverMap[category] ?? false })
    }
    onSave(result)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[85vh] flex flex-col border-t border-white/6">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">예산 설정</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">카테고리별 월 예산을 입력하세요</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-2.5">
          {[...EXPENSE_CATEGORIES, ...customExpenseCategories].map((cat) => {
            const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
            return (
              <div key={cat} className="bg-[#2C2C2E] rounded-2xl px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: color.bg }}
                  >
                    {CATEGORY_EMOJI[cat] ?? '📦'}
                  </div>
                  <span className="text-sm font-semibold text-white flex-1">{cat}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={values[cat] ?? ''}
                      onChange={(e) => handleChange(cat, e.target.value)}
                      placeholder="제한 없음"
                      className="w-28 bg-[#3A3A3C] text-white text-sm font-semibold text-right rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#3D8EF8]/50 placeholder-[#4E5968] num"
                    />
                    <span className="text-xs text-[#4E5968]">원</span>
                  </div>
                </div>
                {(values[cat] ?? '') !== '' && (
                  <div className="flex items-center justify-between pl-13">
                    <span className="text-xs text-[#4E5968]">미사용 예산 다음 달로 이월</span>
                    <button
                      type="button"
                      onClick={() => setCarryoverMap((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${carryoverMap[cat] ? 'bg-[#3D8EF8]' : 'bg-[#3A3A3C]'}`}
                      aria-pressed={carryoverMap[cat]}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${carryoverMap[cat] ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-6 pb-8 pt-3 border-t border-white/5 shrink-0">
          <button
            onClick={handleSave}
            className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-[0.98] transition-all"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  )
}
