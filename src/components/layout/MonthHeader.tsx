import type { Dispatch, SetStateAction } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  currentDate: Date
  setCurrentDate: Dispatch<SetStateAction<Date>>
  monthIncome: number
  monthExpense: number
  monthBalance: number
  monthCardDue: number
  nextMonthCardDue: number
  onOpenBilling: (billing: 'current' | 'next') => void
}

/** 헤더의 월 이동과 이달 수입·지출·차액, 카드 청구 바로가기. App.tsx에서 옮겨 왔다 */
export function MonthHeader({ currentDate, setCurrentDate, monthIncome, monthExpense, monthBalance, monthCardDue, nextMonthCardDue, onOpenBilling }: Props) {
  const now = new Date()
  const isCurrentMonth = currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()

  const moveMonth = (offset: number) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <div className="ledger-month-picker flex items-center justify-center gap-2 mt-3">
        <button
          aria-label="이전 달 보기"
          onClick={() => moveMonth(-1)}
          className="w-11 h-11 rounded-full bg-surface border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft size={16} className="text-muted" />
        </button>
        <button
          aria-label={`${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월, 누르면 이번 달로 이동`}
          title="누르면 이번 달로 돌아가요"
          data-current-month={isCurrentMonth}
          onClick={() => setCurrentDate(new Date())}
          className={`px-5 min-h-11 rounded-2xl text-base font-bold transition-all ${isCurrentMonth ? 'bg-white text-fg' : 'bg-surface text-muted border border-[rgba(255,255,255,0.06)]'}`}
        >
          {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
        </button>
        <button
          aria-label="다음 달 보기"
          onClick={() => moveMonth(1)}
          className="w-11 h-11 rounded-full bg-surface border border-[rgba(255,255,255,0.06)] flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronRight size={16} className="text-muted" />
        </button>
        {!isCurrentMonth && (
          <button type="button" onClick={() => setCurrentDate(new Date())} className="min-h-11 px-3 rounded-xl bg-tone-blue/10 text-accent text-xs font-semibold shrink-0">
            이번 달
          </button>
        )}
      </div>

      {(monthIncome > 0 || monthExpense > 0) && (
        <div className="mt-3 pb-1 space-y-1.5">
          <dl className="ledger-month-totals">
            <div><dt>수입</dt><dd className="text-xs font-semibold text-income num">{monthIncome.toLocaleString()}원</dd></div>
            <div><dt>지출</dt><dd className="text-xs font-semibold text-expense num">{monthExpense.toLocaleString()}원</dd></div>
            <div><dt>차액</dt><dd className={`text-xs font-bold num ${monthBalance >= 0 ? 'text-white' : 'text-expense'}`}>{monthBalance.toLocaleString()}원</dd></div>
          </dl>

          {(monthCardDue > 0 || nextMonthCardDue > 0) && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenBilling('current')}
                aria-label="카드 이번 청구 내역 필터 보기"
                className="text-[10px] font-bold text-warning num hover:text-warning transition-colors px-2 py-0.5 rounded-full bg-tone-amber/12"
                title="카드 이번 청구 내역 보기"
              >
                이번청구 {monthCardDue.toLocaleString()}
              </button>
              <button
                type="button"
                onClick={() => onOpenBilling('next')}
                aria-label="카드 다음 청구 내역 필터 보기"
                className="text-[10px] font-bold text-accent num hover:text-tone-blue-pale transition-colors px-2 py-0.5 rounded-full bg-tone-blue/12"
                title="카드 다음 청구 내역 보기"
              >
                다음청구 {nextMonthCardDue.toLocaleString()}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
