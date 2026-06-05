import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronLeft, ChevronRight, Hash } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import type { Budget, Transaction, UserPaymentMethod } from '../types'
import { CATEGORY_EMOJI } from '../types'
import SpendingAnalysisView from './SpendingAnalysisView'
import { useMonthlyData } from '../lib/useMonthlyData'
import { fmt as fmtFull, fmtShort as fmt, parseYmdLocal } from '../lib/format'
import TrendAreaChart from './charts/TrendAreaChart'
import WeekdayBarChart from './charts/WeekdayBarChart'
import DonutChart from './charts/DonutChart'
import YearlyBarChart from './charts/YearlyBarChart'
import CumulativeLineChart from './charts/CumulativeLineChart'
import CashflowChart from './charts/CashflowChart'
import BudgetCompareChart from './charts/BudgetCompareChart'
import { calculateCardDueAmount, formatBillingRange, getCardBillingRange, isCreditPaymentMethod, shiftYM } from '../lib/cardBilling'
import { loadSettings } from '../lib/storage'

interface Props {
  transactions: Transaction[]
  yearMonth: string
  budgets: Budget[]
  settingsVersion: number
  userPaymentMethods?: UserPaymentMethod[]
}

function getYM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토']

type ViewMode = 'monthly' | 'yearly' | 'cashflow' | 'tags' | 'reduce' | 'budget'

