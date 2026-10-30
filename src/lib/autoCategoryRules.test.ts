import { expect, it } from 'vitest'
import { applyAutoCategory, getCorrectionKeyword, mergeCategoryCorrections } from './autoCategoryRules'

it('prioritizes the chosen specific correction over a broader rule without rewriting old transactions', () => {
  const rules = [{ id: 'broad', keyword: '스타', type: 'expense' as const, category: '쇼핑', enabled: true }]
  const next = mergeCategoryCorrections(rules, [{ description: '스타벅스 강남', category: '식비', type: 'expense' }])
  expect(applyAutoCategory('스타벅스 강남 결제', 'expense', next)).toBe('식비')
  expect(rules[0].category).toBe('쇼핑')
  expect(applyAutoCategory('스타벅스 강남', 'income', next)).toBeNull()
})

it('updates an exact conflicting or disabled keyword instead of accumulating duplicates', () => {
  const next = mergeCategoryCorrections([{ id: 'same', keyword: 'COFFEE', type: 'expense', category: '쇼핑', enabled: false }], [{ description: ' coffee ', category: '식비', type: 'expense' }])
  expect(next).toEqual([{ id: 'same', keyword: 'coffee', type: 'expense', category: '식비', enabled: true }])
  expect(getCorrectionKeyword('a')).toBe('')
  expect(getCorrectionKeyword('x'.repeat(81))).toBe('')
})

it('rejects contradictory choices for the same keyword and transaction type', () => {
  expect(() => mergeCategoryCorrections([], [{ description: '점심', category: '식비', type: 'expense' }, { description: '점심', category: '교통비', type: 'expense' }])).toThrow('서로 다른 분류')
})
