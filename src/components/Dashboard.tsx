import { useMemo, useState, useEffect, useRef } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Settings2, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, PlusCircle, Pencil, LayoutList, Gauge, Tag, PieChart, ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react'
import type { DashboardWidgetId, Transaction, Budget, RecurringTransaction, SavingsGoal, UserPaymentMethod, Subscription } from '../types'
import { CATEGORY_EMOJI, CATEGORY_COLOR, EXPENSE_CATEGORIES } from '../types'
import BudgetModal from './BudgetModal'
import RecurringModal from './RecurringModal'
import EmptyState from './ui/EmptyState'
import { loadSettings, saveSettings } from '../lib/storage'
import { useMonthlyData } from '../lib/useMonthlyData'
import SparklineCard from './charts/SparklineCard'
import BudgetGauge from './charts/BudgetGauge'
import { fmt, fmtPrice, fmtShort, parseYmdLocal, toLocalDateStr } from '../lib/format'
import { showToast } from '../lib/toast'
import { calculateCardDueAmount, formatBillingRange, getCardBillingRange, isCreditPaymentMethod, shiftYM } from '../lib/cardBilling'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringTransaction[]
  goals: SavingsGoal[]
  settingsVersion: number
  yearMonth: string
  customExpenseCategories: string[]
  userPaymentMethods: UserPaymentMethod[]
  subscriptions: Subscription[]
  hiddenWidgets?: DashboardWidgetId[]
  onBudgetsChange: (b: Budget[]) => void
  onRecurringSave: (items: RecurringTransaction[]) => void
  onApplyRecurring: (items: RecurringTransaction[]) => void
  onOpenCategoryModal: () => void
  onOpenPaymentMethodsModal: () => void
  onAddTransaction?: () => void
  onOpenWidgetSettings?: () => void
  onOpenHelp?: () => void
}

const ONBOARDED_KEY = 'hb_onboarded'

function calcNet(items: Transaction[]) {
  return items.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
}

