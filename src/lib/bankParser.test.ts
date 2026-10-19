import { expect, it } from 'vitest'
import { guessCategory } from './bankParser'

it.each([
  ['자동차보험 납부', '보험'],
  ['의료실손보험', '보험'],
  ['삼성화재해상', '보험'],
  ['주거 대출 원리금 상환', '대출'],
  ['대출이자 납입', '대출'],
  ['원금상환', '대출'],
  ['이자납부', '대출'],
  ['정기적금', '저축'],
  ['급여 정산', '기타지출'],
])('classifies the expense %s as %s', (description, category) => {
  expect(guessCategory(description, 'expense')).toBe(category)
})

it.each(['보험 환급금', '대출 실행', '정기적금 만기'])('keeps incoming %s out of expense categories', (description) => {
  expect(guessCategory(description, 'income')).toBe('기타수입')
})

it('still recognizes salary income', () => {
  expect(guessCategory('10월 급여', 'income')).toBe('급여')
})
