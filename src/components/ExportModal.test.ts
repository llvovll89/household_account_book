import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ExportModal from './ExportModal'
import type { Transaction } from '../types'
import { loadTransactions, saveTransactions, setStorageContext } from '../lib/storage'
import { exportTransactionsCSV } from '../lib/exportCsv'

vi.mock('../firebase/firebase', () => ({ db: {} }))
vi.mock('../lib/exportCsv', () => ({ exportTransactionsCSV: vi.fn(), exportTransactionsXLSX: vi.fn() }))
vi.mock('./FancyDatePicker', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement('input', { 'aria-label': value, value, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value) }),
}))

const records: Transaction[] = [
  ['prior-year', '2025-12-01'], ['september', '2026-09-10'],
  ['october-first', '2026-10-01'], ['october-middle', '2026-10-15'], ['october-last', '2026-10-31'],
  ['november', '2026-11-01'], ['next-year', '2027-01-01'],
].map(([id, date]) => ({ id, date, type: 'expense', amount: 1000, category: '식비', description: id, createdAt: 1 }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12))
  vi.mocked(exportTransactionsCSV).mockReset()
  setStorageContext('local')
  await saveTransactions(records)
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it.each([
  { range: '지난 달', ids: ['october-first', 'october-middle', 'october-last'] },
  { range: '직접 설정', ids: ['october-first', 'october-middle', 'october-last'] },
  { range: '올해 전체', ids: ['september', 'october-first', 'october-middle', 'october-last', 'november'] },
])('archives exactly the records exported for $range, preserving other dates and newly added records', async ({ range, ids }) => {
  const onArchiveDone = vi.fn()
  render(createElement(ExportModal, { transactions: records, yearMonth: '2026-10', onClose: vi.fn(), onArchiveDone }))
  fireEvent.click(screen.getByRole('button', { name: range }))
  fireEvent.click(screen.getByRole('button', { name: '내보내고 앱에서 삭제 (아카이브)' }))
  // A record added after the preview must survive, even inside the exported date range.
  const added: Transaction = { ...records[2], id: 'added-after-preview' }
  await saveTransactions([...records, added])
  fireEvent.click(screen.getByRole('button', { name: '내보내고 삭제' }))
  await waitFor(() => expect(onArchiveDone).toHaveBeenCalledWith(ids))
  expect(exportTransactionsCSV).toHaveBeenCalledOnce()
  const exported = vi.mocked(exportTransactionsCSV).mock.calls[0][0]
  expect(exported.map(t => t.id)).toEqual(ids)
  expect((await loadTransactions()).map(t => t.id)).toEqual([...records.filter(t => !ids.includes(t.id)), added].map(t => t.id))
})

it('honors both custom date boundaries without deleting earlier records', async () => {
  const onArchiveDone = vi.fn()
  render(createElement(ExportModal, { transactions: records, yearMonth: '2026-10', onClose: vi.fn(), onArchiveDone }))
  fireEvent.click(screen.getByRole('button', { name: '직접 설정' }))
  fireEvent.change(screen.getByLabelText('2026-10-01'), { target: { value: '2026-10-10' } })
  fireEvent.change(screen.getByLabelText('2026-10-31'), { target: { value: '2026-10-20' } })
  fireEvent.click(screen.getByRole('button', { name: '내보내고 앱에서 삭제 (아카이브)' }))
  fireEvent.click(screen.getByRole('button', { name: '내보내고 삭제' }))
  await waitFor(() => expect(onArchiveDone).toHaveBeenCalledWith(['october-middle']))
  expect(vi.mocked(exportTransactionsCSV).mock.calls[0][0].map(t => t.id)).toEqual(['october-middle'])
  expect((await loadTransactions()).map(t => t.id)).toEqual(records.filter(t => t.id !== 'october-middle').map(t => t.id))
})

it('does not delete records or report completion if CSV export fails', async () => {
  vi.mocked(exportTransactionsCSV).mockImplementationOnce(() => { throw new Error('export failed') })
  const onArchiveDone = vi.fn()
  render(createElement(ExportModal, { transactions: records, yearMonth: '2026-10', onClose: vi.fn(), onArchiveDone }))
  fireEvent.click(screen.getByRole('button', { name: '지난 달' }))
  fireEvent.click(screen.getByRole('button', { name: '내보내고 앱에서 삭제 (아카이브)' }))
  fireEvent.click(screen.getByRole('button', { name: '내보내고 삭제' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: '내보내고 삭제' })).toBeNull())
  expect(onArchiveDone).not.toHaveBeenCalled()
  expect(await loadTransactions()).toEqual(records)
})
