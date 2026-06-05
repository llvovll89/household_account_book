import type { AutoCategoryRule, TransactionType } from '../types'

export function applyAutoCategory(
  description: string,
  type: TransactionType,
  rules: AutoCategoryRule[],
): string | null {
  const lower = description.toLowerCase()
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.type !== type) continue
    if (lower.includes(rule.keyword.toLowerCase())) return rule.category
  }
  return null
}
