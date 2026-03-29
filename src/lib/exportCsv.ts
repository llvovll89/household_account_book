import type { Transaction } from '../types'

export function exportTransactionsCSV(transactions: Transaction[], filename: string) {
  const BOM = '\uFEFF' // Excel이 한글 깨지지 않도록 BOM 추가
  const headers = ['날짜', '유형', '카테고리', '설명', '금액(원)']
  const rows = transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [
      t.date,
      t.type === 'income' ? '수입' : '지출',
      t.category,
      t.description,
      t.amount.toString(),
    ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
