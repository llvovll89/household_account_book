import type { AutoCategoryRule, Budget, RecurringTransaction, SavingsGoal, Subscription, Transaction, TransactionTemplate, TransactionType } from '../types'

export interface CategoryMoves { expense: Record<string, string>; income: Record<string, string> }
export interface CategoryUsage {
  transactions: Transaction[]; recurring: RecurringTransaction[]; templates: TransactionTemplate[]
  rules: AutoCategoryRule[]; budgets: Budget[]; subscriptions: Subscription[]; goals: SavingsGoal[]
}
export function getCategoryDestination(moves: Record<string, string>, category: string): string | undefined {
  return Object.hasOwn(moves, category) ? moves[category] : undefined
}
export function categoryUsageCounts(data: CategoryUsage, category: string, type: TransactionType) {
  return {
    거래: data.transactions.filter(t => t.category === category && t.type === type).length,
    정기내역: data.recurring.filter(t => t.category === category && t.type === type).length,
    템플릿: data.templates.filter(t => t.category === category && t.type === type).length,
    자동분류: data.rules.filter(t => t.category === category && t.type === type).length,
    예산: type === 'expense' ? data.budgets.filter(t => t.category === category).length : 0,
    구독: type === 'expense' ? data.subscriptions.filter(t => t.category === category).length : 0,
    목표연결: data.goals.filter(t => t.linkedCategory === category).length,
  }
}
export function migrateBudgets(budgets: Budget[], moves: Record<string, string>): Budget[] {
  const merged = new Map<string, Budget>()
  for (const b of budgets) {
    const category = getCategoryDestination(moves, b.category) ?? b.category
    const key = JSON.stringify([category, b.yearMonth ?? null])
    const existing = merged.get(key)
    merged.set(key, existing ? { ...existing, limit: existing.limit + b.limit, carryover: !!(existing.carryover || b.carryover) } : { ...b, category })
  }
  return [...merged.values()]
}
export function migrateTypedCategory<T extends { category: string; type: TransactionType }>(item: T, moves: CategoryMoves): T {
  const category = getCategoryDestination(moves[item.type], item.category)
  return category ? { ...item, category } : item
}

export function projectCategoryUsage(data: CategoryUsage, moves: CategoryMoves): CategoryUsage {
  return {
    transactions: data.transactions.map(t => migrateTypedCategory(t, moves)),
    recurring: data.recurring.map(t => migrateTypedCategory(t, moves)),
    templates: data.templates.map(t => migrateTypedCategory(t, moves)),
    rules: data.rules.map(t => migrateTypedCategory(t, moves)),
    budgets: migrateBudgets(data.budgets, moves.expense),
    subscriptions: data.subscriptions.map(s => ({ ...s, category: getCategoryDestination(moves.expense, s.category) ?? s.category })),
    goals: data.goals.map(g => {
      const category = g.linkedCategory && (getCategoryDestination(moves.expense, g.linkedCategory) ?? getCategoryDestination(moves.income, g.linkedCategory))
      return category ? { ...g, linkedCategory: category } : g
    }),
  }
}
