import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../types'

interface Props {
  customExpenseCategories: string[]
  customIncomeCategories: string[]
  onSave: (expense: string[], income: string[]) => void
  onClose: () => void
}

type Tab = 'expense' | 'income'

export default function CategoryModal({ customExpenseCategories, customIncomeCategories, onSave, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('expense')
  const [customExpense, setCustomExpense] = useState<string[]>(customExpenseCategories)
  const [customIncome, setCustomIncome] = useState<string[]>(customIncomeCategories)
  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState('')

  const base = activeTab === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  const custom = activeTab === 'expense' ? customExpense : customIncome
  const setCustom = activeTab === 'expense' ? setCustomExpense : setCustomIncome

  function handleAdd() {
    const name = inputVal.trim()
    if (!name) return
    if ([...base, ...custom].includes(name)) {
      setError('이미 존재하는 카테고리예요')
      return
    }
    setCustom((prev) => [...prev, name])
    setInputVal('')
    setError('')
  }

  function handleDelete(name: string) {
    setCustom((prev) => prev.filter((c) => c !== name))
  }

  function handleSave() {
    onSave(customExpense, customIncome)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] max-h-[85vh] flex flex-col border-t border-white/[0.06]">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">카테고리 관리</h2>
            <p className="text-xs text-[#4E5968] mt-0.5">사용자 정의 카테고리 추가/삭제</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 px-6 pb-3 shrink-0">
          <div className="flex gap-1 bg-[#2C2C2E] p-1 rounded-xl w-full">
            <button
              onClick={() => { setActiveTab('expense'); setInputVal(''); setError('') }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'expense' ? 'bg-[#F25260]/20 text-[#F25260]' : 'text-[#4E5968]'}`}
            >
              지출 카테고리
            </button>
            <button
              onClick={() => { setActiveTab('income'); setInputVal(''); setError('') }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'income' ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'text-[#4E5968]'}`}
            >
              수입 카테고리
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-3">
          {/* 기본 카테고리 */}
          <div>
            <p className="text-[10px] font-semibold text-[#4E5968] uppercase tracking-wide mb-2">기본 카테고리</p>
            <div className="flex flex-wrap gap-2">
              {base.map((cat) => (
                <span key={cat} className="px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-xs font-semibold text-[#8B95A1]">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* 사용자 정의 카테고리 */}
          <div>
            <p className="text-[10px] font-semibold text-[#4E5968] uppercase tracking-wide mb-2">
              추가 카테고리 {custom.length > 0 && <span className="text-[#3D8EF8]">{custom.length}개</span>}
            </p>
            {custom.length === 0 ? (
              <p className="text-xs text-[#4E5968] py-2">추가된 카테고리가 없어요</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {custom.map((cat) => (
                  <div key={cat} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3D8EF8]/15 border border-[#3D8EF8]/20">
                    <span className="text-xs font-semibold text-[#3D8EF8]">{cat}</span>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="text-[#3D8EF8]/60 hover:text-[#F25260] transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 추가 인풋 */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => { setInputVal(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="새 카테고리 이름"
                className={`flex-1 bg-[#2C2C2E] text-white text-sm font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 placeholder-[#4E5968] ${error ? 'ring-1 ring-[#F25260]/60' : 'focus:ring-[#3D8EF8]/40'}`}
              />
              <button
                onClick={handleAdd}
                className="w-10 h-10 rounded-xl bg-[#3D8EF8] flex items-center justify-center shrink-0 hover:bg-[#5AA0FF] transition-colors"
              >
                <Plus size={16} className="text-white" />
              </button>
            </div>
            {error && <p className="text-xs text-[#F25260] font-semibold pl-1">{error}</p>}
          </div>

          {/* 삭제 방법 안내 */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[#2C2C2E] rounded-xl">
            <Trash2 size={12} className="text-[#4E5968] mt-0.5 shrink-0" />
            <p className="text-[11px] text-[#4E5968]">
              기본 카테고리는 삭제할 수 없어요. 추가한 카테고리의 <span className="text-white">×</span> 버튼을 눌러 삭제하세요.
            </p>
          </div>
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
