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

it('imports a different description at the same amount after category review', async () => {
  const onImport = vi.fn()
  const view = render(createElement(ImportModal, { existingTransactions: [{ id: 'existing', type: 'expense', amount: 9000, category: '식비', description: '다른 식당', date: '2026-10-30', createdAt: 1 }], onImport, onClose: vi.fn() }))
  await upload(view.container)
  fireEvent.change(screen.getByRole('combobox', { name: '설명/적요' }), { target: { value: 'Merchant' } })
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  fireEvent.click(screen.getByText('점심'))
  fireEvent.click(screen.getByRole('button', { name: /식비/ }))
  fireEvent.click(screen.getByRole('button', { name: '포함' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onImport.mock.calls[0][0]).toEqual([expect.objectContaining({ description: '점심', amount: 9000 })])
  // 파일의 첫 테스트가 모달 렌더링 초기 비용을 떠안아 전체 병렬 실행 시 5초를 넘길 수 있다
}, 15000)

it('excludes an existing exact match by default but allows explicitly including it', async () => {
  const onImport = vi.fn()
  const view = render(createElement(ImportModal, { existingTransactions: [{ id: 'existing', type: 'expense', amount: 9000, category: '식비', description: '점심', date: '2026-10-30', createdAt: 1 }], onImport, onClose: vi.fn() }))
  await upload(view.container)
  fireEvent.change(screen.getByRole('combobox', { name: '설명/적요' }), { target: { value: 'Merchant' } })
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  expect((screen.getByRole('button', { name: '0개 가져오기' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByText('점심'))
  fireEvent.click(screen.getByRole('button', { name: '포함' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onImport.mock.calls[0][0]).toHaveLength(1)
})

async function upload(container: HTMLElement, merchant = '점심') {
  vi.mocked(parseTabularFile).mockResolvedValue({ headers, rows: [{ Date: '2026-10-30', Amount: '9000', Merchant: merchant }] })
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['sample'], 'bank.csv')] } })
  await screen.findByRole('combobox', { name: '설명/적요' })
}

it('excludes a category review row until the user explicitly includes it', async () => {
  const onImport = vi.fn()
  const view = render(createElement(ImportModal, { existingTransactions: [], onImport, onClose: vi.fn() }))
  await upload(view.container, '커피')
  fireEvent.change(screen.getByRole('combobox', { name: '설명/적요' }), { target: { value: 'Merchant' } })
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  expect(screen.getByText(/검토 필요 1건은 기본으로 제외했어요/)).toBeTruthy()
  expect(screen.getByRole('button', { name: '0개 가져오기' }).hasAttribute('disabled')).toBe(true)
  const selectAll = screen.getByRole('checkbox', { name: '검토 필요 항목을 제외한 전체 선택' })
  expect(selectAll.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '검토 행 전부 포함' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onImport.mock.calls[0][0]).toEqual([expect.objectContaining({ description: '커피', category: '기타지출' })])
})

it('remembers only confirmed mappings and restores a custom description column on next upload', async () => {
  const onImport = vi.fn()
  const first = render(createElement(ImportModal, { existingTransactions: [], onImport, onClose: vi.fn() }))
  await upload(first.container)
  fireEvent.change(screen.getByRole('combobox', { name: '설명/적요' }), { target: { value: 'Merchant' } })
  expect(loadImportMapping(headers)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다음' }))
  fireEvent.click(screen.getByRole('button', { name: '검토 행 전부 포함' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onImport.mock.calls[0][0]).toEqual([expect.objectContaining({ description: '점심', amount: 9000 })])
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
  fireEvent.click(screen.getByRole('button', { name: '검토 행 전부 포함' }))
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
  fireEvent.click(screen.getByRole('button', { name: '포함' }))
  fireEvent.click(screen.getByRole('button', { name: '1개 가져오기' }))
  expect(onSaveRules).toHaveBeenCalledWith([expect.objectContaining({ keyword: '점심', category: '교통비', type: 'expense' })])
  expect(onImport.mock.calls[0][0]).toEqual([expect.objectContaining({ category: '교통비' })])
})
