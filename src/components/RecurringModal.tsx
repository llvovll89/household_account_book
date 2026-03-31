import { useState } from 'react'
import { X, Plus, Trash2, ChevronDown, RefreshCw } from 'lucide-react'
import type { RecurringTransaction, TransactionType } from '../types'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'
import { generateId } from '../lib/format'

interface Props {
  recurring: RecurringTransaction[]
  customExpenseCategories?: string[]
  onSave: (items: RecurringTransaction[]) => void
  onClose: () => void
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export default function RecurringModal({ recurring, customExpenseCategories = [], onSave, onClose }: Props) {
  const [items, setItems] = useState<RecurringTransaction[]>(recurring)
  const [adding, setAdding] = useState(false)

  // 새 항목 폼 상태
  const [newType, setNewType] = useState<TransactionType>('expense')
  const [newAmount, setNewAmount] = useState('')
  const [newCategory, setNewCategory] = useState('식비')
  const [newDesc, setNewDesc] = useState('')
  const [newDay, setNewDay] = useState(1)

  const categories = newType === 'income' ? INCOME_CATEGORIES : [...EXPENSE_CATEGORIES, ...customExpenseCategories]

  function handleAmountChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setNewAmount(digits ? Number(digits).toLocaleString() : '')
  }

  function handleAdd() {
    const amount = parseInt(newAmount.replace(/,/g, ''), 10)
    if (!amount || amount <= 0) return
    const isDuplicate = items.some(
      (i) => i.type === newType && i.category === newCategory && i.dayOfMonth === newDay && i.amount === amount
    )
    if (isDuplicate) {
      alert('동일한 정기 항목이 이미 있어요.')
      return
    }
    const item: RecurringTransaction = {
      id: generateId(),
      type: newType,
      amount,
      category: newCategory,
      description: newDesc,
      dayOfMonth: newDay,
      lastAppliedMonth: '',
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, item])
    setAdding(false)
    setNewAmount('')
    setNewDesc('')
    setNewDay(1)
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function handleSave() {
    onSave(items)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] max-h-[90vh] flex flex-col border-t border-white/[0.06]">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">정기 지출 관리</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">매달 반복되는 고정 수입/지출</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-3">
          {/* 등록된 항목 목록 */}
          {items.length === 0 && !adding && (
            <div className="bg-[#252A3F] rounded-2xl p-8 text-center">
              <RefreshCw size={28} className="text-[#4E5968] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#8B95A1]">등록된 정기 항목이 없어요</p>
              <p className="text-xs text-[#4E5968] mt-1">월세, 구독료, 보험 등을 추가해보세요</p>
            </div>
          )}

          {items.map((item) => {
            const color = CATEGORY_COLOR[item.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
            return (
              <div key={item.id} className="flex items-center gap-3 bg-[#252A3F] rounded-2xl px-4 py-3.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: color.bg }}
                >
                  {CATEGORY_EMOJI[item.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{item.category}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/5 text-[#8B95A1]">
                      매월 {item.dayOfMonth}일
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-[#4E5968] truncate mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className={`text-sm font-bold num shrink-0 ${item.type === 'income' ? 'text-[#2ACF6A]' : 'text-white'}`}>
                  {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()}원
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-xl hover:bg-[#F25260]/15 text-[#4E5968] hover:text-[#F25260] transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}

          {/* 추가 폼 */}
          {adding && (
            <div className="bg-[#252A3F] rounded-2xl p-4 space-y-3 border border-[#3D8EF8]/20">
              {/* 수입/지출 */}
              <div className="flex gap-2 bg-[#1E2236] p-1 rounded-xl">
                {(['expense', 'income'] as TransactionType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setNewType(t); setNewCategory(t === 'income' ? '급여' : '식비') }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      newType === t
                        ? t === 'income' ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'bg-[#F25260]/20 text-[#F25260]'
                        : 'text-[#4E5968]'
                    }`}
                  >
                    {t === 'income' ? '수입' : '지출'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* 금액 */}
                <div className="bg-[#1E2236] rounded-xl px-3 py-2.5 overflow-hidden">
                  <p className="text-[10px] text-[#4E5968] font-semibold mb-1">금액</p>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="text" inputMode="numeric"
                      value={newAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-transparent text-base font-bold text-white focus:outline-none num text-right placeholder-[#252A3F]"
                    />
                    <span className="text-xs text-[#4E5968] shrink-0">원</span>
                  </div>
                </div>

                {/* 날짜 */}
                <div className="bg-[#1E2236] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-[#4E5968] font-semibold mb-1">매월 몇 일</p>
                  <div className="relative">
                    <select
                      value={newDay}
                      onChange={(e) => setNewDay(Number(e.target.value))}
                      className="w-full appearance-none bg-transparent text-sm font-bold text-white focus:outline-none"
                    >
                      {DAYS.map((d) => <option key={d} value={d} className="bg-[#1E2236]">{d}일</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 카테고리 */}
              <div className="bg-[#1E2236] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1">카테고리</p>
                <div className="relative">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full appearance-none bg-transparent text-sm font-bold text-white focus:outline-none"
                  >
                    {categories.map((c) => <option key={c} value={c} className="bg-[#1E2236]">{CATEGORY_EMOJI[c]} {c}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
                </div>
              </div>

              {/* 설명 */}
              <div className="bg-[#1E2236] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1">설명 (선택)</p>
                <input
                  type="text" value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="예: 넷플릭스, 월세"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder-[#2D3352] focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAdding(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#8B95A1] bg-[#1E2236] hover:bg-[#252A3F] transition-colors">
                  취소
                </button>
                <button onClick={handleAdd}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#3D8EF8] hover:bg-[#5AA0FF] transition-colors">
                  추가
                </button>
              </div>
            </div>
          )}

          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 justify-center py-3.5 rounded-2xl border border-dashed border-white/10 text-sm font-semibold text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
            >
              <Plus size={15} />
              정기 항목 추가
            </button>
          )}
        </div>

        <div className="px-6 pb-8 pt-3 border-t border-white/[0.05] shrink-0">
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
