import type { SavingsGoal, Transaction } from '../types'

type GoalLink = Pick<SavingsGoal, 'linkedCategory' | 'linkedTags'>

function hasLink(g: GoalLink): boolean {
  return !!g.linkedCategory || (g.linkedTags?.length ?? 0) > 0
}

/** 목표에 연결된 카테고리·태그에 해당하는 거래인지 (둘 다 지정하면 둘 다 맞아야 함) */
export function isLinkedToGoal(g: GoalLink, t: Transaction): boolean {
  if (g.linkedCategory && t.category !== g.linkedCategory) return false
  if (g.linkedTags && g.linkedTags.length > 0 && !g.linkedTags.some((tag) => t.tags?.includes(tag))) return false
  return true
}

/**
 * 목표별 자동 집계 금액. 연결이 없는 목표는 결과에 없다.
 * 카테고리에 연결하면 그 카테고리 금액을 그대로 모은다(지출 카테고리 '저축'도 +로 쌓임).
 * 태그만 연결하면 수입은 +, 지출은 −인 순액으로 본다.
 */
export function getGoalAutoAmounts(goals: SavingsGoal[], transactions: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const g of goals) {
    if (!hasLink(g)) continue
    map[g.id] = transactions
      .filter((t) => isLinkedToGoal(g, t))
      .reduce((s, t) => s + (g.linkedCategory || t.type === 'income' ? t.amount : -t.amount), 0)
  }
  return map
}

/** 목표별 연결 내역 최신 limit건 */
export function getRecentLinkedTransactions(goals: SavingsGoal[], transactions: Transaction[], limit = 5): Record<string, Transaction[]> {
  const map: Record<string, Transaction[]> = {}
  for (const g of goals) {
    if (!hasLink(g)) continue
    map[g.id] = transactions
      .filter((t) => isLinkedToGoal(g, t))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, limit)
  }
  return map
}
