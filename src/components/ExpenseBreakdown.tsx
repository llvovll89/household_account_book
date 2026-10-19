import { useMemo, useState } from 'react'
import type { Transaction } from '../types'
import { EXPENSE_VIEW_LABELS, getExpenseGroup, summarizeExpenses } from '../lib/expenseBreakdown'
import type { ExpenseView } from '../lib/expenseBreakdown'
import { fmt } from '../lib/format'
import DonutChart from './charts/DonutChart'

// expenses: 이미 해당 월·지출로 걸러진 거래 (Analytics의 currentExpense)
export default function ExpenseBreakdown({ expenses, yearMonth }: { expenses: Transaction[]; yearMonth: string }) {
  const [view, setView] = useState<ExpenseView>('all')
  const totals = useMemo(() => summarizeExpenses(expenses), [expenses])
  const sum = totals[view]
  const data = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const t of expenses) {
      if (view !== 'all' && getExpenseGroup(t) !== view) continue
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
    }
    return [...byCategory].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ cat, amt, pct: sum ? Math.round(amt / sum * 100) : 0 }))
  }, [expenses, view, sum])
  return <section className="expense-breakdown bg-[#1C1C1E] rounded-2xl p-5" aria-labelledby="expense-breakdown-title">
    <h3 id="expense-breakdown-title" className="text-[15px] font-bold">유출을 나눠 보기</h3>
    <p className="text-xs text-[#8B95A1] mt-2">{yearMonth.replace('-', '년 ')}월 기준. 소비에는 보험료가 포함돼요. 전체 지출 합계와 기록은 바뀌지 않아요.</p>
    <div role="group" aria-label="유출 구분" className="expense-view-switch">
      {(Object.keys(EXPENSE_VIEW_LABELS) as ExpenseView[]).map(key => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>
        <span>{EXPENSE_VIEW_LABELS[key]}</span><strong className="num">{fmt(totals[key])}원</strong>
      </button>)}
    </div>
    <p className="text-sm font-semibold mb-3" role="status">{EXPENSE_VIEW_LABELS[view]} {fmt(sum)}원</p>
    {data.length ? <DonutChart data={data} /> : <p className="text-sm text-[#8B95A1] py-6 text-center">이 달에 기록한 {EXPENSE_VIEW_LABELS[view]} 내역이 없어요.</p>}
    {view === 'loan' && <p className="text-xs text-[#8B95A1] mt-3 leading-relaxed">원금 {fmt(totals.principal)}원 / 이자 {fmt(totals.interest)}원 / 구분하지 않은 금액 {fmt(totals.unsplit)}원. 원금·이자는 대출 내역에서 선택 입력할 수 있어요.</p>}
  </section>
}
