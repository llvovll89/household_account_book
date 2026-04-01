import { useEffect, useMemo, useRef, useState } from 'react'
import { Pin, Pencil, Trash2, X, Check, ChevronDown, Calendar, CalendarDays, LayoutGrid } from 'lucide-react'
import type { Memo, TransactionType } from '../types'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'

interface Props {
  memos: Memo[]
  onAdd: (title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string) => void
  onUpdate: (id: string, title: string, content: string, amount?: number, transactionType?: TransactionType, category?: string, date?: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  externalAddTrigger?: number
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  return isToday
    ? `오늘 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}

function formatMemoDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}.${d}`
}

// 다크 파스텔 배경
const CARD_COLORS = [
  '#1A1F2E', '#1E1A2E', '#1A2420', '#21191A', '#1A1E2C', '#1E2018', '#1C1E28',
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatAmount(n: number) {
  return n.toLocaleString()
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function MemoSection({ memos, onAdd, onUpdate, onDelete, onTogglePin, externalAddTrigger = 0 }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [txType, setTxType] = useState<TransactionType>('expense')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [date, setDate] = useState(todayStr())
  const prevExternalAddTriggerRef = useRef(externalAddTrigger)

  const categories = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const sorted = [...memos].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })

  const memoByDate = useMemo(() => {
    const map = new Map<string, Memo[]>()
    for (const memo of memos) {
      const key = memo.date ?? new Date(memo.updatedAt).toISOString().slice(0, 10)
      const prev = map.get(key)
      if (prev) {
        prev.push(memo)
      } else {
        map.set(key, [memo])
      }
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    return map
  }, [memos])

  const calendarYearMonth = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth() + 1
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = new Date().toISOString().slice(0, 10)

    const result: { date: string | null; count: number; isToday: boolean }[] = []

    for (let i = 0; i < firstDay; i++) {
      result.push({ date: null, count: 0, isToday: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${calendarYearMonth}-${String(d).padStart(2, '0')}`
      const count = memoByDate.get(date)?.length ?? 0
      result.push({ date, count, isToday: date === today })
    }

    return result
  }, [calendarMonth, calendarYearMonth, memoByDate])

  const selectedDateMemos = useMemo(() => {
    if (!selectedDate) return []
    return memoByDate.get(selectedDate) ?? []
  }, [memoByDate, selectedDate])

  function openNew() {
    setEditingId(null); setTitle(''); setContent('')
    setAmountStr(''); setTxType('expense'); setCategory(EXPENSE_CATEGORIES[0])
    setDate(todayStr())
    setShowForm(true)
  }

  useEffect(() => {
    if (externalAddTrigger !== prevExternalAddTriggerRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openNew()
      prevExternalAddTriggerRef.current = externalAddTrigger
    }
  }, [externalAddTrigger])

  function openEdit(m: Memo) {
    setEditingId(m.id); setTitle(m.title); setContent(m.content)
    setAmountStr(m.amount ? m.amount.toLocaleString() : '')
    setTxType(m.transactionType ?? 'expense')
    setCategory(m.category ?? (m.transactionType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]))
    setDate(m.date ?? todayStr())
    setShowForm(true)
  }

  function handleAmountChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    setAmountStr(digits ? Number(digits).toLocaleString() : '')
  }

  function handleTypeChange(t: TransactionType) {
    setTxType(t)
    setCategory(t === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  }

  function handleSave() {
    if (!title.trim() && !content.trim()) return
    const parsedAmount = amountStr ? parseInt(amountStr.replace(/,/g, ''), 10) : undefined
    const txTypeVal = parsedAmount ? txType : undefined
    const categoryVal = category || undefined
    if (editingId) {
      onUpdate(editingId, title, content, parsedAmount, txTypeVal, categoryVal, date)
    } else {
      onAdd(title, content, parsedAmount, txTypeVal, categoryVal, date)
    }
    setShowForm(false); setTitle(''); setContent('')
    setAmountStr(''); setTxType('expense'); setCategory(EXPENSE_CATEGORIES[0])
    setDate(todayStr()); setEditingId(null)
  }

  function handleCancel() {
    setShowForm(false); setTitle(''); setContent('')
    setAmountStr(''); setTxType('expense'); setCategory(EXPENSE_CATEGORIES[0])
    setDate(todayStr()); setEditingId(null)
  }

  const color = CATEGORY_COLOR[category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }

  function prevCalendarMonth() {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function nextCalendarMonth() {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function formatSelectedDateLabel(date: string) {
    const d = new Date(date)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  return (
    <div className="space-y-3 tab-content">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setViewMode('cards')
              setSelectedDate(null)
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${viewMode === 'cards' ? 'bg-[#3D8EF8] text-white' : 'bg-[#252A3F] text-[#8B95A1]'}`}
          >
            <LayoutGrid size={12} />
            카드
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-[#3D8EF8] text-white' : 'bg-[#252A3F] text-[#8B95A1]'}`}
          >
            <CalendarDays size={12} />
            캘린더
          </button>
        </div>
      </div>

      {viewMode === 'cards' && sorted.length === 0 && !showForm && (
        <div className="bg-[#1E2236] rounded-3xl p-12 text-center tab-content">
          <p className="text-5xl mb-4">📝</p>
          <p className="font-bold text-white text-[15px]">메모가 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">예산 목표, 할 일 등을 기록해보세요</p>
        </div>
      )}

      {viewMode === 'cards' && sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-3 tab-content">
          {sorted.map((memo, idx) => {
            const bg = CARD_COLORS[idx % CARD_COLORS.length]
            const catColor = memo.category ? (CATEGORY_COLOR[memo.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }) : null
            return (
              <div key={memo.id} className="rounded-3xl p-4 flex flex-col gap-2 relative group border border-white/4"
                style={{ backgroundColor: bg }}>
                {memo.pinned && (
                  <div className="absolute top-3.5 right-3.5">
                    <Pin size={11} className="text-[#F5BE3A]" fill="#F5BE3A" />
                  </div>
                )}

                <h3 className="text-[13px] font-bold text-white leading-tight pr-5 truncate">
                  {memo.title || '(제목 없음)'}
                </h3>

                {/* 금액 정보 */}
                {memo.amount != null && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[13px] font-extrabold num leading-none"
                      style={{ color: memo.transactionType === 'income' ? '#2ACF6A' : '#F25260' }}
                    >
                      {memo.transactionType === 'income' ? '+' : '-'}{formatAmount(memo.amount)}원
                    </span>
                  </div>
                )}

                {/* 카테고리 */}
                {memo.category && catColor && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg self-start"
                    style={{ backgroundColor: catColor.bg }}>
                    <span className="text-[11px]">{CATEGORY_EMOJI[memo.category] ?? '📦'}</span>
                    <span className="text-[10px] font-bold" style={{ color: catColor.text }}>{memo.category}</span>
                  </div>
                )}

                {memo.content && (
                  <p className="text-[12px] text-[#8B95A1] whitespace-pre-wrap line-clamp-4 leading-relaxed flex-1">
                    {memo.content}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                  <span className="text-[10px] text-[#4E5968]">
                    {memo.date ? formatMemoDate(memo.date) : formatDate(memo.updatedAt)}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onTogglePin(memo.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title={memo.pinned ? '핀 해제' : '고정'}>
                      <Pin size={10} className={memo.pinned ? 'text-[#F5BE3A]' : 'text-[#4E5968]'} />
                    </button>
                    <button onClick={() => openEdit(memo)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <Pencil size={10} className="text-[#4E5968]" />
                    </button>
                    <button onClick={() => onDelete(memo.id)} className="p-1.5 rounded-lg hover:bg-[#F25260]/15 transition-colors">
                      <Trash2 size={10} className="text-[#F25260]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="space-y-3 tab-content">
          <div className="bg-[#1E2236] rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
              <button onClick={prevCalendarMonth} className="px-2.5 py-1 rounded-lg bg-[#252A3F] text-[#8B95A1] text-xs font-bold">이전</button>
              <span className="text-sm font-bold text-white">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</span>
              <button onClick={nextCalendarMonth} className="px-2.5 py-1 rounded-lg bg-[#252A3F] text-[#8B95A1] text-xs font-bold">다음</button>
            </div>

            <div className="grid grid-cols-7 border-b border-white/6">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={`text-center py-2 text-[11px] font-bold ${idx === 0 ? 'text-[#F25260]' : idx === 6 ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarCells.map((cell, idx) => {
                const colIdx = idx % 7
                const isSelected = cell.date === selectedDate

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!cell.date) return
                      setSelectedDate((prev) => (prev === cell.date ? null : cell.date))
                    }}
                    disabled={!cell.date}
                    className={`relative flex flex-col items-center justify-start pt-1.5 pb-1 min-h-14.5 border-r border-b border-white/4 transition-colors ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''} ${isSelected ? 'bg-[#3D8EF8]/15' : cell.date ? 'hover:bg-white/4' : ''}`}
                  >
                    {cell.date && (
                      <>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${cell.isToday ? 'bg-[#3D8EF8] text-white' : colIdx === 0 ? 'text-[#F25260]/80' : colIdx === 6 ? 'text-[#3D8EF8]/80' : 'text-white/70'}`}
                        >
                          {parseInt(cell.date.split('-')[2], 10)}
                        </span>
                        {cell.count > 0 && (
                          <>
                            <span className="mt-0.5 text-[10px] font-semibold text-[#8B95A1]">{cell.count}개</span>
                            <div className="w-1 h-1 rounded-full mt-0.5 bg-[#3D8EF8]" />
                          </>
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="bg-[#1E2236] rounded-3xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                <p className="text-sm font-bold text-white">{formatSelectedDateLabel(selectedDate)} 일정</p>
                <span className="text-xs font-semibold text-[#8B95A1]">{selectedDateMemos.length}개</span>
              </div>

              {selectedDateMemos.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-[#4E5968]">이 날짜에는 메모가 없어요</p>
                </div>
              ) : (
                <div>
                  {selectedDateMemos.map((memo, idx) => {
                    const catColor = memo.category ? (CATEGORY_COLOR[memo.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }) : null
                    return (
                      <div key={memo.id} className={`px-4 py-3 ${idx < selectedDateMemos.length - 1 ? 'border-b border-white/4' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{memo.title || '(제목 없음)'}</p>
                            {memo.content && <p className="text-xs text-[#8B95A1] mt-1 whitespace-pre-wrap line-clamp-3">{memo.content}</p>}
                            {memo.category && catColor && (
                              <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg" style={{ backgroundColor: catColor.bg }}>
                                <span className="text-[11px]">{CATEGORY_EMOJI[memo.category] ?? '📦'}</span>
                                <span className="text-[10px] font-bold" style={{ color: catColor.text }}>{memo.category}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => onTogglePin(memo.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title={memo.pinned ? '핀 해제' : '고정'}>
                              <Pin size={11} className={memo.pinned ? 'text-[#F5BE3A]' : 'text-[#4E5968]'} />
                            </button>
                            <button onClick={() => openEdit(memo)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                              <Pencil size={11} className="text-[#4E5968]" />
                            </button>
                            <button onClick={() => onDelete(memo.id)} className="p-1.5 rounded-lg hover:bg-[#F25260]/15 transition-colors">
                              <Trash2 size={11} className="text-[#F25260]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={(e) => e.target === e.currentTarget && handleCancel()}>
          <div className="bg-[#1E2236] w-full max-w-lg rounded-t-[28px] max-h-[85vh] flex flex-col border-t border-white/6">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 bg-white/10 rounded-full" />
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
              <div className="flex items-center justify-between pt-1">
                <h3 className="text-[17px] font-bold text-white">{editingId ? '메모 수정' : '새 메모'}</h3>
                <button onClick={handleCancel} className="w-8 h-8 rounded-full bg-[#252A3F] flex items-center justify-center">
                  <X size={14} className="text-[#8B95A1]" />
                </button>
              </div>

              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="제목" autoFocus
                className="w-full text-[17px] font-bold text-white placeholder-[#2D3352] focus:outline-none bg-transparent" />
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  e.currentTarget.style.height = 'auto'
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 240)}px`
                }}
                placeholder="내용을 입력하세요..."
                rows={4}
                className="w-full text-[14px] text-[#8B95A1] placeholder-[#2D3352] focus:outline-none resize-none leading-relaxed bg-transparent"
                style={{ minHeight: '96px' }}
              />

              <div className="h-px bg-white/6" />

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#252A3F] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#4E5968] mb-1 uppercase tracking-wide">날짜</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-[#4E5968] shrink-0" />
                    <input
                      type="date" value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-[#252A3F] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#4E5968] mb-1 uppercase tracking-wide">카테고리</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs shrink-0"
                      style={{ backgroundColor: color.bg }}>
                      {CATEGORY_EMOJI[category] ?? '📦'}
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <select value={category} onChange={(e) => setCategory(e.target.value)}
                        className="w-full appearance-none bg-transparent text-[13px] font-bold focus:outline-none pr-4 truncate"
                        style={{ color: color.text }}>
                        {categories.map((c) => (
                          <option key={c} value={c} className="bg-[#252A3F] text-white">{c}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#4E5968] pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/6" />

              <div>
                <p className="text-[11px] font-semibold text-[#4E5968] mb-2 uppercase tracking-wide">금액 (선택)</p>
                <div className="flex items-baseline gap-2 bg-[#252A3F] rounded-xl px-4 py-3 overflow-hidden cursor-text"
                  onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
                  <input
                    type="text" inputMode="numeric"
                    value={amountStr}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent text-[22px] font-extrabold text-white focus:outline-none num text-right placeholder-[#2D3352]"
                  />
                  <span className="text-sm font-bold text-[#4E5968] shrink-0">원</span>
                </div>
              </div>

              {amountStr !== '' && (
                <div className="flex gap-2 bg-[#252A3F] p-1 rounded-xl">
                  <button type="button" onClick={() => handleTypeChange('income')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      txType === 'income' ? 'bg-[#2ACF6A]/20 text-[#2ACF6A]' : 'text-[#4E5968]'
                    }`}>
                    수입
                  </button>
                  <button type="button" onClick={() => handleTypeChange('expense')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      txType === 'expense' ? 'bg-[#F25260]/20 text-[#F25260]' : 'text-[#4E5968]'
                    }`}>
                    지출
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1 border-t border-white/6">
                <button onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#4E5968] bg-[#252A3F] hover:bg-[#2D3352] transition-colors">
                  <X size={13} /> 취소
                </button>
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#3D8EF8] hover:bg-[#5AA0FF] transition-colors">
                  <Check size={13} /> 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
