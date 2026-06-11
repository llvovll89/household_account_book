import { useState } from 'react'
import { X, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useModalClose } from '../hooks/useModalClose'
import type { AutoCategoryRule, TransactionType } from '../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJI } from '../types'
import { generateId } from '../lib/format'

interface Props {
  rules: AutoCategoryRule[]
  customExpenseCategories?: string[]
  customIncomeCategories?: string[]
  onSave: (rules: AutoCategoryRule[]) => void
  onClose: () => void
}

export default function AutoCategoryRuleModal({
  rules,
  customExpenseCategories = [],
  customIncomeCategories = [],
  onSave,
  onClose,
}: Props) {
  const { closing, handleClose } = useModalClose(onClose)
  const [list, setList] = useState<AutoCategoryRule[]>(rules)
  const [keyword, setKeyword] = useState('')
  const [ruleType, setRuleType] = useState<TransactionType>('expense')
  const [ruleCategory, setRuleCategory] = useState('')

  const expenseCategories = [...EXPENSE_CATEGORIES, ...customExpenseCategories]
  const incomeCategories = [...INCOME_CATEGORIES, ...customIncomeCategories]
  const categories = ruleType === 'expense' ? expenseCategories : incomeCategories

  function addRule() {
    const kw = keyword.trim()
    if (!kw || !ruleCategory) return
    const newRule: AutoCategoryRule = {
      id: generateId(),
      keyword: kw,
      category: ruleCategory,
      type: ruleType,
      enabled: true,
    }
    setList((prev) => [...prev, newRule])
    setKeyword('')
    setRuleCategory('')
  }

  function toggleRule(id: string) {
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  function deleteRule(id: string) {
    setList((prev) => prev.filter((r) => r.id !== id))
  }

  function handleSave() {
    onSave(list)
    handleClose()
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] px-5 pt-5 pb-8 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold text-white">자동 분류 규칙</h2>
            <p className="text-[12px] text-[#8B95A1] mt-0.5">설명에 키워드가 포함되면 카테고리를 자동 설정</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2E]">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        {/* 규칙 추가 폼 */}
        <div className="bg-[#2C2C2E] rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-[12px] font-semibold text-[#8B95A1] uppercase tracking-wide">새 규칙 추가</p>
          {/* 유형 토글 */}
          <div className="flex gap-2">
            {(['expense', 'income'] as TransactionType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setRuleType(t); setRuleCategory('') }}
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                  ruleType === t
                    ? t === 'expense' ? 'bg-[#F25260]/20 text-[#F25260]' : 'bg-[#2ACF6A]/20 text-[#2ACF6A]'
                    : 'text-[#4E5968]'
                }`}
              >
                {t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          {/* 키워드 입력 */}
          <input
            type="text"
            placeholder="키워드 (예: 스타벅스, 버스)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            className="w-full bg-[#1C1C1E] rounded-xl px-3 py-2.5 text-[14px] text-white placeholder-[#4E5968] focus:outline-none"
          />
          {/* 카테고리 선택 */}
          <select
            value={ruleCategory}
            onChange={(e) => setRuleCategory(e.target.value)}
            className="w-full bg-[#1C1C1E] rounded-xl px-3 py-2.5 text-[14px] text-white focus:outline-none appearance-none"
          >
            <option value="">카테고리 선택</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_EMOJI[c] ?? ''} {c}
              </option>
            ))}
          </select>
          <button
            onClick={addRule}
            disabled={!keyword.trim() || !ruleCategory}
            className="w-full py-2.5 rounded-xl bg-[#3D8EF8] text-white text-[14px] font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            추가
          </button>
        </div>

        {/* 규칙 목록 */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {list.length === 0 ? (
            <div className="text-center text-[#4E5968] text-[13px] py-8">
              아직 규칙이 없습니다<br />위에서 첫 번째 규칙을 추가해보세요
            </div>
          ) : (
            list.map((rule) => (
              <div key={rule.id} className={`flex items-center gap-3 bg-[#2C2C2E] rounded-xl px-4 py-3 ${!rule.enabled ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                      rule.type === 'expense' ? 'bg-[#F25260]/20 text-[#F25260]' : 'bg-[#2ACF6A]/20 text-[#2ACF6A]'
                    }`}>
                      {rule.type === 'expense' ? '지출' : '수입'}
                    </span>
                    <span className="text-[13px] font-semibold text-white truncate">"{rule.keyword}"</span>
                    <span className="text-[#8B95A1] text-[12px]">→</span>
                    <span className="text-[13px] text-[#F1F3F6]">
                      {CATEGORY_EMOJI[rule.category] ?? ''} {rule.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    aria-label={rule.enabled ? `${rule.keyword} 규칙 비활성화` : `${rule.keyword} 규칙 활성화`}
                    aria-pressed={rule.enabled}
                  >
                    {rule.enabled
                      ? <ToggleRight size={22} className="text-[#3D8EF8]" />
                      : <ToggleLeft size={22} className="text-[#4E5968]" />
                    }
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    aria-label={`${rule.keyword} 규칙 삭제`}
                    className="text-[#4E5968] hover:text-[#F25260] transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 저장 */}
        <button
          onClick={handleSave}
          className="mt-4 w-full py-3.5 rounded-2xl bg-[#3D8EF8] text-white text-[15px] font-bold"
        >
          저장
        </button>
      </div>
    </div>
  )
}
