import { useState, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Transaction } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '../types'
import { fmt } from '../lib/format'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarView({ transactions, yearMonth, onEdit, onDelete }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [year, month] = yearMonth.split('-').map(Number)

  // 달력 셀 계산
  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay() // 0=일
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = new Date().toISOString().slice(0, 10)

    const result: { date: string | null; income: number; expense: number; isToday: boolean }[] = []

    // 앞 빈 칸
    for (let i = 0; i < firstDay; i++) result.push({ date: null, income: 0, expense: 0, isToday: false })

    // 날짜 셀
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${yearMonth}-${String(d).padStart(2, '0')}`
      const dayTx = transactions.filter((t) => t.date === date)
      const income = dayTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      result.push({ date, income, expense, isToday: date === today })
    }
    return result
  }, [transactions, yearMonth])

  // 선택된 날짜의 거래 내역
  const selectedTx = useMemo(() => {
    if (!selectedDate) return []
    return transactions
      .filter((t) => t.date === selectedDate)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [transactions, selectedDate])

  function handleCellClick(date: string | null) {
    if (!date) return
    setSelectedDate((prev) => (prev === date ? null : date))
  }

  function formatSelectedDate(date: string) {
    const d = new Date(date)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
  }

  return (
    <div className="space-y-3">
      {/* 요일 헤더 */}
      <div className="bg-[#1E2236] rounded-3xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/[0.05]">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center py-2.5 text-xs font-bold ${
                i === 0 ? 'text-[#F25260]' : i === 6 ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const colIdx = idx % 7 // 요일
            const isSelected = cell.date === selectedDate
            const net = cell.income - cell.expense
            const hasData = cell.income > 0 || cell.expense > 0

            return (
              <button
                key={idx}
                onClick={() => handleCellClick(cell.date)}
                disabled={!cell.date}
                className={`relative flex flex-col items-center pt-2 pb-1.5 min-h-[56px] transition-colors border-b border-r border-white/[0.03] ${
                  isSelected
                    ? 'bg-[#3D8EF8]/15'
                    : cell.date ? 'hover:bg-white/[0.03] active:bg-white/[0.05]' : ''
                } ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}`}
              >
                {cell.date && (
                  <>
                    {/* 날짜 숫자 */}
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? 'bg-[#3D8EF8] text-white'
                          : isSelected
                          ? 'text-[#3D8EF8]'
                          : colIdx === 0
                          ? 'text-[#F25260]/80'
                          : colIdx === 6
                          ? 'text-[#3D8EF8]/80'
                          : 'text-white/70'
                      }`}
                    >
                      {parseInt(cell.date.split('-')[2])}
                    </span>

                    {/* 금액 표시 */}
                    {hasData && (
                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        {cell.expense > 0 && (
                          <span className="text-[9px] font-semibold text-[#F25260] leading-none num">
                            -{cell.expense >= 10000 ? `${Math.round(cell.expense / 10000)}만` : fmt(cell.expense)}
                          </span>
                        )}
                        {cell.income > 0 && (
                          <span className="text-[9px] font-semibold text-[#2ACF6A] leading-none num">
                            +{cell.income >= 10000 ? `${Math.round(cell.income / 10000)}만` : fmt(cell.income)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 하루 순잔액 점 */}
                    {hasData && (
                      <div
                        className="w-1 h-1 rounded-full mt-0.5"
                        style={{ backgroundColor: net >= 0 ? '#2ACF6A' : '#F25260' }}
                      />
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택된 날짜 내역 */}
      {selectedDate && (
        <div className="bg-[#1E2236] rounded-3xl overflow-hidden tab-content">
          <div className="px-5 pt-4 pb-3 border-b border-white/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{formatSelectedDate(selectedDate)}</span>
              {selectedTx.length > 0 && (
                <span className={`text-sm font-bold num ${
                  selectedTx.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0) >= 0
                    ? 'text-[#3D8EF8]' : 'text-[#F25260]'
                }`}>
                  {(() => {
                    const net = selectedTx.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0)
                    return `${net >= 0 ? '+' : ''}${fmt(net)}원`
                  })()}
                </span>
              )}
            </div>
          </div>

          {selectedTx.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#4E5968]">이 날은 내역이 없어요</p>
            </div>
          ) : (
            <div>
              {selectedTx.map((t, idx) => {
                const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-5 py-3.5 group ${
                      idx < selectedTx.length - 1 ? 'border-b border-white/[0.04]' : ''
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: color.bg }}
                    >
                      {CATEGORY_EMOJI[t.category] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white">{t.category}</p>
                      {t.description && (
                        <p className="text-xs text-[#4E5968] truncate mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="text-[14px] font-bold num"
                        style={{ color: t.type === 'income' ? '#2ACF6A' : '#F1F3F6' }}
                      >
                        {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}원
                      </span>
                      <div className="hidden group-hover:flex gap-0.5 ml-1">
                        <button
                          onClick={() => onEdit(t)}
                          className="p-1.5 rounded-xl hover:bg-[#3D8EF8]/15 text-[#4E5968] hover:text-[#3D8EF8] transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onDelete(t.id)}
                          className="p-1.5 rounded-xl hover:bg-[#F25260]/15 text-[#4E5968] hover:text-[#F25260] transition-colors"
                        >
                          <Trash2 size={12} />
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
  )
}
