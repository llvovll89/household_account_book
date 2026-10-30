import type { Budget, Transaction } from '../types'

/** 해당 월의 설정을 우선 적용하고 나머지 카테고리는 기본 예산을 사용한다. */
export function getEffectiveBudgets(budgets: Budget[], yearMonth: string): Budget[] {
  const overrides = budgets.filter(budget => budget.yearMonth === yearMonth)
  const covered = new Set(overrides.map(budget => budget.category))
  return [...overrides, ...budgets.filter(budget => !budget.yearMonth && !covered.has(budget.category))]
}

/** Keep the same single-month carryover rule in summaries and save feedback. */
export function getBudgetCarryoverAmounts(budgets: Budget[], transactions: Transaction[], yearMonth: string): Record<string, number> {
  const [year, month] = yearMonth.split('-').map(Number)
  const previousMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  const amounts: Record<string, number> = {}
  for (const budget of getEffectiveBudgets(budgets, yearMonth)) {
    if (!budget.carryover) continue
    const spent = transactions.filter(t => t.type === 'expense' && t.category === budget.category && t.date.startsWith(previousMonth)).reduce((sum, t) => sum + t.amount, 0)
    amounts[budget.category] = Math.max(0, budget.limit - spent)
  }
  return amounts
}
