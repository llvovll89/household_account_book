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

export function exportTransactionsCSV(transactions: Transaction[], filename: string) {
  const BOM = '\uFEFF' // Excel이 한글 깨지지 않도록 BOM 추가
  const rows = transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(toRow)

  const csv = [HEADERS, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportTransactionsXLSX(transactions: Transaction[], filename: string) {
  const XLSX = await import('xlsx')
  const rows = transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(toRow)

  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
  sheet['!cols'] = [{ wch: 11 }, { wch: 6 }, { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 16 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '거래내역')
  XLSX.writeFile(workbook, filename)
}
