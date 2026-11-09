import { afterEach, expect, it, vi } from 'vitest'
import type { Transaction } from '../types'
import { buildTransactionsCsv, exportTransactionsCSV } from './exportCsv'

const base: Transaction = { id: 't', type: 'expense', amount: 5000, category: '식비', description: '점심', date: '2026-11-01', createdAt: 1 }

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('neutralizes text cells that a spreadsheet would run as a formula', () => {
  const csv = buildTransactionsCsv([
    { ...base, id: 'a', description: '=HYPERLINK("http://evil","click")' },
    { ...base, id: 'b', description: "=cmd|'/c calc'!A0", tags: ['@x'] },
    { ...base, id: 'c', description: '-2+3' },
    { ...base, id: 'd', description: '+82 송금' },
  ])
  const lines = csv.split('\r\n')
  expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`)
  expect(lines[2]).toContain(`"'=cmd|'/c calc'!A0"`)
  expect(lines[2]).toContain(`"'@x"`)
  expect(lines[3]).toContain(`"'-2+3"`)
  expect(lines[4]).toContain(`"'+82 송금"`)
})

it('keeps ordinary text and numeric amounts unchanged', () => {
  const [header, row] = buildTransactionsCsv([base]).split('\r\n')
  expect(header).toBe('"날짜","유형","카테고리","설명","금액(원)","결제수단","태그"')
  expect(row).toBe('"2026-11-01","지출","식비","점심","5000","현금",""')
})

it('revokes the download URL only after the browser had a chance to start the download', () => {
  vi.useFakeTimers()
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: revoke })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  exportTransactionsCSV([base], 'a.csv')
  expect(revoke).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(revoke).toHaveBeenCalledWith('blob:x')
  vi.unstubAllGlobals()
})
