import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, Plus, CalendarRange } from 'lucide-react'
import type { Transaction, TransactionType } from '../types'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'
import FancyDatePicker from './FancyDatePicker'

interface Props {
  transaction?: Transaction | null
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>[]) => void
  onClose: () => void
  customExpenseCategories?: string[]
  customIncomeCategories?: string[]
}

type QueueItem = Omit<Transaction, 'id' | 'createdAt'>

function parseHashtags(text: string): string[] {
  const matches = text.match(/#([^\s#]+)/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1)))]
}

function fmtShortDate(date: string) {
  const [, m, d] = date.split('-')
  return `${parseInt(m)}.${d}`
}

export default function TransactionModal({ transaction, onSave, onClose, customExpenseCategories = [], customIncomeCategories = [] }: Props) {
  const amountInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dateEnd, setDateEnd] = useState('')
  const [showDateEnd, setShowDateEnd] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])

  const isEditMode = !!transaction
  const tags = parseHashtags(description)

  const categories = type === 'income'
    ? [...INCOME_CATEGORIES, ...customIncomeCategories]
    : [...EXPENSE_CATEGORIES, ...customExpenseCategories]

  useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setAmount(transaction.amount.toLocaleString())
      setCategory(transaction.category)
      setDescription(transaction.description)
      setDate(transaction.date)
      if (transaction.dateEnd) {
        setDateEnd(transaction.dateEnd)
        setShowDateEnd(true)
      }
    }
  }, [transaction])

  useEffect(() => {
    if (!transaction) setCategory(categories[0])
  }, [type])

  function buildItem(): QueueItem | null {
    const parsed = parseInt(amount.replace(/,/g, ''), 10)
    if (!parsed || parsed <= 0) return null
    const item: QueueItem = { type, amount: parsed, category, description, tags, date }
    if (showDateEnd && dateEnd) item.dateEnd = dateEnd
    return item
  }

  function handleAddToQueue() {
    const item = buildItem()
    if (!item) return
    setQueue((prev) => [...prev, item])
    // 금액·설명만 리셋, 날짜·타입·카테고리 유지
    setAmount('')
    setDescription('')
    setDateEnd('')
    setShowDateEnd(false)
    amountInputRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const current = buildItem()
    const all = current ? [...queue, current] : queue
    if (all.length === 0) return
    onSave(all)
  }

  function handleRemoveFromQueue(idx: number) {
    setQueue((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleAmountChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setAmount(digits ? Number(digits).toLocaleString() : '')
  }

  function removeTag(tag: string) {
    const newDesc = description
      .replace(new RegExp(`#${tag}(?=\\s|$)`, 'g'), '')
      .replace(/\s+/g, ' ')
      .trim()
    setDescription(newDesc)
  }

  function toggleDateEnd() {
    if (showDateEnd) {
      setShowDateEnd(false)
      setDateEnd('')
    } else {
      setShowDateEnd(true)
      setDateEnd(date)
    }
  }

  const color = CATEGORY_COLOR[category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1C1C1E] w-full max-w-lg rounded-t-[28px] border-t border-white/6 max-h-[92vh] flex flex-col">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 bg-white/10 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-white">
              {transaction ? '내역 수정' : '내역 추가'}
            </h2>
            {queue.length > 0 && (
              <p className="text-xs text-[#3D8EF8] font-semibold mt-0.5">대기 중 {queue.length}건</p>
            )}
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center">
            <X size={16} className="text-[#8B95A1]" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* 대기열 */}
          {queue.length > 0 && (
            <div className="mx-6 mb-3 bg-[#2C2C2E] rounded-2xl overflow-hidden">
              {queue.map((item, idx) => {
                const qColor = CATEGORY_COLOR[item.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                const dateLabel = item.dateEnd
                  ? `${fmtShortDate(item.date)}~${fmtShortDate(item.dateEnd)}`
                  : fmtShortDate(item.date)
                return (
                  <div key={idx} className={`flex items-center gap-2.5 px-3 py-2.5 ${idx < queue.length - 1 ? 'border-b border-white/4' : ''}`}>
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: qColor.bg }}>
                      {CATEGORY_EMOJI[item.category] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-bold" style={{ color: item.type === 'income' ? '#2ACF6A' : '#F25260' }}>
                        {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()}원
                      </span>
                      <span className="text-[11px] text-[#4E5968] ml-1.5">{item.category}</span>
                      {item.description && (
                        <span className="text-[11px] text-[#4E5968] ml-1 truncate"> · {item.description}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#4E5968] shrink-0">{dateLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(idx)}
                      className="w-5 h-5 rounded-full bg-[#F25260]/15 flex items-center justify-center shrink-0"
                      aria-label="대기열에서 제거"
                    >
                      <X size={10} className="text-[#F25260]" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
            {/* 수입 / 지출 */}
            <div role="group" aria-label="거래 유형" className="flex gap-2 bg-[#2C2C2E] p-1 rounded-2xl">
              <button type="button" onClick={() => setType('income')}
                aria-pressed={type === 'income'}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  type === 'income' ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'text-[#4E5968]'
                }`}>
                수입
              </button>
              <button type="button" onClick={() => setType('expense')}
                aria-pressed={type === 'expense'}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  type === 'expense' ? 'bg-[#F25260]/20 text-[#F25260]' : 'text-[#4E5968]'
                }`}>
                지출
              </button>
            </div>

            {/* 금액 */}
            <div className="bg-[#2C2C2E] rounded-2xl px-5 py-4 overflow-hidden cursor-text" onClick={() => amountInputRef.current?.focus()}>
              <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">금액</p>
              <div className="flex items-baseline gap-2">
                <input
                  ref={amountInputRef}
                  type="text" inputMode="numeric"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  required={queue.length === 0}
                  className="flex-1 min-w-0 bg-transparent text-[34px] font-extrabold text-white focus:outline-none num text-right placeholder-[#1E2A3A]"
                />
                <span className="text-lg font-bold text-[#4E5968] shrink-0">원</span>
              </div>
            </div>

            {/* 날짜 + 종료일 토글 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">날짜</p>
                <button
                  type="button"
                  onClick={toggleDateEnd}
                  className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
                    showDateEnd ? 'bg-[#3D8EF8]/20 text-[#3D8EF8]' : 'bg-[#2C2C2E] text-[#4E5968] hover:text-[#8B95A1]'
                  }`}
                >
                  <CalendarRange size={11} />
                  기간 설정
                </button>
              </div>
              {!showDateEnd ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3.5">
                    <FancyDatePicker value={date} onChange={setDate} />
                  </div>
                  {/* 카테고리 */}
                  <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3.5">
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
                            <option key={c} value={c} className="bg-[#2C2C2E] text-white">{c}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3.5">
                      <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">시작일</p>
                      <FancyDatePicker value={date} onChange={setDate} />
                    </div>
                    <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3.5">
                      <p className="text-[11px] font-semibold text-[#4E5968] mb-1.5 uppercase tracking-wide">종료일</p>
                      <FancyDatePicker value={dateEnd || date} onChange={setDateEnd} min={date} />
                    </div>
                  </div>
                  {/* 카테고리 (기간 모드일 때 별도 행) */}
                  <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3.5">
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
                            <option key={c} value={c} className="bg-[#2C2C2E] text-white">{c}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 설명 + 해시태그 */}
            <div className="bg-[#2C2C2E] rounded-2xl px-5 py-4 space-y-2">
              <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">
                설명 (선택) · <span className="text-[#3D8EF8]">#해시태그</span> 사용 가능
              </p>
              <input
                type="text" value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어디서 사용했나요? (예: 점심 #식비 #카페)"
                className="w-full bg-transparent text-[14px] font-medium text-white placeholder-[#2D3352] focus:outline-none"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#3D8EF8]/15 text-[#3D8EF8]"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`#${tag} 태그 삭제`}
                        className="hover:text-white transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 버튼 영역 */}
            {isEditMode ? (
              <button type="submit"
                className="w-full py-4 rounded-2xl font-bold text-white text-[15px] bg-[#3D8EF8] hover:bg-[#5AA0FF] active:scale-[0.98] transition-all">
                수정 완료
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] bg-[#2C2C2E] text-[#8B95A1] hover:bg-[#3A3A3C] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={15} />
                  항목 추가
                </button>
                <button type="submit"
                  className={`font-bold text-white text-[14px] rounded-2xl active:scale-[0.98] transition-all ${
                    queue.length > 0 ? 'flex-[1.5] py-3.5 bg-[#3D8EF8] hover:bg-[#5AA0FF]' : 'flex-1 py-3.5 bg-[#3D8EF8] hover:bg-[#5AA0FF]'
                  }`}>
                  {queue.length > 0 ? `전체 저장 (${queue.length + (amount ? 1 : 0)}건)` : '추가하기'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
