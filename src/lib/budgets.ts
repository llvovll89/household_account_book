import type { Budget } from '../types'

/** 해당 월의 설정을 우선 적용하고 나머지 카테고리는 기본 예산을 사용한다. */
export function getEffectiveBudgets(budgets: Budget[], yearMonth: string): Budget[] {
  const overrides = budgets.filter(budget => budget.yearMonth === yearMonth)
  const covered = new Set(overrides.map(budget => budget.category))
  return [...overrides, ...budgets.filter(budget => !budget.yearMonth && !covered.has(budget.category))]
}
