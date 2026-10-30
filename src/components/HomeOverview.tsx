import { Plus, ArrowRight, SlidersHorizontal } from 'lucide-react'
import type { Budget, Transaction } from '../types'
import { fmt, toLocalDateStr } from '../lib/format'
import CategoryIcon from './ui/CategoryIcon'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  carryoverAmounts: Record<string, number>
  yearMonth: string
  onAdd?: () => void
  onBudget: () => void
  onWidgets?: () => void
  onReview: () => void
  attention?: string
}

export default function HomeOverview({ transactions, budgets, carryoverAmounts, yearMonth, onAdd, onBudget, onWidgets, onReview, attention }: Props) {
  const today = toLocalDateStr()
  const isCurrentMonth = yearMonth === today.slice(0, 7)
  const monthly = transactions.filter(t => t.date.startsWith(yearMonth))
  const budgetedCategories = new Set(budgets.map(b => b.category))
  const limit = budgets.reduce((sum, b) => sum + b.limit + (carryoverAmounts[b.category] ?? 0), 0)
  const spent = monthly.filter(t => t.type === 'expense' && budgetedCategories.has(t.category)).reduce((sum, t) => sum + t.amount, 0)
  const remaining = limit - spent
  const entries = monthly.filter(t => !isCurrentMonth || t.date === today).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const expense = entries.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="home-overview">
      <section className="home-budget" aria-labelledby="home-budget-title">
        <div className="home-section-heading">
          <h3 id="home-budget-title">{Number(yearMonth.slice(5))}월 {remaining < 0 ? '초과한 예산' : '남은 예산'}</h3>
          {onWidgets && <button type="button" onClick={onWidgets} aria-label="위젯 설정"><SlidersHorizontal size={18} /></button>}
        </div>
        {budgets.length > 0 ? <>
          <p className={`home-budget-value num ${remaining < 0 ? 'is-over-budget' : ''}`}>{fmt(Math.abs(remaining))}<span>원</span></p>
          <p className="home-description">설정한 {budgets.length}개 카테고리 기준 · 이월 포함</p>
          <div className="home-budget-totals"><span>예산 <strong className="num">{fmt(limit)}원</strong></span><span>기록한 지출 <strong className="num">{fmt(spent)}원</strong></span></div>
          <button type="button" className="home-text-button" onClick={onBudget}>카테고리별 예산 확인 <ArrowRight size={15} /></button>
        </> : <>
          <p className="home-empty-title">이번 달 생활비를 정해볼까요?</p>
          <p className="home-description">자주 쓰는 카테고리 하나부터 시작해도 좋아요.</p>
          <button type="button" className="home-text-button" onClick={onBudget}>예산 설정하기 <ArrowRight size={15} /></button>
        </>}
        {onAdd && <button type="button" className="home-primary-action" onClick={onAdd}><Plus size={18} /> 내역 기록하기</button>}
      </section>

      <section className="home-today" aria-labelledby="home-today-title">
        <div className="home-section-heading"><h3 id="home-today-title">{isCurrentMonth ? '오늘 기록' : `${Number(yearMonth.slice(5))}월 최근 기록`}</h3><span className="home-description">{entries.length}건</span></div>
        {entries.length > 0 ? <>
          <p className="home-today-total">{isCurrentMonth ? '오늘' : '이번 달'} 기록한 지출 <strong className="num">{fmt(expense)}원</strong></p>
          <ul className="home-entry-list">{entries.slice(0, 3).map(t => <li key={t.id}>
            <CategoryIcon category={t.category} size={18} />
            <span>{t.description || t.category}<small>{t.category}{!isCurrentMonth && ` · ${t.date.slice(5).replace('-', '.')}`}</small></span>
            <strong className={`num ${t.type === 'expense' ? 'entry-expense' : 'entry-income'}`}>{t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}원</strong>
          </li>)}</ul>
          {entries.length > 3 && <p className="home-description">전체 {entries.length}건은 거래 내역 탭에서 확인할 수 있어요.</p>}
        </> : <p className="home-description">{isCurrentMonth ? '아직 오늘 기록이 없어요. 쓴 내역이 있다면 한 건만 남겨보세요.' : '이 달에 기록한 내역이 없어요.'}</p>}
      </section>

      <section className="home-attention" aria-labelledby="home-attention-title">
        <h3 id="home-attention-title">확인할 일</h3>
        <p>{attention ?? (budgets.length > 0 ? '예산과 기록을 한 번 살펴보세요.' : '예산을 정하면 기록할 때마다 남은 금액을 확인할 수 있어요.')}</p>
        <button type="button" className="home-text-button" onClick={attention ? onReview : onBudget}>{attention ? '월간 상세 열기' : '예산 살펴보기'} <ArrowRight size={15} /></button>
      </section>
    </div>
  )
}
