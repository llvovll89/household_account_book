import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import HomeOverview from './HomeOverview'
import type { DashboardProps } from './MonthlyDashboard'
import { getBudgetCarryoverAmounts, getBudgetProgress, getEffectiveBudgets } from '../lib/budgets'

const MonthlyDashboard = lazy(() => import('./MonthlyDashboard'))
const BudgetModal = lazy(() => import('./BudgetModal'))

export default function Dashboard(props: DashboardProps) {
  const { transactions, budgets, recurring, subscriptions, yearMonth, hiddenWidgets = [] } = props
  const [showBudget, setShowBudget] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const effective = useMemo(() => getEffectiveBudgets(budgets, yearMonth), [budgets, yearMonth])
  const carryover = useMemo(() => getBudgetCarryoverAmounts(budgets, transactions, yearMonth), [budgets, transactions, yearMonth])
  const attention = useMemo(() => {
    const over = getBudgetProgress(budgets, transactions, yearMonth).find(b => b.remaining < 0)
    if (over) return `${over.category} 예산을 초과했어요. 카테고리별 내역을 확인해보세요.`
    const pending = recurring.filter(r => (r.frequency ?? 'monthly') === 'monthly' && r.lastAppliedMonth !== yearMonth)
    if (!hiddenWidgets.includes('recurring-pending') && pending.length) return `아직 반영하지 않은 정기 내역이 ${pending.length}건 있어요.`
    const today = new Date()
    const day = today.getDate()
    const upcoming = subscriptions.map(s => {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      const nextLastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()
      const thisDay = Math.min(s.billingDay, lastDay)
      return { ...s, days: thisDay >= day ? thisDay - day : lastDay - day + Math.min(s.billingDay, nextLastDay) }
    }).filter(s => s.days <= 7).sort((a, b) => a.days - b.days)[0]
    if (!hiddenWidgets.includes('subscription-alert') && upcoming) return `${upcoming.name} 구독 결제가 ${upcoming.days === 0 ? '오늘' : `${upcoming.days}일 후`} 예정되어 있어요.`
  }, [budgets, transactions, yearMonth, recurring, subscriptions, hiddenWidgets])

  return <div className="dashboard-grid space-y-4 tab-content">
    <HomeOverview transactions={transactions} budgets={effective} carryoverAmounts={carryover} yearMonth={yearMonth}
      onAdd={props.onAddTransaction} onBudget={() => setShowBudget(true)} onWidgets={props.onOpenWidgetSettings}
      onImport={props.onOpenImport} attention={attention} onReview={() => {
        if (detailsRef.current) detailsRef.current.open = true
        setExpanded(true)
        detailsRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
      }} />
    <details className="home-monthly-details" ref={detailsRef} onToggle={e => setExpanded(e.currentTarget.open)}>
      <summary>월간 현황과 상세 위젯 <span>잔액 · 예산 관리 · 분석</span></summary>
      {expanded && <Suspense fallback={<p role="status" className="p-6 text-sm text-[#8B95A1]">상세 위젯을 불러오는 중...</p>}>
        <MonthlyDashboard {...props} />
      </Suspense>}
    </details>
    {showBudget && <Suspense fallback={<p role="status">예산 설정을 불러오는 중...</p>}><BudgetModal
      budgets={effective} baseBudgets={budgets.filter(b => !b.yearMonth)} yearMonth={yearMonth}
      customExpenseCategories={props.customExpenseCategories} hasMonthOverride={budgets.some(b => b.yearMonth === yearMonth)}
      onClose={() => setShowBudget(false)} onSave={(next, scope) => props.onBudgetsChange([
        ...budgets.filter(b => scope === 'thisMonth' ? b.yearMonth !== yearMonth : !!b.yearMonth), ...next,
      ])} /></Suspense>}
  </div>
}
