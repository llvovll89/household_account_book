import type { AutoCategoryRule, TransactionType } from '../types'
import { generateId } from './format'

export interface CategoryCorrection { description: string; type: TransactionType; category: string }

export function getCorrectionKeyword(description: string): string {
  const keyword = description.trim()
  return keyword.length >= 2 && keyword.length <= 80 ? keyword : ''
}

export function mergeCategoryCorrections(rules: AutoCategoryRule[], corrections: CategoryCorrection[]): AutoCategoryRule[] {
  const chosen = new Map<string, CategoryCorrection>()
  for (const correction of corrections) {
    const keyword = getCorrectionKeyword(correction.description)
    if (!keyword) continue
    const key = `${correction.type}:${keyword.toLowerCase()}`
    if (chosen.has(key) && chosen.get(key)!.category !== correction.category) throw new Error('같은 적요에 서로 다른 분류를 선택했어요. 자동 분류는 하나만 선택해주세요.')
    chosen.set(key, { ...correction, description: keyword })
  }
  const updated = [...chosen.values()].map(correction => {
    const previous = rules.find(r => r.type === correction.type && r.keyword.toLowerCase() === correction.description.toLowerCase())
    return { id: previous?.id ?? generateId(), type: correction.type, keyword: correction.description, category: correction.category, enabled: true }
  })
  const replaced = new Set(updated.map(r => `${r.type}:${r.keyword.toLowerCase()}`))
  return [...updated, ...rules.filter(r => !replaced.has(`${r.type}:${r.keyword.toLowerCase()}`))]
}

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