function HealthArc({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setDisplayed(score)); return () => cancelAnimationFrame(id) }, [score])
  const arcLen = Math.PI * 55
  const fill = (displayed / 100) * arcLen
  const color = score >= 80 ? '#2ACF6A' : score >= 60 ? '#3D8EF8' : score >= 40 ? '#F5BE3A' : '#F25260'
  const label = score >= 80 ? '우수' : score >= 60 ? '양호' : score >= 40 ? '보통' : '주의'
  return (
    <div className="relative shrink-0" style={{ width: 130, height: 78 }}>
      <svg width={130} height={78} viewBox="0 0 130 78">
        <path d="M 10 68 A 55 55 0 0 1 120 68" fill="none" stroke="#2C2C2E" strokeWidth={11} strokeLinecap="round" />
        <path d="M 10 68 A 55 55 0 0 1 120 68" fill="none" stroke={color} strokeWidth={11} strokeLinecap="round"
          strokeDasharray={`${fill} ${arcLen}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.32, 0.72, 0, 1)' }} />
      </svg>
      <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
        <p className="text-[26px] font-black num leading-none" style={{ color }}>{Math.round(displayed)}</p>
        <p className="text-[9px] font-bold" style={{ color }}>{label}</p>
      </div>
    </div>
  )
}

function PaydayRing({ daysLeft }: { daysLeft: number }) {
  const [filled, setFilled] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setFilled(Math.max(0, 30 - daysLeft) / 30)
    })
    return () => cancelAnimationFrame(id)
  }, [daysLeft])
  const r = 26
  const circ = 2 * Math.PI * r
  const color = daysLeft === 0 ? '#F5BE3A' : daysLeft <= 3 ? '#F25260' : daysLeft <= 7 ? '#F5BE3A' : '#3D8EF8'
  return (
    <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
      <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="#2C2C2E" strokeWidth={5} />
        <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${filled * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.32, 0.72, 0, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {daysLeft === 0
          ? <span className="text-[18px]">🎉</span>
          : <>
              <p className="text-[15px] font-black num leading-none" style={{ color }}>{daysLeft}</p>
              <p className="text-[8px] text-[#4E5968] leading-none mt-0.5">일 후</p>
            </>
        }
      </div>
    </div>
  )
}

export default function Dashboard({ transactions, budgets, recurring, goals, settingsVersion, yearMonth, customExpenseCategories, userPaymentMethods, subscriptions, hiddenWidgets = [], onBudgetsChange, onRecurringSave, onApplyRecurring, onOpenCategoryModal, onOpenPaymentMethodsModal, onAddTransaction, onOpenWidgetSettings, onOpenHelp }: Props) {
  const hide = (id: DashboardWidgetId) => hiddenWidgets.includes(id)
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(ONBOARDED_KEY) !== 'true')
  const [showBudget, setShowBudget] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [payday, setPayday] = useState<number | 'last' | null>(null)
  const [cardBillingDay, setCardBillingDay] = useState<number | null>(null)
  const [editingPayday, setEditingPayday] = useState(false)
  const [paydayInput, setPaydayInput] = useState('')
  const [paydayError, setPaydayError] = useState('')
  const [budgetView, setBudgetView] = useState<'list' | 'gauge'>('list')
  const [showSpendingTop, setShowSpendingTop] = useState(false)
  const [focusedExpenseCategory, setFocusedExpenseCategory] = useState<string | null>(null)
  const [progressMounted, setProgressMounted] = useState(false)
  const spendingTopRef = useRef<HTMLDivElement | null>(null)
  const lastNotifiedMonthRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false

    void loadSettings().then((settings) => {
      if (!cancelled) {
        setPayday(settings.payday)
        setCardBillingDay(settings.cardBillingDay)
      }
    })

    return () => {
      cancelled = true
    }
  }, [settingsVersion])

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgressMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (transactions.length > 0) localStorage.setItem(ONBOARDED_KEY, 'true')
  }, [transactions.length])

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    setShowOnboarding(false)
  }

  function handleSavePayday() {
    if (paydayInput === 'last') {
      setPaydayError('')
      void (async () => {
        try {
          const current = await loadSettings()
          await saveSettings({ ...current, payday: 'last' })
          setPayday('last')
          setEditingPayday(false)
          showToast('월급날이 말일로 저장됐어요')
        } catch {
          showToast('월급날 저장에 실패했어요. 다시 시도해주세요.', 3000, 'error')
        }
      })()
      return
    }
    const val = parseInt(paydayInput, 10)
    if (isNaN(val) || val < 1 || val > 31) {
      setPaydayError('1~31 사이의 숫자를 입력하세요')
      return
    }
    setPaydayError('')
    void (async () => {
      try {
        const current = await loadSettings()
        await saveSettings({ ...current, payday: val })
        setPayday(val)
        setEditingPayday(false)
        showToast(`월급날이 ${val}일로 저장됐어요`)
      } catch {
        showToast('월급날 저장에 실패했어요. 다시 시도해주세요.', 3000, 'error')
      }
    })()
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
  const monthlyIncomeTx = useMemo(
    () => monthly.filter((t) => t.type === 'income'),
    [monthly]
  )
  const monthlyExpenseTx = useMemo(
    () => monthly.filter((t) => t.type === 'expense'),
    [monthly]
  )
  const income = useMemo(
    () => monthlyIncomeTx.reduce((s, t) => s + t.amount, 0),
    [monthlyIncomeTx]
  )
  const expense = useMemo(
    () => monthlyExpenseTx.reduce((s, t) => s + t.amount, 0),
    [monthlyExpenseTx]
  )
  const openingBalance = useMemo(
    () => calcNet(transactions.filter((t) => t.date < `${yearMonth}-01`)),
    [transactions, yearMonth]
  )
  const balance = openingBalance + (income - expense)
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null

  const animatedBalance = useCountUp(balance, 700)
  const animatedIncome = useCountUp(income, 600)
  const animatedExpense = useCountUp(expense, 600)

  const monthlyMethodBalance = useMemo(() => {
    let cashIncome = 0
    let cashExpense = 0
    let checkIncome = 0
    let checkExpense = 0
    let creditIncome = 0
    let creditExpense = 0
    let hasCash = false
    let hasCheck = false
    let hasCredit = false

    for (const t of monthly) {
      const method = t.paymentMethod ?? 'cash'
      const isIncome = t.type === 'income'
      const amount = t.amount

      if (method === 'cash') {
        hasCash = true
        if (isIncome) cashIncome += amount
        else cashExpense += amount
        continue
      }

      if (method === 'check') {
        hasCheck = true
        if (isIncome) checkIncome += amount
        else checkExpense += amount
        continue
      }

      if (isCreditPaymentMethod(method)) {
        hasCredit = true
        if (isIncome) creditIncome += amount
        else creditExpense += amount
      }
    }

    return {
      cash: cashIncome - cashExpense,
      check: checkIncome - checkExpense,
      credit: creditIncome - creditExpense,
      hasCash,
      hasCheck,
      hasCredit,
    }
  }, [monthly])

  const hasCreditTransactions = useMemo(
    () => transactions.some((t) => t.type === 'expense' && isCreditPaymentMethod(t.paymentMethod)),
    [transactions]
  )

  const creditCards = useMemo(
    () => userPaymentMethods.filter((m) => m.type === 'credit'),
    [userPaymentMethods]
  )

  const showCreditSection = hasCreditTransactions || creditCards.length > 0

  const effectiveBillingDay = useMemo(
    () => creditCards[0]?.billingDay ?? cardBillingDay ?? 25,
    [creditCards, cardBillingDay]
  )

  const monthlyCardDue = useMemo(
    () => calculateCardDueAmount(transactions, yearMonth, effectiveBillingDay),
    [transactions, yearMonth, effectiveBillingDay]
  )

  const nextStatementYM = useMemo(() => shiftYM(yearMonth, 1), [yearMonth])

  const nextMonthlyCardDue = useMemo(
    () => calculateCardDueAmount(transactions, nextStatementYM, effectiveBillingDay),
    [transactions, nextStatementYM, effectiveBillingDay]
  )

  const cardBillingRangeLabel = useMemo(() => {
    const range = getCardBillingRange(yearMonth, effectiveBillingDay)
    return formatBillingRange(range)
  }, [yearMonth, effectiveBillingDay])

  const nextCardBillingRangeLabel = useMemo(() => {
    const range = getCardBillingRange(nextStatementYM, effectiveBillingDay)
    return formatBillingRange(range)
  }, [nextStatementYM, effectiveBillingDay])

  const monthlyExpenseCategoryMap = useMemo(() => {
    const map: Record<string, number> = {}
    monthlyExpenseTx.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [monthlyExpenseTx])

  const expenseByCategory = useMemo(() => {
    return Object.entries(monthlyExpenseCategoryMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [monthlyExpenseCategoryMap])

  // 이번 달 미적용 정기 항목
  const pendingRecurring = useMemo(
    () => recurring.filter((r) => r.lastAppliedMonth !== yearMonth),
    [recurring, yearMonth]
  )

  // 이번 달에 적용되는 유효 예산 (월별 특화 > 전체 기본값)
  const effectiveBudgets = useMemo(() => {
    const monthSpecific = budgets.filter((b) => b.yearMonth === yearMonth)
    if (monthSpecific.length === 0) return budgets.filter((b) => !b.yearMonth)
    const covered = new Set(monthSpecific.map((b) => b.category))
    return [...monthSpecific, ...budgets.filter((b) => !b.yearMonth && !covered.has(b.category))]
  }, [budgets, yearMonth])

  // 이월 금액 계산 (전월 미사용 예산)
  const carryoverAmounts = useMemo(() => {
    const map: Record<string, number> = {}
    const [y, m] = yearMonth.split('-').map(Number)
    const prevYM = m === 1
      ? `${y - 1}-12`
      : `${y}-${String(m - 1).padStart(2, '0')}`
    for (const b of effectiveBudgets) {
      if (!b.carryover) continue
      const prevSpent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(prevYM))
        .reduce((s, t) => s + t.amount, 0)
      const unused = Math.max(0, b.limit - prevSpent)
      if (unused > 0) map[b.category] = unused
    }
    return map
  }, [effectiveBudgets, transactions, yearMonth])

  // 예산 초과/경고 카테고리 (이월 포함 유효 한도 기준)
  const { overBudget, nearBudget } = useMemo(() => {
    const over = effectiveBudgets.filter((b) => {
      const effectiveLimit = b.limit + (carryoverAmounts[b.category] ?? 0)
      return (monthlyExpenseCategoryMap[b.category] || 0) > effectiveLimit
    })
    const near = effectiveBudgets.filter((b) => {
      const effectiveLimit = b.limit + (carryoverAmounts[b.category] ?? 0)
      const pct = ((monthlyExpenseCategoryMap[b.category] || 0) / effectiveLimit) * 100
      return pct >= 80 && pct <= 100
    })
    return { overBudget: over, nearBudget: near }
  }, [effectiveBudgets, carryoverAmounts, monthlyExpenseCategoryMap])

  // 예산 초과 감지 및 알림
  useEffect(() => {
    const currentMonth = yearMonth

    // 월이 바뀌었으면 알림 표시
    if (currentMonth !== lastNotifiedMonthRef.current && overBudget.length > 0) {
      lastNotifiedMonthRef.current = currentMonth

      overBudget.forEach((budget) => {
        const spent = monthlyExpenseCategoryMap[budget.category] ?? 0

        showToast(
          `${budget.category} 예산을 초과했습니다\n지출: ${fmt(spent)} / 예산: ${fmt(budget.limit)}`,
          3000,
          'warning'
        )
      })
    }
  }, [yearMonth, overBudget, monthlyExpenseCategoryMap])

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

  // ── 순자산 계산 ────────────────────────────────────────────
  const netWorth = useMemo(() => {
    // 1) 전체 누적 잔액 (수입 - 지출 전체)
    const totalBalance = transactions.reduce(
      (s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0
    )

    // 2) 저축 목표 달성 금액 합계
    const goalsSaved = goals.reduce((s, g) => s + (g.currentAmount ?? 0), 0)

    return {
      totalBalance,
      goalsSaved,
      total: totalBalance,
      goalCount: goals.length,
    }
  }, [transactions, goals])

  // 월별 순자산 추이 (전체 거래 기준 누적) — 단일 패스로 6개 월말 잔액 계산
  const netWorthTrend = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const offset = i - 5
      const d = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
      return { label: `${d.getMonth() + 1}월`, endDate: toLocalDateStr(d) }
    })
    // 거래를 날짜순 정렬 후 누적 합산 (O(n log n + n))
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    let ti = 0
    return months.map(({ label, endDate }) => {
      while (ti < sorted.length && sorted[ti].date <= endDate) {
        cumulative += sorted[ti].type === 'income' ? sorted[ti].amount : -sorted[ti].amount
        ti++
      }
      return { label, value: cumulative }
    })
  }, [transactions])

  // 구독 다음 청구 예고 (7일 이내)
  const upcomingSubscriptions = useMemo(() => {
    if (!subscriptions.length) return []
    const today = new Date()
    const todayDay = today.getDate()
    return subscriptions
      .map((s) => {
        let daysLeft = s.billingDay - todayDay
        if (daysLeft < 0) {
          const lastDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()
          daysLeft = Math.min(s.billingDay, lastDayOfNextMonth) + (new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - todayDay)
        }
        return { ...s, daysLeft }
      })
      .filter((s) => s.daysLeft <= 7 && s.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [subscriptions])

  // 예산 게이지용 카테고리별 지출
  const spentByCategory = useMemo(() => {
    return monthlyExpenseCategoryMap
  }, [monthlyExpenseCategoryMap])

  // 소비 페이스 (이번 달만)
  const spendingPace = useMemo(() => {
    const today = new Date()
    const [y, m] = yearMonth.split('-').map(Number)
    if (today.getFullYear() !== y || today.getMonth() + 1 !== m || expense === 0) return null
    const daysInMonth = new Date(y, m, 0).getDate()
    const daysElapsed = Math.max(1, today.getDate())
    const timePct = Math.round((daysElapsed / daysInMonth) * 100)
    const projected = Math.round((expense / daysElapsed) * daysInMonth)
    const budgetTotal = budgets.reduce((s, b) => s + b.limit, 0)
    const spendPct = budgetTotal > 0 ? Math.round((expense / budgetTotal) * 100) : null
    const onTrack = spendPct === null || spendPct <= timePct + 10
    return { timePct, daysElapsed, daysInMonth, projected, budgetTotal, spendPct, onTrack }
  }, [yearMonth, expense, budgets])

  // 목표 달성을 위한 총 일일 저금 필요액
  const goalsDailyNeeded = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const incomplete = goals.filter(g => g.currentAmount < g.targetAmount && g.deadline)
    if (!incomplete.length) return null
    let total = 0
    for (const g of incomplete) {
      const target = parseYmdLocal(g.deadline!)
      const days = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86400000))
      total += Math.ceil((g.targetAmount - g.currentAmount) / days)
    }
    const nearest = incomplete.reduce((a, b) => parseYmdLocal(a.deadline!).getTime() < parseYmdLocal(b.deadline!).getTime() ? a : b)
    const nearestDays = Math.ceil((parseYmdLocal(nearest.deadline!).getTime() - today.getTime()) / 86400000)
    return { total, count: incomplete.length, nearest, nearestDays }
  }, [goals])

  // 무지출 일수 (이번 달)
  const noSpendDays = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
    const daysElapsed = isCurrentMonth ? today.getDate() : new Date(y, m, 0).getDate()
    const spendDates = new Set(monthlyExpenseTx.map(t => t.date.slice(8, 10)))
    return Math.max(0, daysElapsed - spendDates.size)
  }, [monthlyExpenseTx, yearMonth])

  // 연속 무지출 스트릭 (오늘 포함 연속 일수)
  const noSpendStreak = useMemo(() => {
    const today = new Date()
    const [y, m] = yearMonth.split('-').map(Number)
    if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return 0
    const spendDates = new Set(monthlyExpenseTx.map(t => t.date))
    let streak = 0
    const d = new Date(today)
    while (true) {
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!str.startsWith(yearMonth)) break
      if (spendDates.has(str)) break
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  }, [monthlyExpenseTx, yearMonth])

  // 재정 건강도 스코어 (0-100)
  const healthScore = useMemo(() => {
    let score = 0
    if (savingsRate !== null) score += Math.min(35, Math.round((Math.max(0, savingsRate) / 30) * 35))
    if (budgets.length > 0) {
      const ok = budgets.filter(b => !overBudget.find(o => o.category === b.category)).length
      score += Math.round((ok / budgets.length) * 30)
    } else { score += 15 }
    const [hy, hm] = yearMonth.split('-').map(Number)
    const hToday = new Date()
    const hElapsed = (hToday.getFullYear() === hy && hToday.getMonth() + 1 === hm) ? hToday.getDate() : new Date(hy, hm, 0).getDate()
    if (hElapsed > 0) score += Math.min(20, Math.round((noSpendDays / hElapsed) * 20))
    if (goals.length > 0) {
      const avg = goals.reduce((s, g) => s + Math.min(1, g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) / goals.length
      score += Math.round(avg * 15)
    }
    return Math.min(100, Math.max(0, score))
  }, [savingsRate, budgets, overBudget, noSpendDays, yearMonth, goals])

  // 시간대별 지출 패턴
  const timeOfDaySpending = useMemo(() => {
    const slots = [
      { label: '아침', emoji: '🌅', hours: new Set([6,7,8,9,10,11]), amount: 0 },
      { label: '낮', emoji: '☀️', hours: new Set([12,13,14,15,16,17]), amount: 0 },
      { label: '저녁', emoji: '🌆', hours: new Set([18,19,20,21]), amount: 0 },
      { label: '밤', emoji: '🌙', hours: new Set([22,23,0,1,2,3,4,5]), amount: 0 },
    ]
    monthlyExpenseTx.forEach(t => {
      const h = new Date(t.createdAt).getHours()
      for (const slot of slots) { if (slot.hours.has(h)) { slot.amount += t.amount; break } }
    })
    const max = Math.max(...slots.map(s => s.amount), 1)
    return slots.map(s => ({ ...s, pct: Math.round((s.amount / max) * 100) }))
  }, [monthlyExpenseTx])

  // 오늘 지출 요약
  const todaySpending = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const now = new Date()
    if (now.getFullYear() !== y || now.getMonth() + 1 !== m) return null
    const todayStr = toLocalDateStr(now)
    const yd = new Date(now); yd.setDate(now.getDate() - 1)
    const yesterdayStr = toLocalDateStr(yd)
    const todayExpenseTx = monthlyExpenseTx.filter(t => t.date === todayStr)
    const yesterdayExpenseTx = monthlyExpenseTx.filter(t => t.date === yesterdayStr)
    const todayIncomeTx = monthlyIncomeTx.filter(t => t.date === todayStr)
    const todayExpense = todayExpenseTx.reduce((s, t) => s + t.amount, 0)
    const yesterdayExpense = yesterdayExpenseTx.reduce((s, t) => s + t.amount, 0)
    const todayIncome = todayIncomeTx.reduce((s, t) => s + t.amount, 0)
    const recentTx = [...todayExpenseTx].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)
    return { todayExpense, yesterdayExpense, todayIncome, recentTx }
  }, [monthlyExpenseTx, monthlyIncomeTx, yearMonth])

  // 이달 최대 지출 거래 TOP3
  const top3Expenses = useMemo(() =>
    [...monthlyExpenseTx].sort((a, b) => b.amount - a.amount).slice(0, 3)
  , [monthlyExpenseTx])

  // 전월 카테고리별 지출 (예산 목록 비교용)
  const prevMonthCategorySpend = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const prevYM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const map: Record<string, number> = {}
    transactions.filter(t => t.type === 'expense' && t.date.startsWith(prevYM)).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [transactions, yearMonth])

  // 절약 성과 (전월 대비 20% 이상 && 1만원 이상 절약)
  const spendingSavings = useMemo(() => {
    const today = new Date()
    const [y, m] = yearMonth.split('-').map(Number)
    if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return []
    return Object.entries(spentByCategory)
      .map(([cat, amt]) => {
        const prev = prevMonthCategorySpend[cat] ?? 0
        if (prev === 0) return null
        const saved = prev - amt
        if (saved < 10_000) return null
        const pct = Math.round((saved / prev) * 100)
        if (pct < 20) return null
        return { category: cat, amount: amt, prev, saved, pct }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.saved - a.saved)
      .slice(0, 3)
  }, [spentByCategory, prevMonthCategorySpend, yearMonth])

  // 소비 이상 감지 (전월 대비 30% 이상 && 2만원 이상 급증)
  const spendingSpikes = useMemo(() => {
    return Object.entries(spentByCategory)
      .filter(([cat, amt]) => {
        const prev = prevMonthCategorySpend[cat] ?? 0
        if (prev === 0) return false
        const increase = amt - prev
        return increase > 0 && (increase / prev) * 100 > 30 && increase > 20_000
      })
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        prev: prevMonthCategorySpend[cat] ?? 0,
        pct: Math.round(((amt - (prevMonthCategorySpend[cat] ?? 0)) / (prevMonthCategorySpend[cat] ?? 0)) * 100),
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
  }, [spentByCategory, prevMonthCategorySpend])

  // 이번 주 vs 지난 주 지출 비교
  const weeklySpending = useMemo(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const startOfThisWeek = new Date(today)
    startOfThisWeek.setDate(today.getDate() - dayOfWeek)
    startOfThisWeek.setHours(0, 0, 0, 0)
    const endOfLastWeek = new Date(startOfThisWeek)
    endOfLastWeek.setDate(startOfThisWeek.getDate() - 1)
    const startOfLastWeek = new Date(endOfLastWeek)
    startOfLastWeek.setDate(endOfLastWeek.getDate() - 6)

    const toStr = (d: Date) => toLocalDateStr(d)
    const thisWeekStart = toStr(startOfThisWeek)
    const todayStr = toStr(today)
    const lastWeekStart = toStr(startOfLastWeek)
    const lastWeekEnd = toStr(endOfLastWeek)

    const thisWeek = transactions
      .filter(t => t.type === 'expense' && t.date >= thisWeekStart && t.date <= todayStr)
      .reduce((s, t) => s + t.amount, 0)
    const lastWeek = transactions
      .filter(t => t.type === 'expense' && t.date >= lastWeekStart && t.date <= lastWeekEnd)
      .reduce((s, t) => s + t.amount, 0)

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const thisWeekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfThisWeek)
      d.setDate(startOfThisWeek.getDate() + i)
      const dateStr = toStr(d)
      const isPast = dateStr <= todayStr
      const amount = isPast ? transactions
        .filter(t => t.type === 'expense' && t.date === dateStr)
        .reduce((s, t) => s + t.amount, 0) : null
      return { label: dayNames[i], dateStr, amount, isToday: dateStr === todayStr }
    })
    const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfLastWeek)
      d.setDate(startOfLastWeek.getDate() + i)
      const dateStr = toStr(d)
      const amount = transactions
        .filter(t => t.type === 'expense' && t.date === dateStr)
        .reduce((s, t) => s + t.amount, 0)
      return { label: dayNames[i], amount }
    })

    return { thisWeek, lastWeek, diff: thisWeek - lastWeek, dayOfWeek, thisWeekDays, lastWeekDays }
  }, [transactions])

  const monthCloseHelper = useMemo(() => {
    if (monthly.length === 0) return null

    const [y, m] = yearMonth.split('-').map(Number)
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m
    const daysInMonth = new Date(y, m, 0).getDate()
    const daysLeft = isCurrentMonth ? Math.max(0, daysInMonth - now.getDate()) : 0
    const topExpense = expenseByCategory[0] ?? null
    const topExpenses = expenseByCategory.slice(0, 3)
    const net = income - expense
    const cardDueTotal = monthlyCardDue + nextMonthlyCardDue
    const overBudgetTopCategory = overBudget[0]?.category ?? null
    const checklist = [
      {
        id: 'recurring',
        label: pendingRecurring.length > 0 ? `정기 항목 ${pendingRecurring.length}건 미등록` : '정기 항목 등록 완료',
        done: pendingRecurring.length === 0,
        actionLabel: pendingRecurring.length > 0 ? `${pendingRecurring.length}건 등록` : null,
      },
      {
        id: 'budget',
        label: overBudget.length > 0
          ? `예산 초과 ${overBudget.length}개 카테고리${overBudgetTopCategory ? ` · ${overBudgetTopCategory}` : ''}`
          : '예산 초과 없음',
        done: overBudget.length === 0,
        actionLabel: overBudget.length > 0 ? '예산 점검' : null,
      },
      {
        id: 'balance',
        label: net >= 0 ? '월 순잔액 흑자 유지 중' : '월 순잔액 적자 상태',
        done: net >= 0,
        actionLabel: net < 0 ? '지출 조정' : null,
      },
    ]

    return {
      isCurrentMonth,
      daysLeft,
      topExpense,
      topExpenses,
      net,
      cardDueTotal,
      checklist,
    }
  }, [
    monthly.length,
    yearMonth,
    expenseByCategory,
    income,
    expense,
    monthlyCardDue,
    nextMonthlyCardDue,
    pendingRecurring.length,
    overBudget,
  ])

  const focusedExpensePreview = useMemo(() => {
    if (!focusedExpenseCategory) return []
    return monthlyExpenseTx
      .filter((t) => t.category === focusedExpenseCategory)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3)
  }, [focusedExpenseCategory, monthlyExpenseTx])

  const focusedExpensePreviewTotal = useMemo(
    () => focusedExpensePreview.reduce((sum, tx) => sum + tx.amount, 0),
    [focusedExpensePreview]
  )

  function handleOpenSpendingFocus(category: string) {
    setFocusedExpenseCategory(category)
    if (budgets.length > 0) return
    requestAnimationFrame(() => {
      spendingTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  useEffect(() => {
    if (!focusedExpenseCategory) return
    const stillExists = monthlyExpenseTx.some((t) => t.category === focusedExpenseCategory)
    if (!stillExists) {
      setFocusedExpenseCategory(null)
    }
  }, [focusedExpenseCategory, monthlyExpenseTx])

  return (
    <div className="space-y-3 tab-content">
      {/* 온보딩 안내 */}
      {showOnboarding && transactions.length === 0 && (
        <div className="bg-gradient-to-br from-[#3D8EF8]/15 to-[#3D8EF8]/5 border border-[#3D8EF8]/25 rounded-2xl px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">👋</span>
              <p className="text-sm font-bold text-white">잔고플랜에 오신 걸 환영해요</p>
            </div>
            <button
              onClick={dismissOnboarding}
              aria-label="시작 안내 닫기"
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[#8B95A1] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-[#8B95A1] mt-1.5 leading-relaxed">
            내역을 추가하면 예산, 분석, 저축 목표 같은 기능이 바로 살아나요. 사용법이 궁금하면 도움말을 확인해보세요.
          </p>
          <div className="flex gap-2 mt-3">
            {onAddTransaction && (
              <button
                onClick={onAddTransaction}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#3D8EF8] text-white hover:bg-[#5AA0FF] transition-colors"
              >
                내역 추가
              </button>
            )}
            {onOpenHelp && (
              <button
                onClick={onOpenHelp}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-[#8B95A1] hover:text-white hover:bg-white/10 transition-colors"
              >
                도움말 보기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 예산 초과 알림 */}
      {overBudget.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[#F25260]/10 rounded-2xl border border-[#F25260]/20">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle size={16} className="text-[#F25260] shrink-0" />
            <p className="text-sm text-[#F25260] font-semibold truncate">
              {overBudget.map(b => b.category).join(', ')} 예산을 초과했어요
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBudget(true)}
            aria-label="예산 관리 열기"
            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F25260]/20 text-[#F25260] hover:bg-[#F25260]/30 transition-colors"
          >
            예산 관리
          </button>
        </div>
      )}

      {/* 예산 80% 경고 */}
      {nearBudget.length > 0 && overBudget.length === 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[#F5BE3A]/10 rounded-2xl border border-[#F5BE3A]/20">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle size={16} className="text-[#F5BE3A] shrink-0" />
            <p className="text-sm text-[#F5BE3A] font-semibold truncate">
              {nearBudget.map(b => b.category).join(', ')} 예산이 80% 이상 사용됐어요
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBudget(true)}
            aria-label="예산 관리 열기"
            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F5BE3A]/20 text-[#F5BE3A] hover:bg-[#F5BE3A]/30 transition-colors"
          >
            예산 관리
          </button>
        </div>
      )}

      {/* 구독 다음 청구 예고 */}
      {!hide('subscription-alert') && upcomingSubscriptions.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔔</span>
              <span className="text-sm font-bold text-white">이번 주 구독 청구</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-[#F5BE3A]/15 text-[#F5BE3A]">
                {upcomingSubscriptions.length}건
              </span>
            </div>
            <span className="text-xs font-bold num text-[#F25260]">
              {(() => {
                const krwSum = upcomingSubscriptions.filter(s => s.currency !== 'USD').reduce((sum, s) => sum + s.amount, 0)
                const usdSum = upcomingSubscriptions.filter(s => s.currency === 'USD').reduce((sum, s) => sum + s.amount, 0)
                const parts = []
                if (krwSum > 0) parts.push(`-${fmt(krwSum)}원`)
                if (usdSum > 0) parts.push(`-$${usdSum.toFixed(2)}`)
                return parts.join(' · ')
              })()}
            </span>
          </div>
          <div className="space-y-2">
            {upcomingSubscriptions.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 bg-[#2C2C2E]">
                  {CATEGORY_EMOJI[s.category] ?? '💳'}
                </div>
                <span className="text-sm text-[#F1F3F6] flex-1">{s.name}</span>
                <span className="text-xs text-[#4E5968]">
                  {s.daysLeft === 0 ? '오늘' : `${s.daysLeft}일 후`}
                </span>
                <span className="text-sm font-bold num text-[#F25260]">
                  -{fmtPrice(s.amount, s.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 소비 이상 감지 알림 */}
      {!hide('spending-spike') && spendingSpikes.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle size={14} className="text-[#F5BE3A] shrink-0" />
            <span className="text-sm font-bold text-white">소비 급증 감지</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-[#F5BE3A]/15 text-[#F5BE3A]">
              {spendingSpikes.length}개 카테고리
            </span>
          </div>
          <div className="space-y-2">
            {spendingSpikes.map((spike) => (
              <div key={spike.category} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 bg-[#2C2C2E]">
                  {CATEGORY_EMOJI[spike.category] ?? '📊'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#F1F3F6]">{spike.category}</span>
                  <span className="text-[10px] text-[#4E5968] ml-2">전월 {fmt(spike.prev)}원</span>
                </div>
                <span className="text-xs font-bold text-[#F25260] shrink-0">▲{spike.pct}%</span>
                <span className="text-sm font-bold num text-white shrink-0">{fmt(spike.amount)}원</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 절약 성과 */}
      {!hide('spending-savings') && spendingSavings.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-sm">✨</span>
            <span className="text-sm font-bold text-white">절약 성과</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-[#2ACF6A]/15 text-[#2ACF6A]">
              전달 대비
            </span>
          </div>
          <div className="space-y-2">
            {spendingSavings.map(item => (
              <div key={item.category} className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[item.category]?.bg ?? 'rgba(42,207,106,0.1)' }}
                >
                  {CATEGORY_EMOJI[item.category] ?? '💰'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#F1F3F6]">{item.category}</span>
                  <span className="text-[10px] text-[#4E5968] ml-2">전월 {fmt(item.prev)}원</span>
                </div>
                <span className="text-xs font-bold text-[#2ACF6A] shrink-0">▼{item.pct}%</span>
                <span className="text-sm font-bold num text-[#2ACF6A] shrink-0">-{fmt(item.saved)}원</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hide('month-close-helper') && monthCloseHelper && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5 border border-[rgba(61,142,248,0.18)]">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🧾</span>
              <span className="text-sm font-bold text-white">월 마감 도우미</span>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold ${monthCloseHelper.isCurrentMonth ? 'bg-[#3D8EF8]/20 text-[#79B2FF]' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}>
              {monthCloseHelper.isCurrentMonth ? `마감까지 ${monthCloseHelper.daysLeft}일` : '선택 월 요약'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#2C2C2E] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-[#8B95A1]">월 수입/지출</p>
              <p className="text-[11px] font-bold text-white num mt-0.5">+{fmt(income)} / -{fmt(expense)}</p>
            </div>
            <div className="bg-[#2C2C2E] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-[#8B95A1]">순잔액</p>
              <p className={`text-[11px] font-bold num mt-0.5 ${monthCloseHelper.net >= 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                {monthCloseHelper.net >= 0 ? '+' : ''}{fmt(monthCloseHelper.net)}
              </p>
            </div>
            <div className="bg-[#2C2C2E] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-[#8B95A1]">카드 예정</p>
              <p className="text-[11px] font-bold text-[#F5BE3A] num mt-0.5">{fmt(monthCloseHelper.cardDueTotal)}</p>
            </div>
          </div>

          {monthCloseHelper.topExpense && (
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-[#2C2C2E] flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#8B95A1]">최대 지출 카테고리</span>
              <span className="text-[12px] font-bold text-white">
                {CATEGORY_EMOJI[monthCloseHelper.topExpense[0]] ?? '📦'} {monthCloseHelper.topExpense[0]} · {fmt(monthCloseHelper.topExpense[1])}원
              </span>
            </div>
          )}

          <div className="mt-2.5 grid grid-cols-1 gap-1.5">
            {monthCloseHelper.checklist.map((item) => (
              <div key={item.id} className="px-3 py-2 rounded-xl bg-[#2C2C2E] flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold ${item.done ? 'text-[#8B95A1]' : 'text-[#F5F7FA]'}`}>
                  {item.done ? '✅' : '⚠️'} {item.label}
                </span>
                {!item.done && item.id === 'recurring' && (
                  <button
                    onClick={() => onApplyRecurring(pendingRecurring)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-[#3D8EF8]/20 text-[#79B2FF] font-bold"
                  >
                    {item.actionLabel}
                  </button>
                )}
                {!item.done && item.id === 'budget' && (
                  <button
                    onClick={() => setShowBudget(true)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-[#F25260]/20 text-[#FF8D98] font-bold"
                  >
                    {item.actionLabel}
                  </button>
                )}
                {!item.done && item.id === 'balance' && (
                  <button
                    onClick={() => setShowBudget(true)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-[#F5BE3A]/20 text-[#F5BE3A] font-bold"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>

          {monthCloseHelper.net < 0 && monthCloseHelper.topExpenses.length > 0 && (
            <div className="mt-2.5 px-3 py-2.5 rounded-xl bg-[#2C2C2E] border border-[#F25260]/20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] text-[#F5BE3A] font-bold">적자 원인 빠른 점검</span>
                <span className="text-[10px] text-[#8B95A1]">지출 상위 3개</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {monthCloseHelper.topExpenses.map(([category, amount]) => (
                  <button
                    key={category}
                    onClick={() => handleOpenSpendingFocus(category)}
                    className="px-2.5 py-1 rounded-lg bg-[#F25260]/12 text-[#FF9AA4] hover:bg-[#F25260]/20 text-[10px] font-bold transition-colors"
                  >
                    {CATEGORY_EMOJI[category] ?? '📦'} {category} · {fmtShort(amount)}
                  </button>
                ))}
              </div>

              {focusedExpenseCategory && (
                <div className="mt-2 rounded-xl bg-[#1C1C1E] border border-white/8 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] text-[#9CC7FF] font-bold">
                      {CATEGORY_EMOJI[focusedExpenseCategory] ?? '📦'} {focusedExpenseCategory} 최근 거래
                    </span>
                    <button
                      onClick={() => setFocusedExpenseCategory(null)}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#2C2C2E] text-[#8B95A1] font-bold"
                    >
                      닫기
                    </button>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-[#8B95A1]">최근 {focusedExpensePreview.length}건 합계</span>
                    <span className="text-[#FF8D98] font-bold num">-{fmt(focusedExpensePreviewTotal)}원</span>
                  </div>

                  {focusedExpensePreview.length > 0 ? (
                    <div className="space-y-1.5">
                      {focusedExpensePreview.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-[#8B95A1] truncate">{tx.description || tx.category}</span>
                          <span className="text-[#4E5968] shrink-0">{tx.date.slice(5)}</span>
                          <span className="text-[#FF8D98] font-bold num shrink-0">-{fmt(tx.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#8B95A1]">최근 거래가 없어요.</p>
                  )}

                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => setShowBudget(true)}
                      className="flex-1 text-[10px] px-2 py-1 rounded-md bg-[#F25260]/20 text-[#FF9AA4] font-bold"
                    >
                      예산 점검
                    </button>
                    <button
                      onClick={() => {
                        if (budgets.length > 0) {
                          showToast('예산 점검 화면에서 카테고리별 한도를 먼저 확인해보세요.')
                          setShowBudget(true)
                          return
                        }
                        setShowSpendingTop(true)
                        requestAnimationFrame(() => {
                          spendingTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        })
                      }}
                      className="flex-1 text-[10px] px-2 py-1 rounded-md bg-[#3D8EF8]/20 text-[#79B2FF] font-bold"
                    >
                      지출 TOP 보기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 정기 지출 미적용 알림 */}
      {!hide('recurring-pending') && pendingRecurring.length > 0 && (
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
          {(() => {
            const ri = pendingRecurring.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
            const re = pendingRecurring.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
            return (
              <div className="flex items-center gap-2 mb-3 text-[11px]">
                {ri > 0 && <span className="text-[#2ACF6A] font-semibold">+{fmt(ri)}원 수입</span>}
                {ri > 0 && re > 0 && <span className="text-[#4E5968]">·</span>}
                {re > 0 && <span className="text-[#F25260] font-semibold">-{fmt(re)}원 지출</span>}
                <span className="text-[#4E5968] ml-auto num">{ri > re ? `잔액 +${fmt(ri - re)}` : ri > 0 && re > 0 ? `잔액 -${fmt(re - ri)}` : ''}</span>
              </div>
            )
          })()}
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
      <div className="rounded-2xl p-6 bg-[#1C1C1E] border border-[rgba(255,255,255,0.06)] card-enter" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-[#8B95A1]">이번 달 잔액</p>
          {onOpenWidgetSettings && (
            <button
              onClick={onOpenWidgetSettings}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2C2C2E] text-[#4E5968] hover:text-[#8B95A1] transition-colors"
              aria-label="위젯 설정"
            >
              <SlidersHorizontal size={13} />
            </button>
          )}
          {noSpendStreak >= 2 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5BE3A]/15 text-[#F5BE3A]">
              🔥 {noSpendStreak}일 연속 무지출
            </span>
          ) : noSpendDays > 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2ACF6A]/15 text-[#2ACF6A]">
              🎯 무지출 {noSpendDays}일
            </span>
          ) : null}
        </div>
        <p className={`text-[40px] font-black leading-tight num tracking-tight ${balance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
          {animatedBalance < 0 ? '-' : ''}{fmt(Math.abs(animatedBalance))}
          <span className="text-[20px] font-bold ml-1 text-[#8B95A1]">원</span>
        </p>

        <div className="mt-5 pt-4 border-t border-white/[0.07] grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2ACF6A]/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-[#2ACF6A]" />
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1]">수입</p>
              <p className="text-sm font-bold text-[#2ACF6A] num">+{fmt(animatedIncome)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F25260]/10 flex items-center justify-center">
              <TrendingDown size={14} className="text-[#F25260]" />
            </div>
            <div>
              <p className="text-[11px] text-[#8B95A1]">지출</p>
              <p className="text-sm font-bold text-[#F25260] num">-{fmt(animatedExpense)}</p>
            </div>
          </div>
        </div>

        {income > 0 && (
          <div className="mt-4">
            <div className="h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: progressMounted ? `${Math.min((expense / income) * 100, 100)}%` : '0%',
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

        {expenseByCategory.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {expenseByCategory.slice(0, 3).map(([cat, amt]) => {
              const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              const emoji = CATEGORY_EMOJI[cat] ?? '💸'
              const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0
              const budget = budgets.find((b) => b.category === cat)
              const budgetPct = budget && budget.limit > 0 ? Math.round((amt / budget.limit) * 100) : null
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-[11px] shrink-0 w-16 truncate text-[#8B95A1]">{emoji} {cat}</span>
                  <div className="flex-1 h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`, minWidth: pct > 0 ? '4px' : undefined, backgroundColor: color.text }} />
                  </div>
                  {budgetPct !== null ? (
                    <span className={`text-[10px] font-bold num shrink-0 px-1.5 py-0.5 rounded-md ${budgetPct > 100 ? 'bg-[#F25260]/15 text-[#F25260]' : 'bg-white/6 text-[#4E5968]'}`}>
                      {budgetPct}%
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold num text-[#4E5968] w-7 text-right shrink-0">{pct}%</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {(monthlyMethodBalance.hasCash || monthlyMethodBalance.hasCheck || monthlyMethodBalance.hasCredit) && (
          <div className={`mt-4 grid gap-2 ${[monthlyMethodBalance.hasCash, monthlyMethodBalance.hasCheck, monthlyMethodBalance.hasCredit].filter(Boolean).length === 1 ? 'grid-cols-1' : [monthlyMethodBalance.hasCash, monthlyMethodBalance.hasCheck, monthlyMethodBalance.hasCredit].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {monthlyMethodBalance.hasCash && (
              <div className="rounded-2xl px-3 py-2.5 border border-[#2ACF6A]/25 bg-linear-to-br from-[#2ACF6A]/14 to-[#2C2C2E]">
                <p className="text-[10px] text-[#A8EEC4] font-semibold mb-1">💵 현금 잔액</p>
                <p className={`text-[13px] font-extrabold num ${monthlyMethodBalance.cash >= 0 ? 'text-[#D8FFE8]' : 'text-[#F25260]'}`}>
                  {monthlyMethodBalance.cash >= 0 ? '+' : ''}{fmt(monthlyMethodBalance.cash)}
                </p>
              </div>
            )}
            {monthlyMethodBalance.hasCheck && (
              <div className="rounded-2xl px-3 py-2.5 border border-[#6AD3C0]/25 bg-linear-to-br from-[#6AD3C0]/14 to-[#2C2C2E]">
                <p className="text-[10px] text-[#92E6D9] font-semibold mb-1">💳 체크 잔액</p>
                <p className={`text-[13px] font-extrabold num ${monthlyMethodBalance.check >= 0 ? 'text-[#D7FFF7]' : 'text-[#F25260]'}`}>
                  {monthlyMethodBalance.check >= 0 ? '+' : ''}{fmt(monthlyMethodBalance.check)}
                </p>
              </div>
            )}
            {monthlyMethodBalance.hasCredit && (
              <div className="rounded-2xl px-3 py-2.5 border border-[#3D8EF8]/25 bg-linear-to-br from-[#3D8EF8]/14 to-[#2C2C2E]">
                <p className="text-[10px] text-[#9CC7FF] font-semibold mb-1">💎 신용 잔액</p>
                <p className={`text-[13px] font-extrabold num ${monthlyMethodBalance.credit >= 0 ? 'text-[#DCEBFF]' : 'text-[#F25260]'}`}>
                  {monthlyMethodBalance.credit >= 0 ? '+' : ''}{fmt(monthlyMethodBalance.credit)}
                </p>
              </div>
            )}
          </div>
        )}

        {showCreditSection ? (
          <div className="mt-2 rounded-2xl px-3 py-2.5 border border-[#3D8EF8]/20 bg-[#3D8EF8]/10">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] text-[#9CC7FF] font-semibold">신용 결제예정</p>
              <div className="flex items-center gap-2">
                {creditCards.length > 0 && (
                  <span className="text-[10px] text-[#9CC7FF]">
                    {creditCards.length === 1
                      ? `${creditCards[0].label} · ${effectiveBillingDay}일`
                      : `${creditCards.length}개 카드 · ${effectiveBillingDay}일 기준`}
                  </span>
                )}
                <button
                  onClick={onOpenPaymentMethodsModal}
                  className="text-[10px] font-bold text-[#9CC7FF] hover:text-white transition-colors"
                >
                  설정
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="rounded-xl bg-[#2C2C2E] px-2.5 py-2">
                <p className="text-[10px] text-[#F5BE3A] font-semibold">이번 청구</p>
                <p className="text-[13px] font-extrabold text-[#DCEBFF] num">{fmt(monthlyCardDue)}원</p>
                <p className="text-[10px] text-[#8B95A1] mt-0.5">{cardBillingRangeLabel}</p>
              </div>
              <div className="rounded-xl bg-[#2C2C2E] px-2.5 py-2">
                <p className="text-[10px] text-[#79B2FF] font-semibold">다음 청구</p>
                <p className="text-[13px] font-extrabold text-[#DCEBFF] num">{fmt(nextMonthlyCardDue)}원</p>
                <p className="text-[10px] text-[#8B95A1] mt-0.5">{nextCardBillingRangeLabel}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 6개월 스파크라인 요약 */}
      {!hide('sparkline-summary') && <div className="flex gap-2">
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
      </div>}

      {/* 오늘 지출 카드 */}
      {!hide('today-spending') && todaySpending && (todaySpending.todayExpense === 0 && todaySpending.todayIncome === 0 ? (
        noSpendStreak >= 1 && (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-[#2ACF6A]/10 rounded-2xl border border-[#2ACF6A]/20">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-sm font-bold text-[#2ACF6A]">오늘 무지출!</p>
              <p className="text-[11px] text-[#4E5968]">
                {noSpendStreak >= 2 ? `🔥 ${noSpendStreak}일 연속 무지출 스트릭` : '좋은 시작이에요, 계속 유지해보세요'}
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">오늘 지출</p>
            {todaySpending.yesterdayExpense > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${todaySpending.todayExpense > todaySpending.yesterdayExpense ? 'bg-[#F25260]/15 text-[#F25260]' : todaySpending.todayExpense < todaySpending.yesterdayExpense ? 'bg-[#2ACF6A]/15 text-[#2ACF6A]' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}>
                {todaySpending.todayExpense > todaySpending.yesterdayExpense ? '▲' : todaySpending.todayExpense < todaySpending.yesterdayExpense ? '▼' : '='} 어제 대비 {todaySpending.todayExpense !== todaySpending.yesterdayExpense ? `${fmtShort(Math.abs(todaySpending.todayExpense - todaySpending.yesterdayExpense))}원` : '동일'}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <p className="text-[26px] font-black num text-[#F25260] leading-none">
              -{fmtShort(todaySpending.todayExpense)}
            </p>
            <span className="text-sm text-[#4E5968] font-semibold">원</span>
            {todaySpending.todayIncome > 0 && (
              <span className="text-sm font-bold text-[#2ACF6A] num ml-1">+{fmtShort(todaySpending.todayIncome)}</span>
            )}
          </div>
          {todaySpending.recentTx.length > 0 && (
            <div className="space-y-2 pt-2.5 border-t border-white/5">
              {todaySpending.recentTx.map(t => {
                const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                return (
                  <div key={t.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: color.bg }}>
                      {CATEGORY_EMOJI[t.category] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white leading-none truncate">{t.description || t.category}</p>
                      {t.description && <p className="text-[10px] text-[#4E5968] mt-0.5">{t.category}</p>}
                    </div>
                    <span className="text-[13px] font-bold num text-[#F25260] shrink-0">-{fmt(t.amount)}원</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* 재정 건강도 */}
      {!hide('health-score') && income > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl p-5 card-enter" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold text-white">재정 건강도</p>
            <span className="text-[10px] text-[#4E5968]">이번 달 기준</span>
          </div>
          <div className="flex items-center gap-4">
            <HealthArc score={healthScore} />
            <div className="flex-1 space-y-2">
              {[
                { label: '저축률', value: `${savingsRate ?? 0}%`, color: (savingsRate ?? 0) >= 20 ? '#2ACF6A' : (savingsRate ?? 0) >= 10 ? '#F5BE3A' : '#F25260' },
                { label: '예산 준수', value: budgets.length > 0 ? `${budgets.length - overBudget.length}/${budgets.length}` : '-', color: budgets.length > 0 && overBudget.length === 0 ? '#2ACF6A' : overBudget.length > budgets.length / 2 ? '#F25260' : '#F5BE3A' },
                { label: '무지출 일', value: `${noSpendDays}일`, color: noSpendDays >= 10 ? '#2ACF6A' : noSpendDays >= 5 ? '#F5BE3A' : '#8B95A1' },
                { label: '목표 달성', value: goals.length > 0 ? `${goals.filter(g => g.currentAmount >= g.targetAmount).length}/${goals.length}` : '-', color: goals.length > 0 && goals.every(g => g.currentAmount >= g.targetAmount) ? '#2ACF6A' : '#8B95A1' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-[#4E5968]">{label}</span>
                  </div>
                  <span className="text-[11px] font-bold num" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 소비 페이스 인디케이터 */}
      {!hide('spending-pace') && spendingPace && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">소비 페이스</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${spendingPace.onTrack ? 'bg-[#2ACF6A]/15 text-[#2ACF6A]' : 'bg-[#F25260]/15 text-[#F25260]'}`}>
              {spendingPace.onTrack ? '✓ 정상' : '⚡ 초과'}
            </span>
          </div>
          {/* 듀얼 트랙 레이스 */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#3D8EF8] font-semibold w-7 shrink-0">시간</span>
              <div className="relative flex-1 h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#3D8EF8] transition-all duration-700" style={{ width: `${spendingPace.timePct}%` }} />
              </div>
              <span className="text-[9px] text-[#3D8EF8] font-bold num w-6 text-right shrink-0">{spendingPace.timePct}%</span>
            </div>
            {spendingPace.spendPct !== null && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold w-7 shrink-0" style={{ color: spendingPace.onTrack ? '#2ACF6A' : '#F25260' }}>지출</span>
                <div className="relative flex-1 h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(spendingPace.spendPct, 100)}%`, backgroundColor: spendingPace.onTrack ? '#2ACF6A' : '#F25260' }} />
                  {/* today marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${spendingPace.timePct}%` }} />
                </div>
                <span className="text-[9px] font-bold num w-6 text-right shrink-0" style={{ color: spendingPace.onTrack ? '#2ACF6A' : '#F25260' }}>{spendingPace.spendPct}%</span>
              </div>
            )}
          </div>
          {spendingPace.spendPct !== null && (() => {
            const delta = spendingPace.spendPct - spendingPace.timePct
            if (Math.abs(delta) < 3) return null
            return (
              <p className="text-[10px] mb-3" style={{ color: delta > 0 ? '#F25260' : '#2ACF6A' }}>
                {delta > 0 ? `⚡ 예상보다 ${delta}% 빠르게 소비 중` : `✓ 예상보다 ${Math.abs(delta)}% 느리게 소비 중`}
              </p>
            )
          })()}
          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/5">
            <div>
              <p className="text-[10px] text-[#4E5968]">월말 예상 지출</p>
              <p className={`text-sm font-bold num ${spendingPace.onTrack ? 'text-[#F1F3F6]' : 'text-[#F25260]'}`}>{fmt(spendingPace.projected)}원</p>
            </div>
            {income > 0 && (() => {
              const projBalance = income - spendingPace.projected
              return (
                <div className="text-right">
                  <p className="text-[10px] text-[#4E5968]">월말 예상 잔고</p>
                  <p className={`text-sm font-bold num ${projBalance >= 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>{projBalance >= 0 ? '+' : ''}{fmt(projBalance)}원</p>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* 이번 주 vs 지난 주 지출 비교 */}
      {!hide('weekly-comparison') && (weeklySpending.thisWeek > 0 || weeklySpending.lastWeek > 0) && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">주간 지출</p>
            {weeklySpending.lastWeek > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${weeklySpending.diff > 0 ? 'bg-[#F25260]/15 text-[#F25260]' : weeklySpending.diff < 0 ? 'bg-[#2ACF6A]/15 text-[#2ACF6A]' : 'bg-[#2C2C2E] text-[#8B95A1]'}`}>
                {weeklySpending.diff > 0 ? '▲' : weeklySpending.diff < 0 ? '▼' : '='} {weeklySpending.diff !== 0 ? `${fmt(Math.abs(weeklySpending.diff))}원` : '동일'}
              </span>
            )}
          </div>
          {/* 요일별 미니 바 차트 */}
          {(() => {
            const maxAmt = Math.max(
              ...weeklySpending.thisWeekDays.map(d => d.amount ?? 0),
              ...weeklySpending.lastWeekDays.map(d => d.amount),
              1
            )
            return (
              <div className="grid grid-cols-7 gap-1 mb-3">
                {weeklySpending.thisWeekDays.map((day, i) => {
                  const lastAmt = weeklySpending.lastWeekDays[i].amount
                  const thisH = day.amount !== null && day.amount > 0 ? Math.max(6, Math.round((day.amount / maxAmt) * 52)) : 0
                  const lastH = lastAmt > 0 ? Math.max(4, Math.round((lastAmt / maxAmt) * 52)) : 0
                  const isUnavailable = day.amount === null
                  return (
                    <div key={day.label} className="flex flex-col items-center gap-1">
                      <div className="relative flex flex-col justify-end" style={{ height: 52 }}>
                        {lastH > 0 && (
                          <div className="absolute bottom-0 inset-x-0 rounded-t-sm bg-[#4E5968]/35"
                            style={{ height: lastH }} />
                        )}
                        {thisH > 0 && (
                          <div className="absolute bottom-0 inset-x-0 rounded-t-sm"
                            style={{
                              height: thisH,
                              backgroundColor: day.isToday ? '#3D8EF8' : '#F25260',
                              opacity: day.isToday ? 1 : 0.75,
                            }} />
                        )}
                        {!isUnavailable && day.amount === 0 && !lastH && (
                          <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-[#2C2C2E]" />
                        )}
                      </div>
                      <span className={`text-[9px] font-bold ${day.isToday ? 'text-[#3D8EF8]' : isUnavailable ? 'text-[#2C2C2E]' : 'text-[#4E5968]'}`}>{day.label}</span>
                      <span className="text-[8px] num text-[#4E5968]">
                        {day.amount !== null && day.amount > 0 ? fmtShort(day.amount) : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          {/* 주간 합계 비교 */}
          <div className="flex gap-3 pt-2.5 border-t border-white/5">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-sm bg-[#F25260]" />
                <p className="text-[10px] text-[#8B95A1]">이번 주</p>
              </div>
              <p className="text-sm font-bold text-white num">{fmt(weeklySpending.thisWeek)}<span className="text-[10px] text-[#4E5968] ml-0.5">원</span></p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-sm bg-[#4E5968]/50" />
                <p className="text-[10px] text-[#8B95A1]">지난 주</p>
              </div>
              <p className="text-sm font-bold text-[#8B95A1] num">{fmt(weeklySpending.lastWeek)}<span className="text-[10px] text-[#4E5968] ml-0.5">원</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#4E5968]">{['일', '월', '화', '수', '목', '금', '토'][weeklySpending.dayOfWeek]}요일 기준</p>
            </div>
          </div>
        </div>
      )}

      {/* 시간대별 지출 패턴 */}
      {!hide('timeofday-spending') && expense > 0 && timeOfDaySpending.some(s => s.amount > 0) && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide">시간대별 지출</p>
            {(() => {
              const peak = timeOfDaySpending.reduce((a, b) => b.amount > a.amount ? b : a, timeOfDaySpending[0])
              if (!peak.amount) return null
              return (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3D8EF8]/15 text-[#3D8EF8]">
                  {peak.emoji} {peak.label} 피크
                </span>
              )
            })()}
          </div>
          {(() => {
            const peakAmt = Math.max(...timeOfDaySpending.map(s => s.amount))
            return (
          <div className="flex gap-2">
            {timeOfDaySpending.map(slot => {
              const isPeak = slot.amount > 0 && slot.amount === peakAmt
              return (
              <div key={slot.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 44 }}>
                  <div
                    className="w-full rounded-t-md transition-all duration-700"
                    style={{
                      height: slot.amount > 0 ? `${Math.max(8, slot.pct)}%` : '4%',
                      backgroundColor: isPeak ? '#3D8EF8' : slot.amount > 0 ? '#3D8EF8' : '#2C2C2E',
                      opacity: isPeak ? 1 : slot.amount > 0 ? 0.4 + (slot.pct / 100) * 0.35 : 1,
                      boxShadow: isPeak ? '0 0 8px rgba(61,142,248,0.6)' : 'none',
                    }}
                  />
                </div>
                <span className="text-sm leading-none">{slot.emoji}</span>
                <span className="text-[9px] text-[#4E5968]">{slot.label}</span>
                {slot.amount > 0
                  ? <span className="text-[9px] font-bold num text-[#F25260]">-{fmtShort(slot.amount)}</span>
                  : <span className="text-[9px] text-[#2C2C2E]">-</span>}
              </div>
            )
            })}
          </div>
          )
          })()}
        </div>
      )}

      {/* 이달 최대 지출 TOP3 */}
      {!hide('top3-expenses') && top3Expenses.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <p className="text-[11px] font-semibold text-[#4E5968] uppercase tracking-wide mb-3">이달 최대 지출</p>
          <div className="space-y-2.5">
            {top3Expenses.map((t, i) => {
              const color = CATEGORY_COLOR[t.category] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              const maxAmt = top3Expenses[0].amount
              const barPct = maxAmt > 0 ? (t.amount / maxAmt) * 100 : 0
              return (
                <div key={t.id} className="list-item-enter" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-bold text-[#4E5968] w-3 shrink-0">{i + 1}</span>
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-sm" style={{ backgroundColor: color.bg }}>
                      {CATEGORY_EMOJI[t.category] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white leading-none">{t.category}</p>
                      {t.description && <p className="text-[10px] text-[#4E5968] truncate mt-0.5">{t.description}</p>}
                    </div>
                    <span className="text-[13px] font-bold num text-[#F25260] shrink-0">{fmt(t.amount)}원</span>
                  </div>
                  <div className="h-0.5 bg-[#2C2C2E] rounded-full overflow-hidden ml-6">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: progressMounted ? `${barPct}%` : '0%', backgroundColor: color.text }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 월급날 카운트다운 */}
      {!hide('payday-countdown') && !payday && !editingPayday && (
        <button
          onClick={() => { setEditingPayday(true); setPaydayInput('') }}
          className="w-full flex items-center gap-2 justify-center py-3 rounded-2xl border border-dashed border-white/10 text-xs font-semibold text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
        >
          💰 월급날 설정하기
        </button>
      )}

      {!hide('payday-countdown') && editingPayday && (
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

      {!hide('payday-countdown') && payday && !editingPayday && paydayInfo && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <PaydayRing daysLeft={paydayInfo.daysLeft} />
              <div>
                <span className="text-sm font-bold text-white">
                  {paydayInfo.daysLeft === 0
                    ? '오늘이 월급날이에요!'
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
                {budgetView === 'list' ? <><Gauge size={12} /><span>게이지</span></> : <><LayoutList size={12} /><span>목록</span></>}
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
              onClick={onOpenPaymentMethodsModal}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C2C2E] text-[#8B95A1] hover:text-white hover:bg-[#3A3A3C] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              💳 결제수단
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
            {effectiveBudgets.length > 0 && (
              <button
                onClick={() => {
                  const [y, m] = yearMonth.split('-').map(Number)
                  const nextYM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
                  const filtered = budgets.filter((b) => b.yearMonth !== nextYM)
                  const nextMonthBudgets = effectiveBudgets.map((b) => ({ ...b, yearMonth: nextYM }))
                  onBudgetsChange([...filtered, ...nextMonthBudgets])
                  showToast(`${nextYM} 예산이 복사됐어요`, 2000, 'success')
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3D8EF8]/15 text-[#3D8EF8] hover:bg-[#3D8EF8]/25 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                다음달 복사
              </button>
            )}
          </div>
        </div>

        {budgets.length === 0 ? (
          <button
            onClick={() => setShowBudget(true)}
            className="w-full py-4 rounded-2xl border border-dashed border-white/10 text-sm text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20 transition-colors"
          >
            + 카테고리별 예산을 설정해보세요
          </button>
        ) : (() => {
          const totalBudget = effectiveBudgets.reduce((s, b) => s + b.limit + (carryoverAmounts[b.category] ?? 0), 0)
          const totalSpent = effectiveBudgets.reduce((s, b) => s + (spentByCategory[b.category] ?? 0), 0)
          const totalRemaining = Math.max(0, totalBudget - totalSpent)
          const totalPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
          const isOver = totalSpent > totalBudget
          return (
            <>
              {totalBudget > 0 && (
                <div className="mb-4 p-3 rounded-2xl bg-[#2C2C2E]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-[#4E5968]">전체 예산</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] num text-white font-bold">{fmt(totalSpent)}</span>
                      <span className="text-[10px] text-[#4E5968]">/ {fmt(totalBudget)}원</span>
                      {!isOver && totalRemaining > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[#2ACF6A]/15 text-[#2ACF6A]">
                          {fmt(totalRemaining)}원 남음
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#1C1C1E] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progressMounted ? totalPct : 0}%`, backgroundColor: isOver ? '#F25260' : totalPct >= 80 ? '#F5BE3A' : '#3D8EF8' }} />
                  </div>
                </div>
              )}
              {budgetView === 'gauge' ? (
          /* 게이지 뷰 */
          <div className="grid grid-cols-3 gap-4">
            {[...EXPENSE_CATEGORIES, ...customExpenseCategories].filter(cat => effectiveBudgets.find(b => b.category === cat)).map((cat) => {
              const budget = effectiveBudgets.find((b) => b.category === cat)!
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
            {[...EXPENSE_CATEGORIES, ...customExpenseCategories].filter(cat => effectiveBudgets.find(b => b.category === cat)).map((cat, catIdx) => {
              const budget = effectiveBudgets.find((b) => b.category === cat)!
              const spent = monthly
                .filter((t) => t.type === 'expense' && t.category === cat)
                .reduce((s, t) => s + t.amount, 0)
              const carryover = carryoverAmounts[cat] ?? 0
              const effectiveLimit = budget.limit + carryover
              const pct = Math.min((spent / effectiveLimit) * 100, 100)
              const isOver = spent > effectiveLimit
              const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
              return (
                <div key={cat} className="list-item-enter" style={{ animationDelay: `${catIdx * 35}ms` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                      <span className="text-sm font-semibold text-white">{cat}</span>
                      {carryover > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#3D8EF8]/15 text-[#3D8EF8]">
                          +이월 {fmtShort(carryover)}
                        </span>
                      )}
                      {(() => {
                        const prev = prevMonthCategorySpend[cat] ?? 0
                        if (!prev || !spent) return null
                        const diff = Math.round(((spent - prev) / prev) * 100)
                        if (Math.abs(diff) < 5) return null
                        return (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${diff > 0 ? 'bg-[#F25260]/15 text-[#F25260]' : 'bg-[#2ACF6A]/15 text-[#2ACF6A]'}`}>
                            {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}%
                          </span>
                        )
                      })()}
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
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: progressMounted ? `${pct}%` : '0%',
                        backgroundColor: isOver ? '#F25260' : color.text,
                      }}
                    />
                  </div>
                  {!isOver && (() => {
                    const today = new Date()
                    const [y, mo] = yearMonth.split('-').map(Number)
                    if (today.getFullYear() !== y || today.getMonth() + 1 !== mo || spent === 0) return null
                    const elapsed = today.getDate()
                    const dailyRate = spent / elapsed
                    const remaining = effectiveLimit - spent
                    const daysUntilOut = Math.ceil(remaining / dailyRate)
                    const daysLeft = new Date(y, mo, 0).getDate() - elapsed
                    if (daysUntilOut > daysLeft + 3) return null
                    const urgency = daysUntilOut <= 3 ? 'text-[#F25260]' : 'text-[#F5BE3A]'
                    return <p className={`text-[9px] ${urgency} mt-0.5 text-right`}>{daysUntilOut <= 0 ? '곧 소진' : `${daysUntilOut}일 후 소진 예정`}</p>
                  })()}
                </div>
              )
            })}
          </div>
        )}
            </>
          )
        })()}
      </div>

      {/* 카테고리별 지출 */}
      {expenseByCategory.length > 0 && budgets.length === 0 && (
        <div ref={spendingTopRef} className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowSpendingTop(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <p className="text-[15px] font-bold text-white">이번 달 지출 TOP</p>
            {showSpendingTop ? <ChevronUp size={16} className="text-[#4E5968]" /> : <ChevronDown size={16} className="text-[#4E5968]" />}
          </button>
          {showSpendingTop && (
            <div className="px-5 pb-5 space-y-3">
              {expenseByCategory.map(([cat, amt]) => {
                const color = CATEGORY_COLOR[cat] ?? { bg: 'rgba(139,149,161,0.12)', text: '#8B95A1' }
                const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0
                const prevAmt = prevMonthCategorySpend[cat] ?? 0
                const trendPct = prevAmt > 0 ? Math.round(((amt - prevAmt) / prevAmt) * 100) : null
                const isFocused = focusedExpenseCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFocusedExpenseCategory((prev) => (prev === cat ? null : cat))}
                    className={`w-full flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${isFocused ? 'bg-[#3D8EF8]/12 ring-1 ring-[#3D8EF8]/30' : 'hover:bg-white/3'}`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: color.bg }}
                    >
                      {CATEGORY_EMOJI[cat] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-white">{cat}</span>
                          {trendPct !== null && Math.abs(trendPct) >= 5 && (
                            <span className={`text-[9px] font-bold ${trendPct > 0 ? 'text-[#F25260]' : 'text-[#2ACF6A]'}`}>
                              {trendPct > 0 ? '▲' : '▼'}{Math.abs(trendPct)}%
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-white num">{fmt(amt)}원</span>
                      </div>
                      <div className="h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: progressMounted ? `${pct}%` : '0%', backgroundColor: color.text }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs w-7 text-right shrink-0 ${isFocused ? 'text-[#9CC7FF] font-bold' : 'text-[#4E5968]'}`}>{pct}%</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 순자산 카드 */}
      {!hide('net-worth') && transactions.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-3xl px-5 py-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <PieChart size={14} className="text-[#3D8EF8]" />
            <span className="text-[13px] font-bold text-[#8B95A1]">순자산 현황</span>
          </div>
          <div className="flex items-end gap-2 mb-2.5">
            <p className={`text-[22px] font-extrabold num tracking-tight ${netWorth.total >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
              {netWorth.total >= 0 ? '' : '-'}{fmt(Math.abs(netWorth.total))}<span className="text-sm font-medium text-[#4E5968] ml-1">원</span>
            </p>
            {(() => {
              const delta = netWorthTrend[5].value - netWorthTrend[4].value
              if (delta === 0 || netWorthTrend[4].value === 0) return null
              const color = delta >= 0 ? '#2ACF6A' : '#F25260'
              return (
                <span className="text-[11px] font-bold num mb-1 px-1.5 py-0.5 rounded-lg" style={{ color, backgroundColor: `${color}22` }}>
                  {delta >= 0 ? '+' : ''}{fmtShort(delta)}
                </span>
              )
            })()}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#2C2C2E] rounded-2xl px-3 py-2.5">
              <p className="text-[10px] text-[#4E5968] font-semibold mb-1">누적 잔액</p>
              <p className={`text-[13px] font-extrabold num ${netWorth.totalBalance >= 0 ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                {netWorth.totalBalance >= 0 ? '+' : ''}{fmtShort(netWorth.totalBalance)}
              </p>
            </div>
            <div className="bg-[#2C2C2E] rounded-2xl px-3 py-2.5">
              <p className="text-[10px] text-[#4E5968] font-semibold mb-1">저축 목표</p>
              <p className="text-[13px] font-extrabold text-[#3D8EF8] num">
                {netWorth.goalsSaved > 0 ? fmtShort(netWorth.goalsSaved) : '-'}
              </p>
              {netWorth.goalCount > 0 && (
                <p className="text-[9px] text-[#4E5968] mt-0.5">{netWorth.goalCount}개 목표</p>
              )}
            </div>
          </div>
          {netWorthTrend.some(d => d.value !== 0) && (
            <div className="mt-3">
              <p className="text-[10px] text-[#4E5968] font-semibold mb-1.5">6개월 추이</p>
              <ResponsiveContainer width="100%" height={56}>
                <LineChart data={netWorthTrend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#4E5968' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#2C2C2E', border: 'none', borderRadius: 10, fontSize: 11, color: '#F1F3F6' }}
                    formatter={(v) => [fmtShort(Number(v ?? 0)) + '원', '순자산']}
                    labelStyle={{ color: '#8B95A1' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3D8EF8" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#3D8EF8' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 목표 일일 저금 필요액 */}
      {!hide('goal-daily-needed') && goalsDailyNeeded && (
        <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3.5 flex items-center gap-3">
          <span className="text-2xl">{goalsDailyNeeded.nearest.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[11px] text-[#4E5968]">목표 {goalsDailyNeeded.count}개 달성하려면</p>
              {goalsDailyNeeded.nearestDays <= 30 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${goalsDailyNeeded.nearestDays <= 7 ? 'bg-[#F25260]/15 text-[#F25260]' : 'bg-[#F5BE3A]/15 text-[#F5BE3A]'}`}>
                  D-{goalsDailyNeeded.nearestDays}
                </span>
              )}
            </div>
            <p className="text-[15px] font-bold text-white">하루 <span className="text-[#3D8EF8] num">{fmt(goalsDailyNeeded.total)}원</span> 저금 필요</p>
            {goalsDailyNeeded.count === 1 && <p className="text-[10px] text-[#4E5968] mt-0.5 truncate">{goalsDailyNeeded.nearest.name}</p>}
          </div>
        </div>
      )}

      {monthly.length === 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl card-enter">
          <EmptyState
            emoji="💸"
            title="이번 달 내역이 없어요"
            description="내역 추가 버튼으로 첫 내역을 입력해보세요"
            action={onAddTransaction ? { label: '내역 추가', onClick: onAddTransaction } : undefined}
          >
            <div className="flex justify-center gap-3 mt-5">
              {['식비', '교통비', '급여'].map(cat => (
                <div key={cat} className="px-2.5 py-1.5 bg-[#2C2C2E] rounded-xl text-[11px] text-[#4E5968]">
                  {CATEGORY_EMOJI[cat]} {cat}
                </div>
              ))}
            </div>
          </EmptyState>
        </div>
      )}

      {showBudget && (
        <BudgetModal
          budgets={effectiveBudgets.map((b) => ({ ...b, yearMonth: undefined }))}
          customExpenseCategories={customExpenseCategories}
          onSave={(newBudgets) => {
            // 다른 월 특화 예산은 보존, 전체 기본 예산만 교체
            const otherMonthSpecific = budgets.filter((b) => b.yearMonth && b.yearMonth !== yearMonth)
            onBudgetsChange([...otherMonthSpecific, ...newBudgets])
          }}
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
