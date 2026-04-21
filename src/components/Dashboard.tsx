import { useMemo, useState, useEffect, useRef } from 'react'
import { Settings2, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, PlusCircle, Pencil, LayoutList, Gauge, Tag } from 'lucide-react'
import type { Transaction, Budget, RecurringTransaction } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../types'
import BudgetModal from './BudgetModal'
import RecurringModal from './RecurringModal'
import { loadSettings, saveSettings } from '../lib/storage'
import { useMonthlyData } from '../lib/useMonthlyData'
import SparklineCard from './charts/SparklineCard'
import BudgetGauge from './charts/BudgetGauge'
import { fmt, fmtShort } from '../lib/format'
import { showToast } from '../lib/toast'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  settingsVersion: number
  yearMonth: string
  customExpenseCategories: string[]
  onBudgetsChange: (b: Budget[]) => void
  onRecurringSave: (items: RecurringTransaction[]) => void
  onApplyRecurring: (items: RecurringTransaction[]) => void
  onOpenCategoryModal: () => void
}

function calcNet(items: Transaction[]) {
  return items.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
}

export default function Dashboard({ transactions, budgets, recurring, settingsVersion, yearMonth, customExpenseCategories, onBudgetsChange, onRecurringSave, onApplyRecurring, onOpenCategoryModal }: Props) {
  const [showBudget, setShowBudget] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [payday, setPayday] = useState<number | 'last' | null>(null)
  const [editingPayday, setEditingPayday] = useState(false)
  const [paydayInput, setPaydayInput] = useState('')
  const [paydayError, setPaydayError] = useState('')
  const [budgetView, setBudgetView] = useState<'list' | 'gauge'>('list')
  const lastNotifiedMonthRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false

    void loadSettings().then((settings) => {
      if (!cancelled) {
        setPayday(settings.payday)
      }
    })

    return () => {
      cancelled = true
    }
  }, [settingsVersion])

  function handleSavePayday() {
    if (paydayInput === 'last') {
      setPaydayError('')
      setPayday('last')
      void (async () => {
        const current = await loadSettings()
        await saveSettings({ ...current, payday: 'last' })
      })()
      setEditingPayday(false)
      return
    }
    const val = parseInt(paydayInput, 10)
    if (isNaN(val) || val < 1 || val > 31) {
      setPaydayError('1~31 사이의 숫자를 입력하세요')
      return
    }
    setPaydayError('')
    setPayday(val)
    void (async () => {
      const current = await loadSettings()
      await saveSettings({ ...current, payday: val })
    })()
    setEditingPayday(false)
  }

  // 월급날까지 남은 일수 + 하루 가용 예산 계산
  const paydayInfo = useMemo(() => {
    if (!payday) return null
    const today = new Date()
    const todayNum = today.getDate()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    let daysLeft: number
    if (payday === 'last') {
      const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      daysLeft = lastDayOfCurrentMonth - todayNum
    } else if (payday > todayNum) {
      daysLeft = payday - todayNum
    } else if (payday === todayNum) {
      daysLeft = 0
    } else {
      // 다음 달에 해당 날짜가 없을 경우(예: 31일 → 2월) 마지막 날로 보정
      const lastDayOfNextMonth = new Date(currentYear, currentMonth + 2, 0).getDate()
      const adjustedPayday = Math.min(payday, lastDayOfNextMonth)
      const nextPayday = new Date(currentYear, currentMonth + 1, adjustedPayday)
      daysLeft = Math.round((nextPayday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }

    const [y, m] = yearMonth.split('-').map(Number)
    const monthlyTx = transactions.filter((t) => t.date.startsWith(yearMonth))
    const openingBalance = calcNet(transactions.filter((t) => t.date < `${yearMonth}-01`))
    const income = monthlyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthlyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const remaining = openingBalance + (income - expense)

    const daysInMonth = new Date(y, m, 0).getDate()
    const daysRemaining = Math.max(1, daysInMonth - todayNum + 1)
    const dailyBudget = remaining > 0 ? Math.floor(remaining / daysRemaining) : 0

    return { daysLeft, remaining, dailyBudget, openingBalance, income, expense, daysRemaining }
  }, [payday, transactions, yearMonth])

  const monthly = useMemo(
    () => transactions.filter((t) => t.date.startsWith(yearMonth)),
    [transactions, yearMonth]
  )
  const income = useMemo(
    () => monthly.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthly]
  )
  const expense = useMemo(
    () => monthly.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthly]
  )
  const openingBalance = useMemo(
    () => calcNet(transactions.filter((t) => t.date < `${yearMonth}-01`)),
    [transactions, yearMonth]
  )
  const balance = openingBalance + (income - expense)
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    monthly.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [monthly])

  // 이번 달 미적용 정기 항목
  const pendingRecurring = useMemo(
    () => recurring.filter((r) => r.lastAppliedMonth !== yearMonth),
    [recurring, yearMonth]
  )

  // 이월 금액 계산 (전월 미사용 예산)
  const carryoverAmounts = useMemo(() => {
    const map: Record<string, number> = {}
    const [y, m] = yearMonth.split('-').map(Number)
    const prevYM = m === 1
      ? `${y - 1}-12`
      : `${y}-${String(m - 1).padStart(2, '0')}`
    for (const b of budgets) {
      if (!b.carryover) continue
      const prevSpent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(prevYM))
        .reduce((s, t) => s + t.amount, 0)
      const unused = Math.max(0, b.limit - prevSpent)
      if (unused > 0) map[b.category] = unused
    }
    return map
  }, [budgets, transactions, yearMonth])

  // 예산 초과 카테고리 (이월 포함 유효 한도 기준)
  const overBudget = useMemo(() => {
    const map: Record<string, number> = {}
    monthly.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return budgets.filter((b) => {
      const effectiveLimit = b.limit + (carryoverAmounts[b.category] ?? 0)
      return (map[b.category] || 0) > effectiveLimit
    })
  }, [monthly, budgets, carryoverAmounts])

  // 예산 초과 감지 및 알림
  useEffect(() => {
    const currentMonth = yearMonth

    // 월이 바뀌었으면 알림 표시
    if (currentMonth !== lastNotifiedMonthRef.current && overBudget.length > 0) {
      lastNotifiedMonthRef.current = currentMonth

      overBudget.forEach((budget) => {
        const spent = monthly
          .filter((t) => t.type === 'expense' && t.category === budget.category)
          .reduce((sum, t) => sum + t.amount, 0)

        showToast(
          `⚠️ ${budget.category} 예산을 초과했습니다\n지출: ${fmt(spent)} / 예산: ${fmt(budget.limit)}`,
          3000
        )
      })
    }
  }, [yearMonth, overBudget, monthly])

  // 6개월 스파크라인 데이터
  const monthlyData = useMonthlyData(transactions)
  const sparkIncome = monthlyData.map(m => ({ value: m.income }))
  const sparkExpense = monthlyData.map(m => ({ value: m.expense }))
  const sparkBalance = monthlyData.map(m => ({ value: Math.max(0, m.balance) }))

  const prevMonth = monthlyData[4]
  const incomeTrend = prevMonth.income > 0
    ? Math.round(((income - prevMonth.income) / prevMonth.income) * 100) : null
  const expenseTrend = prevMonth.expense > 0
    ? Math.round(((expense - prevMonth.expense) / prevMonth.expense) * 100) : null

  // 예산 게이지용 카테고리별 지출
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    monthly.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [monthly])

  return (
    <div className="space-y-3 tab-content">
      {/* 예산 초과 알림 */}
      {overBudget.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#F5BE3A]/10 rounded-2xl border border-[#F5BE3A]/20">
          <AlertTriangle size={16} className="text-[#F5BE3A] shrink-0" />
          <p className="text-sm text-[#F5BE3A] font-semibold">
            {overBudget.map(b => b.category).join(', ')} 예산을 초과했어요
          </p>
        </div>
      )}

      {/* 정기 지출 미적용 알림 */}
      {pendingRecurring.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-[#3D8EF8]" />
              <span className="text-sm font-bold text-white">이번 달 정기 항목</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">
                {pendingRecurring.length}건 미등록
              </span>
            </div>
            <button
              onClick={() => setShowRecurring(true)}
              className="text-xs text-[#4E5968] hover:text-[#8B95A1] font-semibold transition-colors"
            >
              관리
            </button>
          </div>
          <div className="space-y-2 mb-3">
            {pendingRecurring.slice(0, 3).map((r) => {
              const color = CATEGORY_COLOR[r.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              return (
                <div key={r.id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: color.bg }}>
                    {CATEGORY_EMOJI[r.category] ?? '📦'}
                  </div>
                  <span className="text-sm text-[#8B95A1] flex-1">{r.category}</span>
                  <span className="text-xs text-[#4E5968]">매월 {r.dayOfMonth}일</span>
                  <span className={`text-sm font-bold num ${r.type === 'income' ? 'text-[#2ACF6A]' : 'text-[#F1F3F6]'}`}>
                    {r.type === 'income' ? '+' : '-'}{r.amount.toLocaleString()}원
                  </span>
                </div>
              )
            })}
            {pendingRecurring.length > 3 && (
              <p className="text-xs text-[#4E5968] text-center pt-1">외 {pendingRecurring.length - 3}건 더</p>
            )}
          </div>
          <button
            onClick={() => onApplyRecurring(pendingRecurring)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3D8EF8]/15 text-[#3D8EF8] text-sm font-bold hover:bg-[#3D8EF8]/25 transition-colors"
          >
            <PlusCircle size={14} />
            {pendingRecurring.length}건 이번 달에 등록
          </button>
        </div>
      )}

      {/* 메인 잔액 카드 */}
      <div className="rounded-2xl p-6 bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)]">
        <p className="text-sm font-medium text-[#8B95A1] mb-1">이번 달 잔액</p>
        <p className={`text-[40px] font-black leading-tight num tracking-tight ${balance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
          {balance < 0 ? '-' : ''}{fmt(Math.abs(balance))}
          <span className="text-[20px] font-bold ml-1 text-[#8B95A1]">원</span>
        </p>

        <div className="mt-5 pt-4 border-t border-white/[0.07] grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2ACF6A]/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-[#2ACF6A]" />
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1]">수입</p>
              <p className="text-sm font-bold text-[#2ACF6A] num">+{fmt(income)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F25260]/10 flex items-center justify-center">
              <TrendingDown size={14} className="text-[#F25260]" />
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1]">지출</p>
              <p className="text-sm font-bold text-[#F25260] num">-{fmt(expense)}</p>
            </div>
          </div>
        </div>

        {income > 0 && (
          <div className="mt-4">
            <div className="h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((expense / income) * 100, 100)}%`,
                  background: expense / income > 0.9 ? '#F25260' : expense / income > 0.7 ? '#F5BE3A' : '#3D8EF8',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-[#4E5968]">
              <span>지출 {income > 0 ? Math.round((expense / income) * 100) : 0}%</span>
              {savingsRate !== null && <span>저축률 {savingsRate}%</span>}
            </div>
          </div>
        )}
      </div>

      {/* 6개월 스파크라인 요약 */}
      <div className="flex gap-2">
        <SparklineCard
          data={sparkIncome}
          color="#3D8EF8"
          label="수입"
          value={`${fmtShort(income)}원`}
          trend={incomeTrend}
        />
        <SparklineCard
          data={sparkExpense}
          color="#F25260"
          label="지출"
          value={`${fmtShort(expense)}원`}
          trend={expenseTrend !== null ? -expenseTrend : null}
        />
        <SparklineCard
          data={sparkBalance}
          color={balance >= 0 ? '#2ACF6A' : '#F25260'}
          label="잔액"
          value={`${balance >= 0 ? '' : '-'}${fmtShort(Math.abs(balance))}원`}
        />
      </div>

      {/* 월급날 카운트다운 */}
      {!payday && !editingPayday && (
        <button
          onClick={() => { setEditingPayday(true); setPaydayInput('') }}
          className="w-full flex items-center gap-2 justify-center py-3 rounded-2xl border border-dashed border-white/10 text-xs font-semibold text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
        >
          💰 월급날 설정하기
        </button>
      )}

      {editingPayday && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5 space-y-2">
          <div className="flex gap-2 mb-1">
            <button
              onClick={() => { setPaydayInput(paydayInput === 'last' ? '' : paydayInput); setPaydayError('') }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${paydayInput !== 'last' ? 'bg-[#3D8EF8] text-white' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}
            >
              날짜 입력
            </button>
            <button
              onClick={() => { setPaydayInput('last'); setPaydayError('') }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${paydayInput === 'last' ? 'bg-[#3D8EF8] text-white' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}
            >
              매월 말일
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white shrink-0">매월</span>
            {paydayInput === 'last' ? (
              <div className="flex-1 bg-[#2C2C2E] text-white text-center font-bold rounded-xl px-3 py-2 text-sm">
                말일
              </div>
            ) : (
              <input
                type="number" min="1" max="31"
                value={paydayInput}
                onChange={(e) => { setPaydayInput(e.target.value); setPaydayError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePayday()}
                placeholder="15"
                autoFocus
                className={`flex-1 bg-[#2C2C2E] text-white text-center font-bold rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 ${paydayError ? 'ring-1 ring-[#F25260]/60' : 'focus:ring-[#3D8EF8]/40'}`}
              />
            )}
            <span className="text-sm font-semibold text-white shrink-0">이 월급날</span>
            <button onClick={handleSavePayday}
              className="px-3 py-2 rounded-xl bg-[#3D8EF8] text-white text-xs font-bold hover:bg-[#5AA0FF] transition-colors shrink-0">
              저장
            </button>
            <button onClick={() => { setEditingPayday(false); setPaydayError('') }}
              className="px-3 py-2 rounded-xl bg-[#2C2C2E] text-[#8B95A1] text-xs font-bold transition-colors shrink-0">
              취소
            </button>
          </div>
          {paydayError && (
            <p className="text-xs text-[#F25260] font-semibold pl-1">{paydayError}</p>
          )}
        </div>
      )}

      {payday && !editingPayday && paydayInfo && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <div>
                <span className="text-sm font-bold text-white">
                  {paydayInfo.daysLeft === 0
                    ? '오늘이 월급날이에요! 🎉'
                    : `월급까지 D-${paydayInfo.daysLeft}`}
                </span>
                <p className="text-[11px] text-[#4E5968]">
                  {payday === 'last' ? '매월 말일 기준' : `매월 ${payday}일 기준`}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setEditingPayday(true); setPaydayInput(payday === 'last' ? 'last' : String(payday)) }}
              className="p-1.5 rounded-lg text-[#4E5968] hover:text-[#8B95A1] transition-colors"
            >
              <Pencil size={12} />
            </button>
          </div>
          {paydayInfo.remaining > 0 && (
            <>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-xs text-[#4E5968]">오늘 쓸 수 있는 금액</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              {paydayInfo.dailyBudget > 0 && (
                <p className="text-center text-[24px] font-black text-[#3D8EF8] num mt-1.5">
                  {paydayInfo.dailyBudget.toLocaleString()}
                  <span className="text-sm font-semibold text-[#4E5968] ml-1">원</span>
                </p>
              )}
              <div className="mt-2 rounded-xl bg-[#2C2C2E] px-3 py-2 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#4E5968]">이월잔액</span>
                  <span className={`num font-semibold ${paydayInfo.openingBalance >= 0 ? 'text-[#8B95A1]' : 'text-[#F25260]'}`}>
                    {paydayInfo.openingBalance >= 0 ? '+' : ''}{paydayInfo.openingBalance.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#4E5968]">이번 달 수입</span>
                  <span className="num font-semibold text-[#2ACF6A]">+{paydayInfo.income.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#4E5968]">이번 달 지출</span>
                  <span className="num font-semibold text-[#F25260]">-{paydayInfo.expense.toLocaleString()}원</span>
                </div>
                <div className="h-px bg-white/5 my-0.5" />
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#4E5968]">잔액 ÷ 남은 {paydayInfo.daysRemaining}일</span>
                  <span className="num font-semibold text-[#8B95A1]">{paydayInfo.remaining.toLocaleString()}원</span>
                </div>
              </div>
            </>
          )}
          {paydayInfo.remaining <= 0 && (
            <p className="text-center text-sm font-semibold text-[#F25260] mt-1.5">이번 달 예산을 초과했어요</p>
          )}
        </div>
      )}

      {/* 예산 관리 카드 */}
      <div className="bg-[#1C1C1E] rounded-2xl p-5">
        <div className="flex flex-col items-start gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] font-bold text-white">예산 관리</p>
          <div className="w-full grid grid-cols-2 gap-2 sm:w-auto sm:flex sm:gap-2">
            {budgets.length > 0 && (
              <button
                onClick={() => setBudgetView(v => v === 'list' ? 'gauge' : 'list')}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] text-xs font-semibold transition-colors whitespace-nowrap"
                title={budgetView === 'list' ? '게이지 보기' : '목록 보기'}
              >
                {budgetView === 'list' ? <Gauge size={12} /> : <LayoutList size={12} />}
              </button>
            )}
            <button
              onClick={onOpenCategoryModal}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Tag size={11} />
              카테고리
            </button>
            <button
              onClick={() => setShowRecurring(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <RefreshCw size={11} />
              정기
            </button>
            <button
              onClick={() => setShowBudget(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Settings2 size={12} />
              설정
            </button>
          </div>
        </div>

        {budgets.length === 0 ? (
          <button
            onClick={() => setShowBudget(true)}
            className="w-full py-4 rounded-2xl border border-dashed border-white/10 text-sm text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
          >
            + 카테고리별 예산을 설정해보세요
          </button>
        ) : budgetView === 'gauge' ? (
          /* 게이지 뷰 */
          <div className="grid grid-cols-3 gap-4">
            {[...EXPENSE_CATEGORIES, ...customExpenseCategories].filter(cat => budgets.find(b => b.category === cat)).map((cat) => {
              const budget = budgets.find((b) => b.category === cat)!
              const spent = spentByCategory[cat] ?? 0
              const effectiveLimit = budget.limit + (carryoverAmounts[cat] ?? 0)
              const color = CATEGORY_COLOR[cat]?.text ?? '#8B95A1'
              return (
                <BudgetGauge
                  key={cat}
                  category={cat}
                  emoji={CATEGORY_EMOJI[cat] ?? '📦'}
                  spent={spent}
                  limit={effectiveLimit}
                  color={color}
                />
              )
            })}
          </div>
        ) : (
          /* 리스트 뷰 */
          <div className="space-y-3.5">
            {[...EXPENSE_CATEGORIES, ...customExpenseCategories].filter(cat => budgets.find(b => b.category === cat)).map((cat) => {
              const budget = budgets.find((b) => b.category === cat)!
              const spent = monthly
                .filter((t) => t.type === 'expense' && t.category === cat)
                .reduce((s, t) => s + t.amount, 0)
              const carryover = carryoverAmounts[cat] ?? 0
              const effectiveLimit = budget.limit + carryover
              const pct = Math.min((spent / effectiveLimit) * 100, 100)
              const isOver = spent > effectiveLimit
              const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                      <span className="text-sm font-semibold text-white">{cat}</span>
                      {carryover > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">
                          +이월 {fmtShort(carryover)}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold num ${isOver ? 'text-[#F25260]' : 'text-white'}`}>
                        {fmt(spent)}
                      </span>
                      <span className="text-xs text-[#4E5968] num"> / {fmt(effectiveLimit)}원</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isOver ? '#F25260' : color.text,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 카테고리별 지출 */}
      {expenseByCategory.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl p-5">
          <p className="text-[15px] font-bold text-white mb-4">이번 달 지출 TOP</p>
          <div className="space-y-3">
            {expenseByCategory.map(([cat, amt]) => {
              const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: color.bg }}
                  >
                    {CATEGORY_EMOJI[cat] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-semibold text-white">{cat}</span>
                      <span className="text-sm font-bold text-white num">{fmt(amt)}원</span>
                    </div>
                    <div className="h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color.text }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-[#4E5968] w-7 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {monthly.length === 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl p-12 text-center">
          <p className="text-5xl mb-4">💸</p>
          <p className="font-bold text-white text-[15px]">내역이 없어요</p>
          <p className="text-[#4E5968] text-sm mt-1">+ 버튼으로 첫 내역을 추가해보세요</p>
        </div>
      )}

      {showBudget && (
        <BudgetModal
          budgets={budgets}
          customExpenseCategories={customExpenseCategories}
          onSave={onBudgetsChange}
          onClose={() => setShowBudget(false)}
        />
      )}
      {showRecurring && (
        <RecurringModal
          recurring={recurring}
          customExpenseCategories={customExpenseCategories}
          onSave={onRecurringSave}
          onClose={() => setShowRecurring(false)}
        />
      )}
    </div>
  )
}
