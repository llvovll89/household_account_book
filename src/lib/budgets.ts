import type { Budget, Transaction } from '../types'
import { shiftYM } from './format'

/** 해당 월의 설정을 우선 적용하고 나머지 카테고리는 기본 예산을 사용한다. */
export function getEffectiveBudgets(budgets: Budget[], yearMonth: string): Budget[] {
  const overrides = budgets.filter(budget => budget.yearMonth === yearMonth)
  const covered = new Set(overrides.map(budget => budget.category))
  return [...overrides, ...budgets.filter(budget => !budget.yearMonth && !covered.has(budget.category))]
}

/** Carry only the previous month's unused base allowance, when that month enabled it. */
export function getBudgetCarryoverAmounts(budgets: Budget[], transactions: Transaction[], yearMonth: string): Record<string, number> {
  const previousMonth = shiftYM(yearMonth, -1)
  const amounts: Record<string, number> = {}
  const previousBudgets = getEffectiveBudgets(budgets, previousMonth)
  for (const budget of getEffectiveBudgets(budgets, yearMonth)) {
    const previous = previousBudgets.find(item => item.category === budget.category)
    if (!previous?.carryover) continue
    const spent = transactions.filter(t => t.type === 'expense' && t.category === budget.category && t.date.startsWith(previousMonth)).reduce((sum, t) => sum + t.amount, 0)
    amounts[budget.category] = Math.max(0, previous.limit - spent)
  }
  return amounts
}

export function getBudgetProgress(budgets: Budget[], transactions: Transaction[], yearMonth: string) {
  const carryover = getBudgetCarryoverAmounts(budgets, transactions, yearMonth)
  const expenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(yearMonth))
  return getEffectiveBudgets(budgets, yearMonth).map(budget => {
    const carryoverAmount = carryover[budget.category] ?? 0
    const effectiveLimit = budget.limit + carryoverAmount
    const spent = expenses.filter(t => t.category === budget.category).reduce((sum, t) => sum + t.amount, 0)
    return { ...budget, carryoverAmount, effectiveLimit, spent, remaining: effectiveLimit - spent }
  })
}
