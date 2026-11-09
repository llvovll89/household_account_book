import { expect, it } from 'vitest'
import { applyMapping, guessCategory, parsePDFText, parseTabularFile } from './bankParser'

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

it('parses xlsx exports by detecting the header row below a bank title row', async () => {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([
    ['거래내역 조회'],
    ['거래일자', '적요', '출금액', '입금액'],
    ['2026-10-01', '스타벅스', 5500, ''],
    ['2026-10-02', '10월 급여', '', 3000000],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '내역')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const file = new File([buffer], 'bank.xlsx')
  // jsdom의 File은 arrayBuffer()를 제공하지 않아 브라우저 동작을 흉내 낸다
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer })

  const { headers, rows } = await parseTabularFile(file)

  expect(headers).toEqual(['거래일자', '적요', '출금액', '입금액'])
  expect(rows).toHaveLength(2)
  expect(rows[0]).toMatchObject({ 거래일자: '2026-10-01', 적요: '스타벅스', 출금액: '5500' })
  expect(rows[1]).toMatchObject({ 적요: '10월 급여', 입금액: '3000000' })
})