export default function Analytics({ transactions, yearMonth, budgets, settingsVersion, userPaymentMethods = [] }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [pmTab, setPmTab] = useState<'balance' | 'compare' | 'trend' | 'billing'>('balance')
  const [showMonthlyDetail, setShowMonthlyDetail] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [cardBillingDay, setCardBillingDay] = useState<number>(25)
  const [progressMounted, setProgressMounted] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)

  useEffect(() => {
    if (userPaymentMethods.length > 0) {
      const firstCredit = userPaymentMethods.find((m) => m.type === 'credit')
      if (firstCredit?.billingDay) {
        setCardBillingDay(firstCredit.billingDay)
        return
      }
    }

    let cancelled = false
    void loadSettings().then((settings) => {
      if (!cancelled) setCardBillingDay(settings.cardBillingDay ?? 25)
    })
    return () => { cancelled = true }
  }, [settingsVersion, userPaymentMethods])

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgressMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

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

  // ── 연간 카테고리별 지출 TOP5 ─────────────────────────
  const yearlyCategoryData = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type === 'expense' && t.date.startsWith(String(selectedYear)))
      .forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? Math.round((amt / total) * 100) : 0 }))
  }, [transactions, selectedYear])

  // ── 이번 달 거래 (공유 memoized 배열) ──────────────────
  const currentMonthly = useMemo(
    () => transactions.filter((t) => t.date.startsWith(yearMonth)),
    [transactions, yearMonth]
  )
  const currentExpense = useMemo(
    () => currentMonthly.filter((t) => t.type === 'expense'),
    [currentMonthly]
  )
  const currentIncome = useMemo(
    () => currentMonthly.filter((t) => t.type === 'income'),
    [currentMonthly]
  )

  // ── 이번 달 카테고리별 지출 ────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    currentExpense.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? Math.round((amt / total) * 100) : 0 }))
  }, [currentExpense])

  // ── 수입 소스 분석 ────────────────────────────────────
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    currentIncome.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? Math.round((amt / total) * 100) : 0 }))
  }, [currentIncome])

  // ── 전월 대비 카테고리 지출 비교 ────────────────────────
  const categoryMomComparison = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const prevYM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const prevMonthly = transactions.filter((t) => t.date.startsWith(prevYM) && t.type === 'expense')
    const prevMap: Record<string, number> = {}
    prevMonthly.forEach((t) => { prevMap[t.category] = (prevMap[t.category] || 0) + t.amount })

    const currMap: Record<string, number> = {}
    currentExpense.forEach((t) => {
      currMap[t.category] = (currMap[t.category] || 0) + t.amount
    })

    const cats = Array.from(new Set([...Object.keys(currMap), ...Object.keys(prevMap)]))
    return cats
      .map((cat) => ({ cat, curr: currMap[cat] ?? 0, prev: prevMap[cat] ?? 0 }))
      .filter((d) => d.curr > 0 || d.prev > 0)
      .sort((a, b) => b.curr - a.curr)
      .slice(0, 6)
  }, [transactions, yearMonth, currentExpense])

  // ── 소비 이상 감지 (전 3개월 평균 대비 1.5배 초과) ──────
  const anomalyCategories = useMemo(() => {
    const past3 = monthlyData.slice(2, 5)
    const avgMap: Record<string, number> = {}
    for (const m of past3) {
      transactions.filter(t => t.type === 'expense' && t.date.startsWith(m.ym)).forEach(t => {
        avgMap[t.category] = (avgMap[t.category] || 0) + t.amount
      })
    }
    Object.keys(avgMap).forEach(k => { avgMap[k] = avgMap[k] / 3 })
    return expenseByCategory
      .filter(({ cat, amt }) => {
        const avg = avgMap[cat]
        return avg && avg > 0 && amt > avg * 1.5 && amt > 10000
      })
      .map(({ cat, amt }) => ({ cat, amt, avg: Math.round(avgMap[cat]), ratio: Math.round((amt / avgMap[cat]) * 100) }))
  }, [expenseByCategory, monthlyData, transactions])

  // ── 일별 지출 히트맵 ──────────────────────────────────
  const dayHeatmapData = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const startDow = new Date(y, m - 1, 1).getDay()
    const dailyExpense: Record<number, number> = {}
    currentExpense.forEach((t) => {
      const day = parseInt(t.date.slice(8, 10))
      dailyExpense[day] = (dailyExpense[day] || 0) + t.amount
    })
    const maxAmt = Math.max(...Object.values(dailyExpense), 1)
    const today = new Date()
    const todayDate = (today.getFullYear() === y && today.getMonth() + 1 === m) ? today.getDate() : null
    const cells: { day: number | null; amt: number; intensity: number; isToday: boolean }[] = []
    for (let i = 0; i < startDow; i++) cells.push({ day: null, amt: 0, intensity: 0, isToday: false })
    for (let d = 1; d <= daysInMonth; d++) {
      const amt = dailyExpense[d] || 0
      cells.push({ day: d, amt, intensity: amt > 0 ? Math.min(1, amt / maxAmt) : 0, isToday: d === todayDate })
    }
    return cells
  }, [currentExpense, yearMonth])

  // ── 요일별 소비 패턴 (이번 달) ────────────────────────
  const weekdayData = useMemo(() => {
    const totals = Array(7).fill(0)
    const counts = Array(7).fill(0)
    currentExpense.forEach((t) => {
      const dow = parseYmdLocal(t.date).getDay()
      totals[dow] += t.amount
      counts[dow]++
    })
    return WEEKDAYS_SHORT.map((label, i) => ({
      label,
      total: totals[i],
      count: counts[i],
    }))
  }, [currentExpense])

  const topWeekday = weekdayData.reduce((max, d) => d.total > max.total ? d : max, weekdayData[0])

  const paymentMethodStats = useMemo(() => {
    // 단일 패스로 6개 집계
    let cashIncome = 0, cashExpense = 0, checkIncome = 0, checkExpense = 0, creditIncome = 0, creditExpense = 0
    currentMonthly.forEach((t) => {
      const isCredit = isCreditPaymentMethod(t.paymentMethod)
      const pm = isCredit ? 'credit' : (t.paymentMethod ?? 'cash')
      const amt = t.amount
      if (pm === 'cash') { t.type === 'income' ? (cashIncome += amt) : (cashExpense += amt) }
      else if (pm === 'check') { t.type === 'income' ? (checkIncome += amt) : (checkExpense += amt) }
      else { t.type === 'income' ? (creditIncome += amt) : (creditExpense += amt) }
    })

    const methodCompareData = [
      { label: '현금', income: cashIncome, expense: cashExpense },
      { label: '체크', income: checkIncome, expense: checkExpense },
      { label: '신용', income: creditIncome, expense: creditExpense },
    ]

    const nextStatementYM = shiftYM(yearMonth, 1)

    return {
      cash: { income: cashIncome, expense: cashExpense, net: cashIncome - cashExpense },
      check: { income: checkIncome, expense: checkExpense, net: checkIncome - checkExpense },
      credit: { income: creditIncome, expense: creditExpense, net: creditIncome - creditExpense },
      methodCompareData,
      cardDue: calculateCardDueAmount(transactions, yearMonth, cardBillingDay),
      nextCardDue: calculateCardDueAmount(transactions, nextStatementYM, cardBillingDay),
      cardBillingRangeLabel: formatBillingRange(getCardBillingRange(yearMonth, cardBillingDay)),
      nextCardBillingRangeLabel: formatBillingRange(getCardBillingRange(nextStatementYM, cardBillingDay)),
    }
  }, [currentMonthly, transactions, yearMonth, cardBillingDay])


  const paymentMethodTrend = useMemo(
    () => monthlyData.map((m) => {
      const monthTx = transactions.filter((t) => t.date.startsWith(m.ym))
      const cashExpense = monthTx
        .filter((t) => t.type === 'expense' && (t.paymentMethod ?? 'cash') === 'cash')
        .reduce((s, t) => s + t.amount, 0)
      const checkExpense = monthTx
        .filter((t) => t.type === 'expense' && (t.paymentMethod ?? 'cash') === 'check')
        .reduce((s, t) => s + t.amount, 0)
      const creditExpense = monthTx
        .filter((t) => t.type === 'expense' && isCreditPaymentMethod(t.paymentMethod))
        .reduce((s, t) => s + t.amount, 0)

      return {
        label: m.label,
        cashExpense,
        checkExpense,
        creditExpense,
      }
    }),
    [monthlyData, transactions]
  )

  const cardStatementDueHistory = useMemo(
    () => monthlyData.map((m) => ({
      label: m.label,
      due: calculateCardDueAmount(transactions, m.ym, cardBillingDay),
    })),
    [monthlyData, transactions, cardBillingDay]
  )

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

    const topUp = categoryMomComparison.filter(d => d.prev > 0 && d.curr > d.prev * 1.3)
      .sort((a, b) => (b.curr - b.prev) / b.prev - (a.curr - a.prev) / a.prev)[0]
    if (topUp) {
      const pct = Math.round(((topUp.curr - topUp.prev) / topUp.prev) * 100)
      list.push({ icon: '⚠️', text: `${topUp.cat} 지출이 전월보다 ${pct}% 증가했어요`, color: '#F5BE3A' })
    }

    const topDown = categoryMomComparison.filter(d => d.prev > 0 && d.curr < d.prev * 0.7)
      .sort((a, b) => (b.prev - b.curr) / b.prev - (a.prev - a.curr) / a.prev)[0]
    if (topDown) {
      const pct = Math.round(((topDown.prev - topDown.curr) / topDown.prev) * 100)
      list.push({ icon: '👍', text: `${topDown.cat}을(를) 전월보다 ${pct}% 절약했어요`, color: '#2ACF6A' })
    }

    if (current.expense > current.income && current.income > 0) {
      list.push({ icon: '🚨', text: `이번 달 지출이 수입을 초과했어요`, color: '#F25260' })
    }

    // 주말 vs 평일 지출 비교
    const expTx = currentMonthly.filter(t => t.type === 'expense')
    if (expTx.length >= 4) {
      const weekend = expTx.filter(t => { const d = parseYmdLocal(t.date).getDay(); return d === 0 || d === 6 }).reduce((s, t) => s + t.amount, 0)
      const weekday = expTx.filter(t => { const d = parseYmdLocal(t.date).getDay(); return d >= 1 && d <= 5 }).reduce((s, t) => s + t.amount, 0)
      if (weekend > 0 && weekday > 0) {
        const weekendAvg = weekend / 2
        const weekdayAvg = weekday / 5
        if (weekendAvg > weekdayAvg * 1.5) list.push({ icon: '🛍️', text: `주말 하루 평균 지출이 평일보다 ${Math.round((weekendAvg / weekdayAvg - 1) * 100)}% 높아요`, color: '#F5BE3A' })
      }
    }

    return list.slice(0, 5)
  }, [expenseDiff, incomeDiff, expenseByCategory, current, topWeekday, categoryMomComparison, currentMonthly])

  // ── 태그 탭 데이터 ────────────────────────────────────────────
  const tagData = useMemo(() => {
    const map = new Map<string, { expense: number; income: number; count: number }>()
    currentMonthly.forEach((t) => {
      const tags = t.tags ?? []
      tags.forEach((tag) => {
        const cur = map.get(tag) ?? { expense: 0, income: 0, count: 0 }
        if (t.type === 'expense') cur.expense += t.amount
        else cur.income += t.amount
        cur.count += 1
        map.set(tag, cur)
      })
    })
    return Array.from(map.entries())
      .map(([tag, stat]) => ({ tag, ...stat, net: stat.income - stat.expense }))
      .sort((a, b) => b.expense - a.expense)
  }, [currentMonthly])

  // 태그별 월간 트렌드 (최근 6개월, 상위 3 태그)
  const tagTrend = useMemo(() => {
    const topTags = tagData.slice(0, 3).map((t) => t.tag)
    if (topTags.length === 0) return []
    return monthlyData.map((m) => {
      const monthTxs = transactions.filter((t) => t.date.startsWith(m.ym))
      const entry: Record<string, number | string> = { label: m.label }
      topTags.forEach((tag) => {
        entry[tag] = monthTxs
          .filter((t) => t.type === 'expense' && (t.tags ?? []).includes(tag))
          .reduce((s, t) => s + t.amount, 0)
      })
      return entry
    })
  }, [tagData, monthlyData, transactions])

  const topTagColors = ['#3D8EF8', '#F5BE3A', '#2ACF6A']

  // ── 전월 동기간(MTD) 비교 ─────────────────────────────
  const mtdComparison = useMemo(() => {
    const now = new Date()
    const [y, m] = yearMonth.split('-').map(Number)
    const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m
    const dayOfMonth = isCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate()
    const todayDayStr = String(dayOfMonth).padStart(2, '0')
    const cutoffThis = `${yearMonth}-${todayDayStr}`

    const prevY = m === 1 ? y - 1 : y
    const prevM = m === 1 ? 12 : m - 1
    const prevYM = `${prevY}-${String(prevM).padStart(2, '0')}`
    const cutoffPrev = `${prevYM}-${todayDayStr}`

    const thisMTD = transactions.filter(t => t.type === 'expense' && t.date.startsWith(yearMonth) && t.date <= cutoffThis)
      .reduce((s, t) => s + t.amount, 0)
    const prevMTD = transactions.filter(t => t.type === 'expense' && t.date.startsWith(prevYM) && t.date <= cutoffPrev)
      .reduce((s, t) => s + t.amount, 0)
    const diff = prevMTD > 0 ? Math.round(((thisMTD - prevMTD) / prevMTD) * 100) : null

    const thisMTDIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(yearMonth) && t.date <= cutoffThis)
      .reduce((s, t) => s + t.amount, 0)
    const prevMTDIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(prevYM) && t.date <= cutoffPrev)
      .reduce((s, t) => s + t.amount, 0)

    return { thisMTD, prevMTD, diff, thisMTDIncome, prevMTDIncome, dayOfMonth, isCurrentMonth }
  }, [transactions, yearMonth])

  // ── 캐시플로 탭 best/worst 월 ────────────────────────
  const cashflowStats = useMemo(() => {
    const withData = monthlyData.filter(m => m.income > 0 || m.expense > 0)
    if (withData.length === 0) return null
    const best = withData.reduce((a, b) => b.balance > a.balance ? b : a)
    const worst = withData.reduce((a, b) => b.balance < a.balance ? b : a)
    return { best, worst }
  }, [monthlyData])

  const TAB_LABELS: Record<ViewMode, string> = {
    monthly: '월간',
    yearly: '연간',
    cashflow: '플로우',
    tags: '태그',
    reduce: '절감',
    budget: '예산',
  }

  return (
    <div className="space-y-3 tab-content">
      {/* 탭 토글 */}
      <div className="bg-[#1C1C1E] rounded-2xl p-1 flex overflow-x-auto scrollbar-none gap-0.5">
        {(['monthly', 'yearly', 'cashflow', 'tags', 'reduce', 'budget'] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`flex-shrink-0 flex-1 min-w-[52px] py-2.5 rounded-xl text-[13px] font-bold transition-all ${
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
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-[#F5BE3A]" />
              <p className="text-[15px] font-bold text-white">이번 달 인사이트</p>
            </div>
            {insights.length === 0 ? (
              <p className="text-sm text-[#4E5968] text-center py-4">내역을 더 추가하면 분석을 보여드려요</p>
            ) : (
              <div className="space-y-2.5">
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-[#2C2C2E] rounded-2xl px-4 py-3 list-item-enter border-l-[3px] overflow-hidden"
                    style={{ borderColor: ins.color, animationDelay: `${i * 55}ms` }}
                  >
                    <span className="text-xl shrink-0">{ins.icon}</span>
                    <p className="text-sm font-medium" style={{ color: ins.color }}>{ins.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 이달 소비 요약 통계 */}
          {current.expense > 0 && (() => {
            const expTx = currentMonthly.filter(t => t.type === 'expense')
            const txCount = expTx.length
            const uniqueDays = new Set(expTx.map(t => t.date)).size
            const [y, m] = yearMonth.split('-').map(Number)
            const today = new Date()
            const elapsed = (today.getFullYear() === y && today.getMonth() + 1 === m) ? today.getDate() : new Date(y, m, 0).getDate()
            const dailyAvg = elapsed > 0 ? Math.round(current.expense / elapsed) : 0
            const maxTx = expTx.reduce((a, b) => b.amount > a.amount ? b : a, expTx[0])
            return (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '거래 건수', value: `${txCount}건`, color: '#F1F3F6' },
                  { label: '지출 일수', value: `${uniqueDays}일`, color: '#F25260' },
                  { label: '일평균', value: `${fmt(dailyAvg)}`, color: '#F5BE3A' },
                  { label: '최대 단건', value: `${fmt(maxTx.amount)}`, color: '#9B7EFF' },
                ].map(s => (
                  <div key={s.label} className="bg-[#1C1C1E] rounded-2xl px-2.5 py-3 text-center">
                    <p className="text-[9px] text-[#4E5968] mb-1 leading-tight">{s.label}</p>
                    <p className="text-[13px] font-bold num leading-none" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* 전월 동기간 비교 */}
          {(mtdComparison.thisMTD > 0 || mtdComparison.prevMTD > 0) && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[15px] font-bold text-white">전월 동기간 비교</p>
                <span className="text-[10px] text-[#4E5968]">{mtdComparison.dayOfMonth}일까지 기준</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-[#8B95A1] mb-1.5">이달 지출</p>
                  <p className="text-[18px] font-black text-[#F25260] num leading-none">{fmt(mtdComparison.thisMTD)}</p>
                  <p className="text-[10px] text-[#4E5968] mt-1">원</p>
                </div>
                <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-[#8B95A1] mb-1.5">전달 동기간</p>
                  <p className="text-[18px] font-black text-[#4E5968] num leading-none">{fmt(mtdComparison.prevMTD)}</p>
                  <p className="text-[10px] text-[#4E5968] mt-1">원</p>
                </div>
              </div>
              {mtdComparison.diff !== null && (
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl ${mtdComparison.diff > 0 ? 'bg-[#F25260]/10 border border-[#F25260]/20' : mtdComparison.diff < 0 ? 'bg-[#2ACF6A]/10 border border-[#2ACF6A]/20' : 'bg-[#2C2C2E]'}`}>
                  <span className="text-lg">{mtdComparison.diff > 0 ? '📈' : mtdComparison.diff < 0 ? '📉' : '✅'}</span>
                  <p className="text-sm font-semibold" style={{ color: mtdComparison.diff > 0 ? '#F25260' : mtdComparison.diff < 0 ? '#2ACF6A' : '#8B95A1' }}>
                    {mtdComparison.diff > 0 ? `전달보다 ${mtdComparison.diff}% 더 썼어요` : mtdComparison.diff < 0 ? `전달보다 ${Math.abs(mtdComparison.diff)}% 절약 중!` : '전달과 동일한 페이스예요'}
                  </p>
                  {mtdComparison.diff !== 0 && (
                    <span className="ml-auto text-[11px] font-bold num" style={{ color: mtdComparison.diff > 0 ? '#F25260' : '#2ACF6A' }}>
                      {mtdComparison.diff > 0 ? '+' : ''}{fmt(mtdComparison.thisMTD - mtdComparison.prevMTD)}원
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 전월 대비 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">전월 대비</p>
            <div className="grid grid-cols-2 gap-3">
              <CompareCard label="수입" current={current.income} prev={prev.income} diff={incomeDiff} isIncome />
              <CompareCard label="지출" current={current.expense} prev={prev.expense} diff={expenseDiff} isIncome={false} />
            </div>
          </div>

          {/* 수입 소스 분석 */}
          {incomeByCategory.length > 0 && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-3">수입 소스</p>
              <div className="space-y-2.5">
                {incomeByCategory.map(({ cat, amt, pct }) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-base shrink-0">{CATEGORY_EMOJI[cat] ?? '💰'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-[12px] font-semibold text-white">{cat}</span>
                        <span className="text-[12px] font-bold num text-[#2ACF6A]">{fmt(amt)}원</span>
                      </div>
                      <div className="h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#2ACF6A] transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#4E5968] w-7 text-right shrink-0">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6개월 저축률 트렌드 */}
          {monthlyData.some(m => m.income > 0) && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-4">저축률 추이</p>
              <div className="flex items-end gap-1.5 h-20">
                {monthlyData.map((m) => {
                  const rate = m.income > 0 ? Math.max(0, Math.round(((m.income - m.expense) / m.income) * 100)) : null
                  const isCurrent = m.ym === yearMonth
                  return (
                    <div key={m.ym} className="flex-1 flex flex-col items-center gap-1">
                      {rate !== null ? (
                        <div className="w-full flex flex-col justify-end" style={{ height: 64 }}>
                          <div
                            className="w-full rounded-t-md transition-all duration-700"
                            style={{
                              height: `${Math.max(4, rate)}%`,
                              backgroundColor: isCurrent ? '#3D8EF8' : rate >= 20 ? '#2ACF6A' : rate >= 10 ? '#F5BE3A' : '#F25260',
                              opacity: isCurrent ? 1 : 0.55,
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ height: 64 }} className="w-full flex items-end">
                          <div className="w-full h-1 rounded-t-md bg-[#2C2C2E]" />
                        </div>
                      )}
                      <span className={`text-[9px] font-bold ${isCurrent ? 'text-[#3D8EF8]' : 'text-[#4E5968]'}`}>{m.label}</span>
                      <span className={`text-[9px] num ${rate !== null ? (isCurrent ? 'text-white' : 'text-[#8B95A1]') : 'text-[#2C2C2E]'}`}>
                        {rate !== null ? `${rate}%` : '-'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#2ACF6A]" /><span className="text-[10px] text-[#4E5968]">20%+</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#F5BE3A]" /><span className="text-[10px] text-[#4E5968]">10-20%</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#F25260]" /><span className="text-[10px] text-[#4E5968]">10% 미만</span></div>
              </div>
            </div>
          )}

          {/* 6개월 트렌드 차트 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
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
            <div className="mt-4 pt-4 border-t border-white/6 space-y-2">
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

          {/* 상세 분석 토글 */}
          <button
            onClick={() => setShowMonthlyDetail(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#1C1C1E] text-[#8B95A1] hover:text-white text-xs font-bold transition-colors"
          >
            {showMonthlyDetail ? '요약 보기 ↑' : '상세 분석 보기 ↓'}
          </button>

          {showMonthlyDetail && <>
          {/* 이번 달 누적 잔액 흐름 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">이번 달 잔액 흐름</p>
            <p className="text-xs text-[#4E5968] mb-4">일별 누적 순잔액 변화</p>
            {currentMonthly.length === 0 ? (
              <p className="text-sm text-[#4E5968] text-center py-4">이번 달 내역이 없어요</p>
            ) : (
              <CumulativeLineChart transactions={transactions} yearMonth={yearMonth} />
            )}
          </div>

          {/* 요일별 소비 패턴 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
            <p className="text-[15px] font-bold text-white mb-1">요일별 소비 패턴</p>
            <p className="text-xs text-[#4E5968] mb-4">이번 달 요일별 총 지출</p>
            {weekdayData.every((d) => d.total === 0) ? (
              <p className="text-sm text-[#4E5968] text-center py-4">이번 달 지출 내역이 없어요</p>
            ) : (
              <>
                <WeekdayBarChart data={weekdayData} />
                <div className="mt-4 pt-4 border-t border-white/6 grid grid-cols-2 gap-2">
                  {weekdayData.filter((d) => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#2C2C2E] rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-[#8B95A1]">{d.label}요일</span>
                      <span className="text-xs font-bold text-white num">{fmt(d.total)}원</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 일별 지출 히트맵 */}
          {dayHeatmapData.some(c => c.amt > 0) && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-1">일별 지출 히트맵</p>
              <p className="text-xs text-[#4E5968] mb-3">색이 진할수록 지출 많음</p>
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {['일','월','화','수','목','금','토'].map(d => (
                  <div key={d} className="text-center text-[9px] text-[#4E5968] font-semibold">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dayHeatmapData.map((cell, i) => (
                  cell.day === null ? <div key={i} /> : (
                    <div
                      key={i}
                      className="aspect-square rounded-md flex items-center justify-center"
                      style={{
                        backgroundColor: cell.amt > 0
                          ? `rgba(242,82,96,${(0.18 + cell.intensity * 0.72).toFixed(2)})`
                          : '#2C2C2E',
                        outline: cell.isToday ? '1px solid #3D8EF8' : 'none',
                      }}
                    >
                      <span className={`text-[9px] font-bold leading-none ${cell.isToday ? 'text-[#3D8EF8]' : cell.amt > 0 ? 'text-white' : 'text-[#4E5968]'}`}>{cell.day}</span>
                    </div>
                  )
                ))}
              </div>
              {(() => {
                const todayDay = dayHeatmapData.find(c => c.isToday)?.day ?? null
                const validCells = dayHeatmapData.filter(c => c.day !== null && (todayDay === null || c.day! <= todayDay))
                if (!validCells.length) return null
                const maxCell = validCells.reduce((a, b) => b.amt > a.amt ? b : a, validCells[0])
                const totalAmt = validCells.reduce((s, c) => s + c.amt, 0)
                const noSpendCount = validCells.filter(c => c.amt === 0).length
                return (
                  <div className="flex gap-2 mt-3">
                    {maxCell.amt > 0 && (
                      <div className="flex-1 bg-[#2C2C2E] rounded-xl px-3 py-2">
                        <p className="text-[9px] text-[#4E5968] mb-0.5">최다 지출일</p>
                        <p className="text-[12px] font-bold text-white num">{maxCell.day}일</p>
                        <p className="text-[9px] text-[#F25260] num">-{fmtFull(maxCell.amt)}원</p>
                      </div>
                    )}
                    <div className="flex-1 bg-[#2C2C2E] rounded-xl px-3 py-2">
                      <p className="text-[9px] text-[#4E5968] mb-0.5">일평균 지출</p>
                      <p className="text-[12px] font-bold text-white num">{fmtFull(Math.round(totalAmt / validCells.length))}원</p>
                    </div>
                    <div className="flex-1 bg-[#2C2C2E] rounded-xl px-3 py-2">
                      <p className="text-[9px] text-[#4E5968] mb-0.5">무지출 일수</p>
                      <p className="text-[12px] font-bold text-[#2ACF6A] num">{noSpendCount}일</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 결제수단 분석 */}
          {(paymentMethodStats.cash.income > 0
            || paymentMethodStats.cash.expense > 0
            || paymentMethodStats.check.income > 0
            || paymentMethodStats.check.expense > 0
            || paymentMethodStats.credit.income > 0
            || paymentMethodStats.credit.expense > 0) && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-3">결제수단 분석</p>

              {/* 서브탭 */}
              <div className="bg-[#2C2C2E] rounded-xl p-0.5 flex gap-0.5 mb-4">
                {([
                  { key: 'balance', label: '잔액' },
                  { key: 'compare', label: '수입/지출' },
                  { key: 'trend', label: '월별 추이' },
                  { key: 'billing', label: '청구 예정' },
                ] as { key: typeof pmTab; label: string }[]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setPmTab(t.key)}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all ${pmTab === t.key ? 'bg-[#1C1C1E] text-white' : 'text-[#4E5968] hover:text-[#8B95A1]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {pmTab === 'balance' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-2xl px-3 py-2.5 border border-[#2ACF6A]/25 bg-linear-to-br from-[#2ACF6A]/12 to-[#2C2C2E]">
                    <p className="text-[10px] text-[#A8EEC4] font-semibold mb-1">💵 현금 순잔액</p>
                    <p className={`text-[13px] font-extrabold num ${paymentMethodStats.cash.net >= 0 ? 'text-[#D8FFE8]' : 'text-[#F25260]'}`}>
                      {paymentMethodStats.cash.net >= 0 ? '+' : ''}{fmt(paymentMethodStats.cash.net)}원
                    </p>
                    <p className="text-[10px] text-[#8B95A1] mt-1">지출 -{fmt(paymentMethodStats.cash.expense)}</p>
                  </div>
                  <div className="rounded-2xl px-3 py-2.5 border border-[#6AD3C0]/25 bg-linear-to-br from-[#6AD3C0]/12 to-[#2C2C2E]">
                    <p className="text-[10px] text-[#92E6D9] font-semibold mb-1">💳 체크 순잔액</p>
                    <p className={`text-[13px] font-extrabold num ${paymentMethodStats.check.net >= 0 ? 'text-[#D7FFF7]' : 'text-[#F25260]'}`}>
                      {paymentMethodStats.check.net >= 0 ? '+' : ''}{fmt(paymentMethodStats.check.net)}원
                    </p>
                    <p className="text-[10px] text-[#8B95A1] mt-1">지출 -{fmt(paymentMethodStats.check.expense)}</p>
                  </div>
                  <div className="rounded-2xl px-3 py-2.5 border border-[#3D8EF8]/25 bg-linear-to-br from-[#3D8EF8]/12 to-[#2C2C2E]">
                    <p className="text-[10px] text-[#9CC7FF] font-semibold mb-1">💎 신용 순잔액</p>
                    <p className={`text-[13px] font-extrabold num ${paymentMethodStats.credit.net >= 0 ? 'text-[#DCEBFF]' : 'text-[#F25260]'}`}>
                      {paymentMethodStats.credit.net >= 0 ? '+' : ''}{fmt(paymentMethodStats.credit.net)}원
                    </p>
                    <p className="text-[10px] text-[#8B95A1] mt-1">결제예정 {fmt(paymentMethodStats.cardDue)}원</p>
                    <p className="text-[10px] text-[#6F7D90] mt-0.5">{paymentMethodStats.cardBillingRangeLabel}</p>
                  </div>
                </div>
              )}

              {pmTab === 'compare' && (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={paymentMethodStats.methodCompareData} barCategoryGap={20}>
                    <XAxis dataKey="label" tick={{ fill: '#8B95A1', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#4E5968', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                    <Tooltip
                      contentStyle={{ background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                      formatter={(value, name) => [`${fmtFull(Number(value ?? 0))}원`, name === 'income' ? '수입' : '지출']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar dataKey="income" radius={[6, 6, 0, 0]} fill="#2ACF6A" />
                    <Bar dataKey="expense" radius={[6, 6, 0, 0]} fill="#3D8EF8" />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {pmTab === 'trend' && (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={paymentMethodTrend}>
                      <XAxis dataKey="label" tick={{ fill: '#8B95A1', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4E5968', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                      <Tooltip
                        contentStyle={{ background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                        formatter={(value, name) => [
                          `${fmtFull(Number(value ?? 0))}원`,
                          name === 'cashExpense' ? '현금' : name === 'checkExpense' ? '체크' : '신용',
                        ]}
                      />
                      <Line type="monotone" dataKey="cashExpense" stroke="#2ACF6A" strokeWidth={2.2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="checkExpense" stroke="#6AD3C0" strokeWidth={2.2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="creditExpense" stroke="#3D8EF8" strokeWidth={2.2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex items-center gap-4 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-[#8B95A1]"><span className="w-2 h-2 rounded-full bg-[#2ACF6A]" />현금</span>
                    <span className="inline-flex items-center gap-1.5 text-[#8B95A1]"><span className="w-2 h-2 rounded-full bg-[#6AD3C0]" />체크</span>
                    <span className="inline-flex items-center gap-1.5 text-[#8B95A1]"><span className="w-2 h-2 rounded-full bg-[#3D8EF8]" />신용</span>
                  </div>
                </>
              )}

              {pmTab === 'billing' && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl bg-[#2C2C2E] px-3 py-2.5 border border-[#F5BE3A]/20">
                      <p className="text-[10px] text-[#F5BE3A] font-semibold">이번 청구 예정</p>
                      <p className="text-[13px] font-extrabold text-[#F5F7FA] num mt-0.5">{fmt(paymentMethodStats.cardDue)}원</p>
                      <p className="text-[10px] text-[#8B95A1] mt-1">{paymentMethodStats.cardBillingRangeLabel}</p>
                    </div>
                    <div className="rounded-xl bg-[#2C2C2E] px-3 py-2.5 border border-[#3D8EF8]/20">
                      <p className="text-[10px] text-[#79B2FF] font-semibold">다음 청구 예정</p>
                      <p className="text-[13px] font-extrabold text-[#F5F7FA] num mt-0.5">{fmt(paymentMethodStats.nextCardDue)}원</p>
                      <p className="text-[10px] text-[#8B95A1] mt-1">{paymentMethodStats.nextCardBillingRangeLabel}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#8B95A1] mb-3">청구월별 카드 결제예정 (최근 6개월)</p>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={cardStatementDueHistory} barCategoryGap={22}>
                      <XAxis dataKey="label" tick={{ fill: '#8B95A1', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4E5968', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                      <Tooltip
                        contentStyle={{ background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                        formatter={(value) => [`${fmtFull(Number(value ?? 0))}원`, '카드 결제예정']}
                      />
                      <Bar dataKey="due" radius={[6, 6, 0, 0]} fill="#79B2FF" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}

          </>}

          {expenseByCategory.length > 0 && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-4">카테고리 비율</p>
              <DonutChart data={expenseByCategory} />
            </div>
          )}

          {/* 소비 이상 감지 */}
          {anomalyCategories.length > 0 && (
            <div className="bg-[#F5BE3A]/8 border border-[#F5BE3A]/25 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">⚠️</span>
                <p className="text-[15px] font-bold text-[#F5BE3A]">소비 이상 감지</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#F5BE3A]/20 text-[#F5BE3A]">{anomalyCategories.length}개</span>
              </div>
              <p className="text-[11px] text-[#8B95A1] mb-3">최근 3개월 평균 대비 1.5배 초과</p>
              <div className="space-y-2.5">
                {anomalyCategories.map(({ cat, amt, avg, ratio }) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm shrink-0">{CATEGORY_EMOJI[cat] ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-white">{cat}</span>
                        <span className="text-[11px] font-bold text-[#F5BE3A] num">{ratio}%</span>
                      </div>
                      <p className="text-[9px] text-[#8B95A1]">
                        이번달 {fmtFull(amt)}원 vs 3개월 평균 {fmtFull(avg)}원
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이달 요약 복사 */}
          {(current.income > 0 || current.expense > 0) && (
            <button
              onClick={() => {
                const [y, m] = yearMonth.split('-').map(Number)
                const balance = current.income - current.expense
                const top3 = expenseByCategory.slice(0, 3).map(e => `  · ${CATEGORY_EMOJI[e.cat] ?? ''} ${e.cat}: ${e.amt.toLocaleString()}원 (${e.pct}%)`).join('\n')
                const text = [
                  `📊 ${y}년 ${m}월 가계부 요약`,
                  `─────────────────`,
                  `💰 수입: ${current.income.toLocaleString()}원`,
                  `💸 지출: ${current.expense.toLocaleString()}원`,
                  `🏦 잔액: ${balance >= 0 ? '+' : ''}${balance.toLocaleString()}원`,
                  top3 ? `\n📌 지출 TOP3\n${top3}` : '',
                  `\n#잔고플랜 #가계부`,
                ].filter(Boolean).join('\n')
                void navigator.clipboard.writeText(text).then(() => {
                  setSummaryCopied(true)
                  setTimeout(() => setSummaryCopied(false), 2000)
                })
              }}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all ${summaryCopied ? 'bg-[#2ACF6A]/15 border-[#2ACF6A]/30 text-[#2ACF6A]' : 'border-white/10 text-[#4E5968] hover:text-[#8B95A1] hover:border-white/20'}`}
            >
              {summaryCopied ? '✓ 복사 완료!' : '📋 이달 요약 복사'}
            </button>
          )}

          {/* 전월 대비 카테고리 비교 */}
          {categoryMomComparison.length > 0 && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-4">카테고리 전월 비교</p>
              <div className="space-y-3">
                {categoryMomComparison.map(({ cat, curr, prev }) => {
                  const max = Math.max(curr, prev, 1)
                  const diff = curr - prev
                  const diffPct = prev > 0 ? Math.round((diff / prev) * 100) : null
                  const diffColor = diff > 0 ? '#F25260' : diff < 0 ? '#2ACF6A' : '#8B95A1'
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#8B95A1]">{CATEGORY_EMOJI[cat] ?? ''} {cat}</span>
                        {diffPct !== null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] num" style={{ color: diffColor }}>
                              {diff > 0 ? '+' : ''}{fmtFull(Math.abs(diff))}원
                            </span>
                            <span className="text-[10px] font-bold" style={{ color: diffColor }}>
                              ({diff > 0 ? '+' : ''}{diffPct}%)
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#8B95A1] w-5 shrink-0">이번</span>
                          <div className="flex-1 h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#F25260] transition-all duration-500" style={{ width: `${(curr / max) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-[#F1F3F6] num w-14 text-right shrink-0">{fmt(curr)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#4E5968] w-5 shrink-0">전월</span>
                          <div className="flex-1 h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#4E5968] transition-all duration-500" style={{ width: `${(prev / max) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-[#8B95A1] num w-14 text-right shrink-0">{fmt(prev)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
              className="w-9 h-9 rounded-full bg-[#1C1C1E] border border-white/6 flex items-center justify-center"
            >
              <ChevronLeft size={16} className="text-[#8B95A1]" />
            </button>
            <span className="text-[17px] font-extrabold text-white">{selectedYear}년</span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={selectedYear >= new Date().getFullYear()}
              className="w-9 h-9 rounded-full bg-[#1C1C1E] border border-white/6 flex items-center justify-center disabled:opacity-30"
            >
              <ChevronRight size={16} className="text-[#8B95A1]" />
            </button>
          </div>

          {/* 연간 합계 카드 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
            <p className="text-[15px] font-bold text-white mb-4">{selectedYear}년 합계</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#2C2C2E] rounded-2xl p-3.5 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1.5">총 수입</p>
                <p className="text-sm font-extrabold text-[#2ACF6A] num">{fmt(yearTotalIncome)}</p>
                <p className="text-[10px] text-[#4E5968] mt-0.5">원</p>
              </div>
              <div className="bg-[#2C2C2E] rounded-2xl p-3.5 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-1.5">총 지출</p>
                <p className="text-sm font-extrabold text-[#F25260] num">{fmt(yearTotalExpense)}</p>
                <p className="text-[10px] text-[#4E5968] mt-0.5">원</p>
              </div>
              <div className="bg-[#2C2C2E] rounded-2xl p-3.5 text-center">
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
                <div className="h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: progressMounted ? `${Math.min(100, Math.max(0, ((yearTotalIncome - yearTotalExpense) / yearTotalIncome) * 100))}%` : '0%',
                      backgroundColor: yearTotalIncome > yearTotalExpense ? '#3D8EF8' : '#F25260',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 연간 지출 TOP5 */}
          {yearlyCategoryData.length > 0 && (
            <div className="bg-[#1C1C1E] rounded-2xl p-5">
              <p className="text-[15px] font-bold text-white mb-4">{selectedYear}년 지출 TOP5</p>
              <div className="space-y-3">
                {yearlyCategoryData.map((d, i) => (
                  <div key={d.cat}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[#8B95A1]">
                        <span className="text-[10px] text-[#4E5968] mr-1">#{i + 1}</span>
                        {CATEGORY_EMOJI[d.cat] ?? ''} {d.cat}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#8B95A1] num">{fmt(d.amt)}원</span>
                        <span className="text-[11px] font-bold text-[#F25260] num">{d.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#F25260] transition-all duration-700"
                        style={{ width: progressMounted ? `${d.pct}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12개월 차트 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
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
          {(() => {
            const withData = yearlyData.filter(m => m.income > 0 || m.expense > 0)
            if (withData.length === 0) return (
              <div className="bg-[#1C1C1E] rounded-2xl p-5">
                <p className="text-sm text-[#4E5968] text-center py-6">{selectedYear}년 내역이 없어요</p>
              </div>
            )
            const bestMonth = withData.reduce((a, b) => b.balance > a.balance ? b : a)
            const worstMonth = withData.reduce((a, b) => b.balance < a.balance ? b : a)
            return (
              <div className="bg-[#1C1C1E] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[15px] font-bold text-white">월별 상세</p>
                  {withData.length >= 2 && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#2ACF6A]/15 text-[#2ACF6A] font-bold">최고 {bestMonth.label}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-[#F25260]/15 text-[#F25260] font-bold">최저 {worstMonth.label}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {withData.map((m) => {
                    const isCurrent = m.ym === yearMonth
                    const isBest = withData.length >= 2 && m.ym === bestMonth.ym && m.balance > 0
                    const isWorst = withData.length >= 2 && m.ym === worstMonth.ym && m.balance < 0
                    return (
                      <div key={m.ym}
                        className={`flex items-center py-2.5 px-3 rounded-xl ${isCurrent ? 'bg-[#3D8EF8]/10' : isBest ? 'bg-[#2ACF6A]/8' : isWorst ? 'bg-[#F25260]/8' : ''}`}>
                        <span className={`text-sm font-bold w-10 shrink-0 ${isCurrent ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}>
                          {m.label}
                        </span>
                        <div className="flex-1 flex justify-end gap-4 items-center">
                          <span className="text-xs text-[#3D8EF8] num">+{fmt(m.income)}</span>
                          <span className="text-xs text-[#F25260] num">-{fmt(m.expense)}</span>
                          <span className={`text-xs font-bold num w-16 text-right ${m.balance >= 0 ? 'text-white' : 'text-[#F25260]'}`}>
                            {m.balance >= 0 ? '+' : ''}{fmt(m.balance)}
                          </span>
                          {isBest && <span className="text-[9px] text-[#2ACF6A]">🏆</span>}
                          {isWorst && <span className="text-[9px] text-[#F25260]">⚠️</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ──── 태그 뷰 ──── */}
      {viewMode === 'tags' && (
        <>
          {tagData.length === 0 ? (
            <div className="bg-[#1C1C1E] rounded-2xl p-8 text-center">
              <Hash size={32} className="text-[#2C2C2E] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#4E5968]">이번 달 태그 내역이 없어요</p>
              <p className="text-xs text-[#2C2C2E] mt-1">거래 내역에 태그를 추가하면 분석을 보여드려요</p>
            </div>
          ) : (
            <>
              {/* 태그별 지출 순위 */}
              <div className="bg-[#1C1C1E] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Hash size={15} className="text-[#3D8EF8]" />
                  <p className="text-[15px] font-bold text-white">태그별 지출 순위</p>
                  <span className="text-xs text-[#4E5968] ml-auto">{yearMonth.replace('-', '년 ')}월</span>
                </div>
                <div className="space-y-3">
                  {(showAllTags ? tagData : tagData.slice(0, 5)).map((item, idx) => {
                    const maxExpense = tagData[0].expense || 1
                    const barPct = Math.round((item.expense / maxExpense) * 100)
                    return (
                      <div key={item.tag}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-[#4E5968] w-4 num">{idx + 1}</span>
                            <span className="text-[13px] font-semibold text-[#F1F3F6]">#{item.tag}</span>
                            <span className="text-[10px] text-[#4E5968]">{item.count}건</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] font-bold text-[#F25260] num">
                              -{fmtFull(item.expense)}원
                            </span>
                            {item.income > 0 && (
                              <span className="text-[11px] text-[#2ACF6A] num ml-1.5">
                                +{fmtFull(item.income)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: progressMounted ? `${barPct}%` : '0%',
                              backgroundColor: topTagColors[idx] ?? '#4E5968',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {tagData.length > 5 && (
                  <button
                    onClick={() => setShowAllTags((v) => !v)}
                    className="w-full mt-3 py-2 rounded-xl text-[12px] font-semibold text-[#4E5968] hover:text-[#8B95A1] hover:bg-[#2C2C2E] transition-colors"
                  >
                    {showAllTags ? '접기' : `${tagData.length - 5}개 더보기`}
                  </button>
                )}
              </div>

              {/* 태그 지출 막대 차트 (상위 6) */}
              {tagData.length > 0 && (
                <div className="bg-[#1C1C1E] rounded-2xl p-5">
                  <p className="text-[15px] font-bold text-white mb-4">태그 지출 비교</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={tagData.slice(0, 6).map(d => ({ name: `#${d.tag}`, 지출: d.expense }))}
                      margin={{ top: 0, right: 12, left: -16, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#8B95A1', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#4E5968', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => fmt(v)}
                      />
                      <Tooltip
                        contentStyle={{ background: '#2C2C2E', border: 'none', borderRadius: 12 }}
                        labelStyle={{ color: '#F1F3F6', fontSize: 12, fontWeight: 700 }}
                        itemStyle={{ color: '#F25260', fontSize: 12 }}
                        formatter={(v) => [`${fmtFull(Number(v))}원`, '지출']}
                      />
                      <Bar dataKey="지출" fill="#F25260" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 상위 3 태그 월별 트렌드 */}
              {tagData.length > 0 && tagTrend.length > 0 && (
                <div className="bg-[#1C1C1E] rounded-2xl p-5">
                  <p className="text-[15px] font-bold text-white mb-1">상위 태그 6개월 트렌드</p>
                  <p className="text-xs text-[#4E5968] mb-4">태그별 월간 지출 변화</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                    {tagData.slice(0, 3).map((t, i) => (
                      <div key={t.tag} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: topTagColors[i] }} />
                        <span className="text-[11px] text-[#8B95A1]">#{t.tag}</span>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={tagTrend} margin={{ top: 0, right: 12, left: -16, bottom: 0 }}>
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#8B95A1', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#4E5968', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => fmt(v)}
                      />
                      <Tooltip
                        contentStyle={{ background: '#2C2C2E', border: 'none', borderRadius: 12 }}
                        labelStyle={{ color: '#F1F3F6', fontSize: 12, fontWeight: 700 }}
                        itemStyle={{ fontSize: 12 }}
                        formatter={(v, name) => [`${fmtFull(Number(v))}원`, `#${name}`]}
                      />
                      {tagData.slice(0, 3).map((t, i) => (
                        <Line
                          key={t.tag}
                          type="monotone"
                          dataKey={t.tag}
                          stroke={topTagColors[i]}
                          strokeWidth={2}
                          dot={{ r: 3, fill: topTagColors[i] }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 태그 요약 통계 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1C1C1E] rounded-2xl p-4 text-center">
                  <p className="text-[10px] text-[#4E5968] font-semibold mb-1">태그 수</p>
                  <p className="text-[17px] font-extrabold text-white num">{tagData.length}</p>
                  <p className="text-[10px] text-[#4E5968] mt-0.5">개</p>
                </div>
                <div className="bg-[#1C1C1E] rounded-2xl p-4 text-center">
                  <p className="text-[10px] text-[#4E5968] font-semibold mb-1">태그 지출</p>
                  <p className="text-[13px] font-extrabold text-[#F25260] num">
                    {fmt(tagData.reduce((s, t) => s + t.expense, 0))}
                  </p>
                  <p className="text-[10px] text-[#4E5968] mt-0.5">원</p>
                </div>
                <div className="bg-[#1C1C1E] rounded-2xl p-4 text-center">
                  <p className="text-[10px] text-[#4E5968] font-semibold mb-1">총 건수</p>
                  <p className="text-[17px] font-extrabold text-white num">
                    {tagData.reduce((s, t) => s + t.count, 0)}
                  </p>
                  <p className="text-[10px] text-[#4E5968] mt-0.5">건</p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ──── 절감 제안 뷰 ──── */}
      {viewMode === 'reduce' && (
        <SpendingAnalysisView transactions={transactions} budgets={budgets} />
      )}

      {/* ──── 예산 vs 실지출 뷰 ──── */}
      {viewMode === 'budget' && (
        <div className="bg-[#1C1C1E] rounded-2xl p-5">
          <p className="text-[15px] font-bold text-white mb-1">예산 vs 실지출</p>
          <p className="text-xs text-[#8B95A1] mb-4">{yearMonth.replace('-', '년 ')}월 카테고리별 예산 대비 지출</p>
          <BudgetCompareChart transactions={transactions} budgets={budgets} yearMonth={yearMonth} />
        </div>
      )}

      {/* ──── 캐시플로 뷰 ──── */}
      {viewMode === 'cashflow' && (
        <>
          {/* 캐시플로 차트 */}
          <div className="bg-[#1C1C1E] rounded-2xl p-5">
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
          {(() => {
            const maxAbs = Math.max(...monthlyData.map(m => Math.abs(m.balance)), 1)
            return (
              <div className="bg-[#1C1C1E] rounded-2xl p-5">
                <p className="text-[15px] font-bold text-white mb-4">월별 순이익</p>
                <div className="space-y-2">
                  {monthlyData.map((m) => {
                    const isCurrent = m.ym === yearMonth
                    const isPositive = m.balance >= 0
                    const barPct = Math.round((Math.abs(m.balance) / maxAbs) * 100)
                    return (
                      <div key={m.ym}
                        className={`py-2.5 px-3 rounded-xl ${isCurrent ? 'bg-[#3D8EF8]/10' : ''}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm font-bold ${isCurrent ? 'text-[#3D8EF8]' : 'text-[#8B95A1]'}`}>{m.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#4E5968] num">{fmt(m.income)} / {fmt(m.expense)}</span>
                            <span className={`text-sm font-extrabold num ${isPositive ? 'text-[#2ACF6A]' : 'text-[#F25260]'}`}>
                              {isPositive ? '+' : ''}{fmt(m.balance)}원
                            </span>
                          </div>
                        </div>
                        {m.income > 0 || m.expense > 0 ? (
                          <div className="h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${barPct}%`,
                                backgroundColor: isPositive ? '#2ACF6A' : '#F25260',
                                opacity: isCurrent ? 1 : 0.5,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Best / Worst 월 */}
          {cashflowStats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1C1C1E] rounded-2xl p-4 text-center">
                <p className="text-[10px] text-[#4E5968] font-semibold mb-2">최고의 달 🏆</p>
                <p className="text-sm font-bold text-white">{cashflowStats.best.label}</p>
                <p className="text-[13px] font-extrabold text-[#2ACF6A] num mt-1">
                  +{fmt(cashflowStats.best.balance)}원
                </p>
              </div>
              <div className="bg-[#1C1C1E] rounded-2xl p-4 text-center">
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
    <div className="bg-[#2C2C2E] rounded-2xl p-4">
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
