import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ImportModal from './ImportModal'
import { parseTabularFile } from '../lib/bankParser'
import { loadImportMapping } from '../lib/importMappings'

vi.mock('../lib/bankParser', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/bankParser')>()
  return { ...actual, parseTabularFile: vi.fn() }
})
const headers = ['Date', 'Amount', 'Merchant']
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks() })

async function upload(container: HTMLElement) {
  vi.mocked(parseTabularFile).mockResolvedValue({ headers, rows: [{ Date: '2026-10-30', Amount: '9000', Merchant: '점심' }] })
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['sample'], 'bank.csv')] } })
  await screen.findByRole('combobox', { name: '설명/적요' })
}

it('remembers only confirmed mappings and restores a custom description column on next upload', async () => {
  const onImport = vi.fn()
  const first = render(createElement(ImportModal, { existingTransactions: [], onImport, onClose: vi.fn() }))
  await upload(first.container)
  fireEvent.change(screen.getByRole('combobox', { name: '설명/적요' }), { target: { value: 'Merchant' } })
  expect(loadImportMapping(headers)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ description: '점심', amount: 9000 })])
  expect(loadImportMapping(headers)?.description).toBe('Merchant')
  first.unmount()
  const second = render(createElement(ImportModal, { existingTransactions: [], onImport, onClose: vi.fn() }))
  await upload(second.container)
  expect(screen.getByRole('status').textContent).toContain('이전에 확인한 컬럼 설정')
  expect((screen.getByRole('combobox', { name: '설명/적요' }) as HTMLSelectElement).value).toBe('Merchant')
  fireEvent.click(screen.getByRole('button', { name: '기억한 설정 지우기' }))
  expect(loadImportMapping(headers)).toBeNull()
})

it('does not persist unconfirmed or opted-out mapping choices', async () => {
  const first = render(createElement(ImportModal, { existingTransactions: [], onImport: vi.fn(), onClose: vi.fn() }))
  await upload(first.container)
  first.unmount()
  expect(loadImportMapping(headers)).toBeNull()
  const second = render(createElement(ImportModal, { existingTransactions: [], onImport: vi.fn(), onClose: vi.fn() }))
  await upload(second.container)
  fireEvent.click(screen.getByRole('checkbox', { name: '이 형식의 컬럼 설정 기억하기' }))
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(loadImportMapping(headers)).toBeNull()
})

it('remembers an explicitly chosen category correction when importing', async () => {
  const onSaveRules = vi.fn(), onImport = vi.fn()
  const view = render(createElement(ImportModal, { existingTransactions: [], onImport, onSaveRules, onClose: vi.fn() }))
  await upload(view.container)
  fireEvent.change(screen.getByRole('combobox', { name: '설명/적요' }), { target: { value: 'Merchant' } })
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  fireEvent.click(screen.getByText('점심'))
  fireEvent.click(screen.getByRole('button', { name: /교통비/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: '다음에도 같은 적요에 교통비 적용하기' }))
  expect(onSaveRules).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '포함', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onSaveRules).toHaveBeenCalledWith([expect.objectContaining({ keyword: '점심', category: '교통비', type: 'expense' })])
  expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ category: '교통비' })])
})
