import { useState } from 'react'
import { X } from 'lucide-react'
import type { Budget } from '../types'
import { EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'
import { useModalClose } from '../hooks/useModalClose'

type BudgetScope = 'base' | 'thisMonth'

interface Props {
  budgets: Budget[]
  customExpenseCategories?: string[]
  yearMonth: string
  onSave: (budgets: Budget[], scope: BudgetScope) => void
  onClose: () => void
}

function formatYearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return `${y}년 ${m}월`
}

export default function BudgetModal({ budgets, customExpenseCategories = [], yearMonth, onSave, onClose }: Props) {
  const { closing, handleClose, modalRef } = useModalClose(onClose)
  const [scope, setScope] = useState<BudgetScope>('base')
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
      if (limit > 0) {
        result.push({
          category,
          limit,
          carryover: carryoverMap[category] ?? false,
          ...(scope === 'thisMonth' ? { yearMonth } : {}),
        })
      }
    }
    onSave(result, scope)
    handleClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div ref={modalRef} className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[85vh] flex flex-col border-t border-white/6 modal-panel" {...(closing ? { 'data-closing': '' } : {})}>
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <h2 id="budget-modal-title" className="text-[18px] font-bold text-white">예산 설정</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">카테고리별 월 예산을 입력하세요</p>
          </div>
          <button aria-label="예산 설정 닫기" onClick={handleClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="px-6 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-2xl bg-[#2C2C2E] p-1">
            <button
              type="button"
              onClick={() => setScope('base')}
              aria-pressed={scope === 'base'}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${scope === 'base' ? 'bg-[#3D8EF8] text-white' : 'text-[#8B95A1]'}`}
            >
              전체 (기본값)
            </button>
            <button
              type="button"
              onClick={() => setScope('thisMonth')}
              aria-pressed={scope === 'thisMonth'}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${scope === 'thisMonth' ? 'bg-[#3D8EF8] text-white' : 'text-[#8B95A1]'}`}
            >
              {formatYearMonthLabel(yearMonth)}만
            </button>
          </div>
          <p className="text-[10px] text-[#4E5968] mt-1.5 px-1">
            {scope === 'thisMonth'
              ? `${formatYearMonthLabel(yearMonth)}에만 적용되고, 다른 달의 기본 예산은 그대로 유지돼요.`
              : '매달 반복 적용되는 기본 예산이에요.'}
          </p>
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
                    <label htmlFor={`budget-${cat}`} className="sr-only">{cat} 예산</label>
                    <input
                      id={`budget-${cat}`}
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
                {(values[cat] ?? '') !== '' && scope === 'base' && (
                  <div className="flex items-center justify-between pl-13">
                    <span className="text-xs text-[#4E5968]">미사용 예산 다음 달로 이월</span>
                    <button
                      type="button"
                      onClick={() => setCarryoverMap((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${carryoverMap[cat] ? 'bg-[#3D8EF8]' : 'bg-[#3A3A3C]'}`}
                      aria-pressed={carryoverMap[cat]}
                      aria-label={`${cat} 미사용 예산 이월 ${carryoverMap[cat] ? '끄기' : '켜기'}`}
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
