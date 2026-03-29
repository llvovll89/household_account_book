import { useState, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
import type { Transaction, TransactionType } from '../types'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'

interface Props {
  transaction?: Transaction | null
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>) => void
  onClose: () => void
}

export default function TransactionModal({ transaction, onSave, onClose }: Props) {
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setAmount(transaction.amount.toLocaleString())
      setCategory(transaction.category)
      setDescription(transaction.description)
      setDate(transaction.date)
    }
  }, [transaction])

  useEffect(() => {
    if (!transaction) setCategory(categories[0])
  }, [type])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInt(amount.replace(/,/g, ''), 10)
    if (!parsed || parsed <= 0) return
    onSave({ type, amount: parsed, category, description, date })
  }

  function handleAmountChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setAmount(digits ? Number(digits).toLocaleString() : '')
  }

  const color = CATEGORY_COLOR[category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] border-t border-white/[0.06]">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-2 pb-4">
          <h2 className="text-[18px] font-bold text-white">
            {transaction ? '내역 수정' : '내역 추가'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-3">
          {/* 수입 / 지출 */}
          <div className="flex gap-2 bg-[#252A3F] p-1 rounded-2xl">
            <button type="button" onClick={() => setType('income')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                type === 'income' ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'text-[#4E5968]'
              }`}>
              수입
            </button>
            <button type="button" onClick={() => setType('expense')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                type === 'expense' ? 'bg-[#F25260]/20 text-[#F25260]' : 'text-[#4E5968]'
              }`}>
              지출
            </button>
          </div>

          {/* 금액 */}
          <div className="bg-[#252A3F] rounded-2xl px-5 py-4">
            <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">금액</p>
            <div className="flex items-baseline gap-2">
              <input
                type="text" inputMode="numeric"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                required
                className="flex-1 bg-transparent text-[34px] font-extrabold text-white focus:outline-none num text-right placeholder-[#1E2A3A]"
              />
              <span className="text-lg font-bold text-[#4E5968]">원</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 날짜 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">날짜</p>
              <input
                type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-transparent text-[14px] font-semibold text-white focus:outline-none"
              />
            </div>

            {/* 카테고리 */}
            <div className="bg-[#252A3F] rounded-2xl px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">카테고리</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: color.bg }}>
                  {CATEGORY_EMOJI[category] ?? '📦'}
                </div>
                <div className="relative flex-1">
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none bg-transparent text-[13px] font-bold focus:outline-none pr-4 truncate"
                    style={{ color: color.text }}>
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-[#252A3F] text-white">{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* 설명 */}
          <div className="bg-[#252A3F] rounded-2xl px-5 py-4">
            <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">설명 (선택)</p>
            <input
              type="text" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어디서 사용했나요?"
              className="w-full bg-transparent text-[14px] font-medium text-white placeholder-[#2D3352] focus:outline-none"
            />
          </div>

          <button type="submit"
            className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-[0.98] transition-all">
            {transaction ? '수정 완료' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
