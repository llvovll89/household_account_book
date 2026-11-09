import { expect, it } from 'vitest'
import { applyMapping, detectColumns, guessCategory, parsePDFText, parseTabularFile } from './bankParser'

it('excludes impossible dates while preserving valid leap days in imported rows', () => {
  const rows = ['2026-02-30', '2026-13-01', '2026-00-10', '2026-02-29', '2024-02-29', '20261022'].map(date => ({ date, description: 'test', amount: '1000' }))
  const parsed = applyMapping(rows, { date: 'date', description: 'description', amount: 'amount', deposit: '', withdrawal: '', typeCol: '' })
  expect(parsed.map(row => row.date)).toEqual(['2024-02-29', '2026-10-22'])
})

it('excludes impossible calendar dates from PDF transaction text', () => {
  expect(parsePDFText('2026.02.30 9000 lunch\n2024.02.29 8000 cafe').map(row => row.date)).toEqual(['2024-02-29'])
})

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

const single = { date: 'd', description: 'm', amount: 'a', deposit: '', withdrawal: '', typeCol: '' }

it('reads signed, decimal, parenthesized and full-width amounts', () => {
  const rows = [
    { d: '2026-11-01', m: '급여', a: '+2,500,000' },
    { d: '2026-11-02', m: '커피', a: '-4,500원' },
    { d: '2026-11-03', m: '환불취소', a: '(1,000)' },
    { d: '2026-11-04', m: '해외결제', a: '15000.50' },
    { d: '2026-11-05', m: '전각', a: '１２，０００' },
  ]
  expect(applyMapping(rows, single).map(r => [r.amount, r.type])).toEqual([
    [2500000, 'income'], [4500, 'expense'], [1000, 'expense'], [15001, 'income'], [12000, 'income'],
  ])
})

it('keeps unsigned single-column amounts as expenses when the file has no negative values', () => {
  const rows = [{ d: '2026-11-01', m: '카드결제', a: '5,000' }, { d: '2026-11-02', m: '카드결제', a: '15000.00' }]
  expect(applyMapping(rows, single).map(r => [r.amount, r.type])).toEqual([[5000, 'expense'], [15000, 'expense']])
})

it('does not treat every value containing 입 as income', () => {
  const mapping = { ...single, typeCol: 't' }
  const rows = ['카드구입', '입출금', '출금(입금취소)', '입금', '수입'].map(t => ({ d: '2026-11-01', m: 'x', a: '1000', t }))
  expect(applyMapping(rows, mapping).map(r => r.type)).toEqual(['expense', 'expense', 'expense', 'income', 'income'])
})

it('parses rows when only a withdrawal or only a deposit column is mapped', () => {
  const rows = [{ d: '2026-11-01', m: '편의점', w: '3,000' }, { d: '2026-11-02', m: '빈 행', w: '' }]
  expect(applyMapping(rows, { ...single, amount: '', withdrawal: 'w' })).toEqual([{ date: '2026-11-01', description: '편의점', amount: 3000, type: 'expense' }])
  expect(applyMapping([{ d: '2026-11-01', m: '이자', p: '120' }], { ...single, amount: '', deposit: 'p' })[0]).toMatchObject({ amount: 120, type: 'income' })
})

it('accepts single-digit month and day dates', () => {
  const rows = [{ d: '2024.3.5', m: 'x', a: '1000' }, { d: '2024/12/1', m: 'y', a: '1000' }]
  expect(applyMapping(rows, single).map(r => r.date)).toEqual(['2024-03-05', '2024-12-01'])
})

it('re-imports the app CSV export with its type and description columns', () => {
  const mapping = detectColumns(['날짜', '유형', '카테고리', '설명', '금액(원)', '결제수단', '태그'])
  expect(mapping).toMatchObject({ date: '날짜', typeCol: '유형', description: '설명', amount: '금액(원)' })
  const parsed = applyMapping([{ 날짜: '2026-11-01', 유형: '수입', 설명: '월급', '금액(원)': '3000000' }], mapping as typeof single)
  expect(parsed).toEqual([{ date: '2026-11-01', description: '월급', amount: 3000000, type: 'income' }])
})

it('parses xlsx files whose date column holds real date cells', async () => {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([['거래일자', '적요', '출금액'], [new Date(2024, 2, 15), '마트', 32000]], { cellDates: true })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '내역')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const file = new File([buffer], 'bank.xlsx')
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer })
  const { rows } = await parseTabularFile(file)
  expect(applyMapping(rows, { ...single, date: '거래일자', description: '적요', amount: '', withdrawal: '출금액' })).toEqual([
    { date: '2024-03-15', description: '마트', amount: 32000, type: 'expense' },
  ])
})
