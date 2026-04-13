import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Budget, Transaction } from '../types'
import { CATEGORY_EMOJI } from '../types'
import SpendingAnalysisView from './SpendingAnalysisView'
import { useMonthlyData } from '../lib/useMonthlyData'
import { fmtShort as fmt } from '../lib/format'
import TrendAreaChart from './charts/TrendAreaChart'
import WeekdayBarChart from './charts/WeekdayBarChart'
import DonutChart from './charts/DonutChart'
import YearlyBarChart from './charts/YearlyBarChart'
import CumulativeLineChart from './charts/CumulativeLineChart'
import CashflowChart from './charts/CashflowChart'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  budgets: Budget[]
}

function getYM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토']

type ViewMode = 'monthly' | 'yearly' | 'cashflow' | 'reduce'

export default function Analytics({ transactions, yearMonth, budgets }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // ── 월간 데이터 (공유 훅) ────────────────────────────────
  const monthlyData = useMonthlyData(transactions)
  const current = monthlyData[5]
  const prev = monthlyData[4]

  const expenseDiff = prev.expense > 0
    ? Math.round(((current.expense - prev.expense) / prev.expense) * 100) : null
  const incomeDiff = prev.income > 0
    ? Math.round(((current.income - prev.income) / prev.income) * 100) : null

  // ── 연간 데이터 ────────────────────────────────────────
  const yearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const ym = getYM(selectedYear, i + 1)
      const monthly = transactions.filter((t) => t.date.startsWith(ym))
      const income = monthly.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = monthly.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { ym, label: `${i + 1}월`, income, expense, balance: income - expense }
    })
  }, [transactions, selectedYear])

  const yearTotalIncome = yearlyData.reduce((s, m) => s + m.income, 0)
  const yearTotalExpense = yearlyData.reduce((s, m) => s + m.expense, 0)

  // ── 이번 달 카테고리별 지출 ────────────────────────────
  const currentMonthly = transactions.filter((t) => t.date.startsWith(yearMonth))
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    currentMonthly.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? Math.round((amt / total) * 100) : 0 }))
  }, [currentMonthly])

  // ── 요일별 소비 패턴 (이번 달) ────────────────────────
  const weekdayData = useMemo(() => {
    const totals = Array(7).fill(0)
    const counts = Array(7).fill(0)
    currentMonthly.filter((t) => t.type === 'expense').forEach((t) => {
      const dow = new Date(t.date).getDay()
      totals[dow] += t.amount
      counts[dow]++
    })
    return WEEKDAYS_SHORT.map((label, i) => ({
      label,
      total: totals[i],
      count: counts[i],
    }))
  }, [currentMonthly])

  const topWeekday = weekdayData.reduce((max, d) => d.total > max.total ? d : max, weekdayData[0])

  // ── 스마트 인사이트 ───────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: string; text: string; color: string }[] = []

    if (expenseDiff !== null) {
      if (expenseDiff > 0) {
        list.push({ icon: '📈', text: `지출이 전월 대비 ${expenseDiff}% 늘었어요`, color: '#F25260' })
      } else if (expenseDiff < 0) {
        list.push({ icon: '🎉', text: `지출이 전월 대비 ${Math.abs(expenseDiff)}% 줄었어요!`, color: '#2ACF6A' })
      } else {
        list.push({ icon: '✅', text: `지출이 전월과 동일해요`, color: '#8B95A1' })
      }
    }

    if (incomeDiff !== null && Math.abs(incomeDiff) >= 5) {
      list.push({
        icon: incomeDiff > 0 ? '💰' : '⚠️',
        text: incomeDiff > 0 ? `수입이 전월 대비 ${incomeDiff}% 증가했어요` : `수입이 전월 대비 ${Math.abs(incomeDiff)}% 감소했어요`,
        color: incomeDiff > 0 ? '#2ACF6A' : '#F5BE3A',
      })
    }

    const topCat = expenseByCategory[0]
    if (topCat) {
      list.push({ icon: CATEGORY_EMOJI[topCat.cat] ?? '📦', text: `가장 많이 쓴 항목은 ${topCat.cat} (${topCat.pct}%)`, color: '#8B95A1' })
    }

    if (topWeekday.total > 0) {
      list.push({ icon: '📅', text: `${topWeekday.label}요일 지출이 가장 많아요 (${fmt(topWeekday.total)}원)`, color: '#8B95A1' })
    }

    const currentBalance = current.income - current.expense
    if (currentBalance > 0 && current.income > 0) {
      const saveRate = Math.round((currentBalance / current.income) * 100)
      if (saveRate >= 30) list.push({ icon: '🏆', text: `저축률 ${saveRate}%! 훌륭한 한 달이에요`, color: '#F5BE3A' })
    }

    return list.slice(0, 4)
  }, [expenseDiff, incomeDiff, expenseByCategory, current, topWeekday])

  // ── 캐시플로 탭 best/worst 월 ────────────────────────
  const cashflowStats = useMemo(() => {
    const withData = monthlyData.filter(m => m.income > 0 || m.expense > 0)
    if (withData.length === 0) return null
    const best = withData.reduce((a, b) => b.balance > a.balance ? b : a)
    const worst = withData.reduce((a, b) => b.balance < a.balance ? b : a)
    return { best, worst }
  }, [monthlyData])

  const TAB_LABELS: Record<ViewMode, string> = {
    monthly: '월간 분석',
    yearly: '연간 요약',
    cashflow: '캐시플로',
    reduce: '절감 제안',
  }

  return (
    <div className="space-y-3 tab-content">
      {/* 탭 토글 */}
      <div className="bg-[#1E2236] rounded-2xl p-1 flex">
        {(['monthly', 'yearly', 'cashflow', 'reduce'] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === m ? 'bg-[#3D8EF8] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'
            }`}
          >
            {TAB_LABELS[m]}
          </button>
        ))}
      </div>

      {/* ──── 월간 뷰 ──── */}
      {viewMode === 'monthly' && (
        <>
          {/* 인사이트 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-[#F5BE3A]" />
              <p className="text-[15px] font-bold text-white">이번 달 인사이트</p>
            </div>
            {insights.length === 0 ? (
              <p className="text-sm text-[#4E5968] text-center py-4">내역을 더 추가하면 분석을 보여드려요</p>
            ) : (
              <div className="space-y-2.5">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#252A3F] rounded-2xl px-4 py-3">
                    <span className="text-xl shrink-0">{ins.icon}</span>
                    <p className="text-sm font-medium" style={{ color: ins.color }}>{ins.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 전월 대비 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">전월 대비</p>
            <div className="grid grid-cols-2 gap-3">
              <CompareCard label="수입" current={current.income} prev={prev.income} diff={incomeDiff} isIncome />
              <CompareCard label="지출" current={current.expense} prev={prev.expense} diff={expenseDiff} isIncome={false} />
            </div>
          </div>

          {/* 6개월 트렌드 차트 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">최근 6개월 트렌드</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3D8EF8]" />
                <span className="text-xs text-[#8B95A1]">수입</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F25260]" />
                <span className="text-xs text-[#8B95A1]">지출</span>
              </div>
            </div>
            <TrendAreaChart data={monthlyData} currentYM={yearMonth} />
            <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
              {monthlyData.slice(-3).map((m) => (
                <div key={m.ym} className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${m.ym === yearMonth ? 'text-white' : 'text-[#4E5968]'}`}>{m.label}</span>
                  <div className="flex gap-4">
                    <span className="text-xs text-[#3D8EF8] num">+{fmt(m.income)}</span>
                    <span className="text-xs text-[#F25260] num">-{fmt(m.expense)}</span>
                    <span className={`text-xs font-bold num ${m.balance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                      {m.balance >= 0 ? '+' : ''}{fmt(m.balance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 이번 달 누적 잔액 흐름 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">이번 달 잔액 흐름</p>
            <p className="text-xs text-[#4E5968] mb-4">일별 누적 순잔액 변화</p>
            {currentMonthly.length === 0 ? (
              <p className="text-sm text-[#4E5968] text-center py-4">이번 달 내역이 없어요</p>
            ) : (
              <CumulativeLineChart transactions={transactions} yearMonth={yearMonth} />
            )}
          </div>

          {/* 요일별 소비 패턴 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">요일별 소비 패턴</p>
            <p className="text-xs text-[#4E5968] mb-4">이번 달 요일별 총 지출</p>
            {weekdayData.every((d) => d.total === 0) ? (
              <p className="text-sm text-[#4E5968] text-center py-4">이번 달 지출 내역이 없어요</p>
            ) : (
              <>
                <WeekdayBarChart data={weekdayData} />
                <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-2">
                  {weekdayData.filter((d) => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#252A3F] rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-[#8B95A1]">{d.label}요일</span>
                      <span className="text-xs font-bold text-white num">{fmt(d.total)}원</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 카테고리 비율 - 도넛 차트 */}
          {expenseByCategory.length > 0 && (
            <div className="bg-[#1E2236] rounded-3xl p-5">
              <p className="text-[15px] font-bold text-white mb-4">카테고리 비율</p>
              <DonutChart data={expenseByCategory} />
            </div>
          )}
        </>
      )}

      {/* ──── 연간 뷰 ──── */}
      {viewMode === 'yearly' && (
        <>
          {/* 연도 선택 */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="w-9 h-9 rounded-full bg-[#1E2236] border border-white/[0.06] flex items-center justify-center"
            >
              <ChevronLeft size={16} className="text-[#8B95A1]" />
            </button>
            <span className="text-[17px] font-extrabold text-white">{selectedYear}년</span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={selectedYear >= new Date().getFullYear()}
              className="w-9 h-9 rounded-full bg-[#1E2236] border border-white/[0.06] flex items-center justify-center disabled:opacity-30"
            >
              <ChevronRight size={16} className="text-[#8B95A1]" />
            </button>
          </div>

          {/* 연간 합계 카드 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">{selectedYear}년 합계</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#252A3F] rounded-2xl p-3.5 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1.5">총 수입</p>
                <p className="text-sm font-extrabold text-[#2ACF6A] num">{fmt(yearTotalIncome)}</p>
                <p className="text-[10px] text-[#4E5968] mt-0.5">원</p>
              </div>
              <div className="bg-[#252A3F] rounded-2xl p-3.5 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1.5">총 지출</p>
                <p className="text-sm font-extrabold text-[#F25260] num">{fmt(yearTotalExpense)}</p>
                <p className="text-[10px] text-[#4E5968] mt-0.5">원</p>
              </div>
              <div className="bg-[#252A3F] rounded-2xl p-3.5 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1.5">순 저축</p>
                <p className={`text-sm font-extrabold num ${yearTotalIncome - yearTotalExpense >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                  {fmt(Math.abs(yearTotalIncome - yearTotalExpense))}
                </p>
                <p className="text-[10px] text-[#4E5968] mt-0.5">원</p>
              </div>
            </div>
            {yearTotalIncome > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[#4E5968] mb-1.5">
                  <span>연간 저축률</span>
                  <span className="font-bold text-white num">
                    {Math.round(Math.max(0, (yearTotalIncome - yearTotalExpense) / yearTotalIncome) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-[#252A3F] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((yearTotalIncome - yearTotalExpense) / yearTotalIncome) * 100))}%`,
                      backgroundColor: yearTotalIncome > yearTotalExpense ? '#3D8EF8' : '#F25260',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 12개월 차트 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">월별 추이</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3D8EF8]" />
                <span className="text-xs text-[#8B95A1]">수입</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F25260]" />
                <span className="text-xs text-[#8B95A1]">지출</span>
              </div>
            </div>
            <YearlyBarChart data={yearlyData} currentYM={yearMonth} />
          </div>

          {/* 월별 내역 테이블 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">월별 상세</p>
            <div className="space-y-2">
              {yearlyData.filter((m) => m.income > 0 || m.expense > 0).map((m) => {
                const isCurrent = m.ym === yearMonth
                return (
                  <div key={m.ym}
                    className={`flex items-center py-2.5 px-3 rounded-xl ${isCurrent ? 'bg-[#3D8EF8]/10' : ''}`}>
                    <span className={`text-sm font-bold w-10 shrink-0 ${isCurrent ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}>
                      {m.label}
                    </span>
                    <div className="flex-1 flex justify-end gap-4">
                      <span className="text-xs text-[#3D8EF8] num">+{fmt(m.income)}</span>
                      <span className="text-xs text-[#F25260] num">-{fmt(m.expense)}</span>
                      <span className={`text-xs font-bold num w-16 text-right ${m.balance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                        {m.balance >= 0 ? '+' : ''}{fmt(m.balance)}
                      </span>
                    </div>
                  </div>
                )
              })}
              {yearlyData.every((m) => m.income === 0 && m.expense === 0) && (
                <p className="text-sm text-[#4E5968] text-center py-6">{selectedYear}년 내역이 없어요</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ──── 절감 제안 뷰 ──── */}
      {viewMode === 'reduce' && (
        <SpendingAnalysisView transactions={transactions} budgets={budgets} />
      )}

      {/* ──── 캐시플로 뷰 ──── */}
      {viewMode === 'cashflow' && (
        <>
          {/* 캐시플로 차트 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">6개월 캐시플로</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3D8EF8]" />
                <span className="text-xs text-[#8B95A1]">수입</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F25260]" />
                <span className="text-xs text-[#8B95A1]">지출</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-1 rounded-full bg-[#2ACF6A]" style={{ borderStyle: 'dashed' }} />
                <span className="text-xs text-[#8B95A1]">순잔액</span>
              </div>
            </div>
            <CashflowChart data={monthlyData} />
          </div>

          {/* 월별 순이익 */}
          <div className="bg-[#1E2236] rounded-3xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">월별 순이익</p>
            <div className="space-y-2">
              {monthlyData.map((m) => {
                const isCurrent = m.ym === yearMonth
                const isPositive = m.balance >= 0
                return (
                  <div key={m.ym}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${isCurrent ? 'bg-[#3D8EF8]/10' : ''}`}>
                    <span className={`text-sm font-bold ${isCurrent ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}>{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#4E5968] num">{fmt(m.income)} → {fmt(m.expense)}</span>
                      <span className={`text-sm font-extrabold num ${isPositive ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                        {isPositive ? '+' : ''}{fmt(m.balance)}
                      </span>
                      <span className="text-base">{isPositive ? '📈' : '📉'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Best / Worst 월 */}
          {cashflowStats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1E2236] rounded-3xl p-4 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-2">최고의 달 🏆</p>
                <p className="text-sm font-bold text-white">{cashflowStats.best.label}</p>
                <p className="text-[13px] font-extrabold text-[#2ACF6A] num mt-1">
                  +{fmt(cashflowStats.best.balance)}원
                </p>
              </div>
              <div className="bg-[#1E2236] rounded-3xl p-4 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-2">아쉬운 달 😓</p>
                <p className="text-sm font-bold text-white">{cashflowStats.worst.label}</p>
                <p className="text-[13px] font-extrabold text-[#F25260] num mt-1">
                  {fmt(cashflowStats.worst.balance)}원
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CompareCard({
  label, current, prev, diff, isIncome,
}: {
  label: string; current: number; prev: number; diff: number | null; isIncome: boolean
}) {
  const mainColor = isIncome ? '#2ACF6A' : '#F25260'
  return (
    <div className="bg-[#252A3F] rounded-2xl p-4">
      <p className="text-xs text-[#4E5968] font-semibold mb-2">{label}</p>
      <p className="text-[17px] font-extrabold num" style={{ color: mainColor }}>
        {current.toLocaleString()}<span className="text-xs font-medium ml-0.5 text-[#4E5968]">원</span>
      </p>
      <p className="text-[11px] text-[#4E5968] num mt-0.5">전월 {prev.toLocaleString()}원</p>
      {diff !== null && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${
          diff === 0 ? 'text-[#4E5968]' :
          (isIncome ? (diff > 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]') :
                       (diff > 0 ? 'text-[#F25260]' : 'text-[#2ACF6A]'))
        }`}>
          {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {diff > 0 ? '+' : ''}{diff}%
        </div>
      )}
    </div>
  )
}
