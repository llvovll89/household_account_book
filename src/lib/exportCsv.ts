import type { Transaction } from '../types'
import { PAYMENT_METHOD_LABEL } from '../types'

function toRow(t: Transaction): (string | number)[] {
  return [
    t.date,
    t.type === 'income' ? '수입' : '지출',
    t.category,
    t.description,
    t.amount,
    PAYMENT_METHOD_LABEL[t.paymentMethod ?? 'cash'],
    (t.tags ?? []).join(';'),
  ]
}

const HEADERS = ['날짜', '유형', '카테고리', '설명', '금액(원)', '결제수단', '태그']

// 스프레드시트가 수식으로 실행하는 시작 문자 (CSV 수식 주입 방지)
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function toCsvCell(cell: string | number): string {
  const text = typeof cell === 'string' && FORMULA_PREFIX.test(cell) ? `'${cell}` : String(cell)
  return `"${text.replace(/"/g, '""')}"`
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(toRow)

  return [HEADERS, ...rows]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\r\n')
}

export function exportTransactionsCSV(transactions: Transaction[], filename: string) {
  const BOM = '\uFEFF' // Excel이 한글 깨지지 않도록 BOM 추가
  const blob = new Blob([BOM + buildTransactionsCsv(transactions)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // 즉시 해제하면 일부 Safari·iOS PWA에서 다운로드가 시작되기 전에 URL이 사라진다
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportTransactionsXLSX(transactions: Transaction[], filename: string) {
  const XLSX = await import('xlsx')
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(toRow)

  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
  sheet['!cols'] = [{ wch: 11 }, { wch: 6 }, { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 16 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '거래내역')
  XLSX.writeFile(workbook, filename)
}
