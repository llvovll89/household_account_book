import { expect, it } from 'vitest'
import { getEffectiveBudgets } from './budgets'

it('replaces only the selected month category and preserves other default budgets', () => {
  const food = { category: '식비', limit: 100 }
  const travel = { category: '교통비', limit: 50 }
  const override = { category: '식비', limit: 200, yearMonth: '2026-09' }
  const otherMonth = { category: '교통비', limit: 500, yearMonth: '2026-10' }
  expect(getEffectiveBudgets([food, travel, override, otherMonth], '2026-09')).toEqual([override, travel])
  expect(getEffectiveBudgets([food, travel, override, otherMonth], '2026-08')).toEqual([food, travel])
})
