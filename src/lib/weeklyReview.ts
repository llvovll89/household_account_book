import type { Transaction } from '../types'
import { toLocalDateStr } from './format'

function shiftDay(date: Date, offset: number) {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + offset)
  return toLocalDateStr(shifted)
}

export function getWeeklyReview(transactions: Transaction[], now = new Date()) {
  const today = toLocalDateStr(now)
  const elapsed = (now.getDay() + 6) % 7
  const start = shiftDay(now, -elapsed)
  const previousStart = shiftDay(now, -elapsed - 7)
  const previousEnd = shiftDay(now, -7)
  const current = transactions.filter(t => t.date >= start && t.date <= today)
  const previous = transactions.filter(t => t.date >= previousStart && t.date <= previousEnd)
  const sumExpenses = (items: Transaction[]) => items.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const byCategory = new Map<string, number>()
  current.filter(t => t.type === 'expense').forEach(t => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount))
  const topCategory = [...byCategory].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return {
    start, end: today, previousStart, previousEnd,
    count: current.length, recordedDays: new Set(current.map(t => t.date)).size,
    expense: sumExpenses(current), previousExpense: sumExpenses(previous),
    canCompare: current.length > 0 && previous.length > 0,
    topCategory: topCategory ? { category: topCategory[0], amount: topCategory[1] } : null,
  }
}

export function getDaysSinceLastRecord(transactions: Transaction[], now = new Date()): number | null {
  const today = toLocalDateStr(now)
  const latest = transactions.filter(t => t.date <= today).map(t => t.date).sort().at(-1)
  if (!latest) return null
  const [year, month, day] = latest.split('-').map(Number)
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 86400000)
}
