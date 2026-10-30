import type { Budget, Transaction } from '../types'
import { getBudgetCarryoverAmounts, getEffectiveBudgets } from './budgets'
import { fmt, toLocalDateStr } from './format'

export function getTransactionFeedback(items: Omit<Transaction, 'id' | 'createdAt'>[], transactions: Transaction[], budgets: Budget[], editing = false): string {
  if (items.length !== 1) return `${items.length}건의 내역을 ${editing ? '수정' : '기록'}했어요.`
  const item = items[0]
  const saved = `${item.category} ${fmt(item.amount)}원을 ${editing ? '수정' : '기록'}했어요.`
  if (item.type === 'income') return saved
  const month = item.date.slice(0, 7)
  const budget = getEffectiveBudgets(budgets, month).find(b => b.category === item.category)
  if (budget) {
    const carryover = getBudgetCarryoverAmounts(budgets, transactions, month)[item.category] ?? 0
    const spent = transactions.filter(t => t.type === 'expense' && t.category === item.category && t.date.startsWith(month)).reduce((sum, t) => sum + t.amount, 0)
    const remaining = budget.limit + carryover - spent
    const scope = `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월 ${item.category} 예산`
    return `${saved}\n${scope}${remaining < 0 ? `을 ${fmt(-remaining)}원 초과했어요.` : `이 ${fmt(remaining)}원 남았어요.`}`
  }
  const dayExpense = transactions.filter(t => t.type === 'expense' && t.date === item.date).reduce((sum, t) => sum + t.amount, 0)
  const day = item.date === toLocalDateStr() ? '오늘' : item.date.replaceAll('-', '.')
  return `${saved}\n${day} 기록한 지출은 ${fmt(dayExpense)}원이에요.`
}
