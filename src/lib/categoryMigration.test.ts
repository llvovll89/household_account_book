import { expect, it } from 'vitest'
import { migrateBudgets, migrateTypedCategory } from './categoryMigration'

it('merges budgets by destination and month while preserving the default separately', () => {
  const budgets = [{ category: '주택', limit: 30 }, { category: '주거비', limit: 20 }, { category: '주택', limit: 40, yearMonth: '2026-10', carryover: true }, { category: '주거비', limit: 10, yearMonth: '2026-10' }, { category: '주거비', limit: 15, yearMonth: '2026-11' }]
  const before = JSON.stringify(budgets)
  expect(migrateBudgets(budgets, { 주택: '주거비' })).toEqual([{ category: '주거비', limit: 50, carryover: false }, { category: '주거비', limit: 50, yearMonth: '2026-10', carryover: true }, { category: '주거비', limit: 15, yearMonth: '2026-11' }])
  expect(JSON.stringify(budgets)).toBe(before)
})
it('moves only the matching transaction type when income and expense share a name', () => {
  const moves = { expense: { 개인: '기타지출' }, income: {} }
  expect(migrateTypedCategory({ type: 'expense', category: '개인', amount: 10 }, moves)).toEqual({ type: 'expense', category: '기타지출', amount: 10 })
  expect(migrateTypedCategory({ type: 'income', category: '개인', amount: 10 }, moves)).toEqual({ type: 'income', category: '개인', amount: 10 })
})
